import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { createHmac } from 'node:crypto';
import { geohashForLocation } from 'geofire-common';

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });
initializeAdminApp();

const db = getAdminFirestore();
const messaging = getMessaging();

// Helpers
async function requireRole(context: any, roles: Array<'admin' | 'manager'>): Promise<void> {
  const uid = context.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');
  const snap = await db.collection('users').doc(uid).get();
  const role = (snap.data()?.role ?? 'user') as string;
  if (!roles.includes(role as any)) {
    throw new HttpsError('permission-denied', 'Insufficient role');
  }
}

async function getUserTokens(userId: string): Promise<string[]> {
  const snap = await db.collection('users').doc(userId).get();
  const tokens = (snap.data()?.fcmTokens ?? []) as string[];
  return Array.isArray(tokens) ? tokens : [];
}

async function pruneInvalidTokens(userId: string, tokens: string[], response: any): Promise<void> {
  try {
    const invalid: string[] = [];
    response.responses?.forEach((r: any, idx: number) => {
      if (!r.success) invalid.push(tokens[idx]);
    });
    if (invalid.length) {
      await db.collection('users').doc(userId).set({ fcmTokens: FieldValue.arrayRemove(...invalid) }, { merge: true } as any);
    }
  } catch {}
}

export const onPropertyCreate = onDocumentCreated('properties/{propertyId}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data() as any;
  const loc = data?.location;
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
    updates.geohash = geohashForLocation([loc.lat, loc.lng]);
  }
  if (!data.createdAt) {
    updates.createdAt = FieldValue.serverTimestamp();
  }
  await snap.ref.set(updates, { merge: true });
  logger.info('Property created preprocessed', { propertyId: snap.id });
});

export const setUserRole = onCall(async (request) => {
  const context = request.auth;
  // Only admins can set roles
  await requireRole({ auth: context }, ['admin']);
  const { uid, role } = request.data as { uid: string; role: 'user' | 'manager' | 'admin' };
  if (!uid || !role) throw new HttpsError('invalid-argument', 'uid and role are required');
  await db.collection('users').doc(uid).set({ role }, { merge: true });
  return { ok: true };
});

export const approveListing = onCall(async (request) => {
  await requireRole({ auth: request.auth }, ['admin', 'manager']);
  const { propertyId, status, reason } = request.data as { propertyId: string; status: 'approved' | 'rejected'; reason?: string };
  if (!propertyId || !status) throw new HttpsError('invalid-argument', 'propertyId and status required');
  const ref = db.collection('properties').doc(propertyId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Property not found');
  const ownerId = (snap.data() as any).ownerId as string;
  await ref.set({ status, updatedAt: FieldValue.serverTimestamp(), rejectionReason: status==='rejected'? (reason ?? null): null }, { merge: true });
  // Notify owner
  const tokens = await getUserTokens(ownerId);
  if (tokens.length) {
    const resp = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: status === 'approved' ? 'Listing approved' : 'Listing rejected',
        body: status === 'rejected' ? (reason ?? 'Your listing was rejected') : ((snap.data() as any)?.title ?? 'Your listing status was updated'),
      },
      data: { type: 'listing_status', propertyId, status },
    });
    await pruneInvalidTokens(ownerId, tokens, resp);
  }
  return { ok: true };
});

export const approveHost = onCall(async (request) => {
  await requireRole({ auth: request.auth }, ['admin', 'manager']);
  const { userId, canHost } = request.data as { userId: string; canHost: boolean };
  if (!userId) throw new HttpsError('invalid-argument', 'userId required');
  await db.collection('users').doc(userId).set({ canHost: !!canHost }, { merge: true });
  return { ok: true };
});

export const createBooking = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');
  const { propertyId, amount, transactionType, payerEmail, startDate, endDate } = request.data as {
    propertyId: string; amount: number; transactionType: 'Sell'|'Rent'|'Lease'|'Stay'; payerEmail: string; startDate?: number; endDate?: number;
  };
  if (!propertyId || !amount || !transactionType || !payerEmail) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }
  const propRef = db.collection('properties').doc(propertyId);
  const propSnap = await propRef.get();
  if (!propSnap.exists || (propSnap.data() as any).status !== 'approved') {
    throw new HttpsError('failed-precondition', 'Property not available');
  }
  if ((transactionType === 'Stay' || transactionType === 'Rent') && (!startDate || !endDate || endDate < startDate)) {
    throw new HttpsError('invalid-argument', 'startDate and endDate required for Stay/Rent');
  }

  // Prevent overlapping bookings for Stay/Rent
  if (transactionType === 'Stay' || transactionType === 'Rent') {
    const blocking = ['pending','escrow','completed'];
    const q = db.collection('bookings')
      .where('propertyId', '==', propertyId)
      .where('status', 'in', blocking)
      .where('startDate', '<=', endDate!);
  const snap = await q.get();
    const overlaps = snap.docs.some(d => {
      const b = d.data() as any;
      return (b.endDate ?? 0) >= startDate!
    });
    if (overlaps) throw new HttpsError('failed-precondition', 'Selected dates overlap with existing booking');
  }
  const bookingRef = db.collection('bookings').doc();
  const bookingId = bookingRef.id;
  await bookingRef.set({
    propertyId,
    ownerId: (propSnap.data() as any).ownerId,
    userId: uid,
    amount,
    transactionType,
    startDate: startDate ?? null,
    endDate: endDate ?? null,
    status: 'pending',
    escrowStatus: 'n/a',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  if (!PAYSTACK_SECRET_KEY) {
    logger.warn('PAYSTACK_SECRET_KEY not set; returning mock reference');
    return { bookingId, reference: `mock_${bookingId}`, authorizationUrl: 'about:blank' };
  }

  let callbackUrl = process.env.PAYSTACK_CALLBACK_URL;
  if (callbackUrl && callbackUrl.includes('{bookingId}')) {
    callbackUrl = callbackUrl.replace('{bookingId}', bookingId);
  }
  const initRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: payerEmail,
      amount: Math.round(amount * 100),
      reference: bookingId,
      metadata: { bookingId, propertyId, uid, transactionType, startDate, endDate },
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
    }),
  });
  if (!initRes.ok) {
    const text = await initRes.text();
    logger.error('Paystack init failed', { text });
    throw new HttpsError('internal', 'Failed to initialize payment');
  }
  const initJson: any = await initRes.json();
  await bookingRef.set({ paystack: { reference: bookingId, status: 'initialized' } }, { merge: true });
  return { bookingId, reference: bookingId, authorizationUrl: initJson.data?.authorization_url };
});

export const verifyBooking = onCall(async (request) => {
  await requireRole({ auth: request.auth }, ['admin', 'manager']);
  const { bookingId } = request.data as { bookingId: string };
  if (!bookingId) throw new HttpsError('invalid-argument', 'bookingId required');
  const ref = db.collection('bookings').doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Booking not found');
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
  if (!PAYSTACK_SECRET_KEY) throw new HttpsError('failed-precondition', 'No Paystack secret');
  const resp = await fetch(`https://api.paystack.co/transaction/verify/${bookingId}`, { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } });
  const json: any = await resp.json();
  const status = json?.data?.status;
  if (status === 'success') {
    await ref.set({ status: 'escrow', escrowStatus: 'held', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  return { status };
});

export const paystackWebhook = onRequest(async (req, res) => {
  const signature = req.get('x-paystack-signature') || '';
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY || '';
  const raw = (req as any).rawBody as Buffer;
  const computed = createHmac('sha512', secret).update(raw).digest('hex');
  if (!secret || signature !== computed) {
    logger.warn('Invalid webhook signature');
    res.status(401).send('Unauthorized');
    return;
  }
  const event = req.body as any;
  const reference = event?.data?.reference as string | undefined;
  if (!reference) { res.sendStatus(200); return; }
  const bookingRef = db.collection('bookings').doc(reference);
  if (event.event === 'charge.success') {
    await bookingRef.set({ status: 'escrow', escrowStatus: 'held', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  } else if (event.event === 'charge.failed') {
    await bookingRef.set({ status: 'failed', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  res.sendStatus(200);
});

export const cancelBooking = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');
  const { bookingId } = request.data as { bookingId: string };
  if (!bookingId) throw new HttpsError('invalid-argument', 'bookingId required');
  const ref = db.collection('bookings').doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Booking not found');
  const b = snap.data() as any;
  if (b.userId !== uid) throw new HttpsError('permission-denied', 'Not your booking');
  if (b.status !== 'pending') throw new HttpsError('failed-precondition', 'Only pending bookings can be cancelled');
  await ref.set({ status: 'cancelled', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});

export const releaseEscrow = onCall(async (request) => {
  await requireRole({ auth: request.auth }, ['admin', 'manager']);
  const { bookingId } = request.data as { bookingId: string };
  if (!bookingId) throw new HttpsError('invalid-argument', 'bookingId required');
  await db.collection('bookings').doc(bookingId).set({ escrowStatus: 'released', status: 'completed', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});

export const refundEscrow = onCall(async (request) => {
  await requireRole({ auth: request.auth }, ['admin', 'manager']);
  const { bookingId } = request.data as { bookingId: string };
  if (!bookingId) throw new HttpsError('invalid-argument', 'bookingId required');
  await db.collection('bookings').doc(bookingId).set({ escrowStatus: 'refunded', status: 'cancelled', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});

export const onMessageCreate = onDocumentCreated('chats/{chatId}/messages/{messageId}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const msg = snap.data() as any;
  const receiverId = msg.receiverId as string | undefined;
  if (!receiverId) return;
  // Update chat last message
  await db.collection('chats').doc(event.params.chatId).set({
    lastMessage: msg.message ?? '',
    lastMessageAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  const tokens = await getUserTokens(receiverId);
  if (!tokens.length) return;
  const resp = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: 'New message', body: msg.message?.slice(0, 120) ?? 'You have a new message' },
    data: { type: 'chat', chatId: event.params?.chatId ?? '' },
  });
  await pruneInvalidTokens(receiverId, tokens, resp);
});

export const sendMessage = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');
  const { chatId, message } = request.data as { chatId: string; message: string };
  if (!chatId || !message || typeof message !== 'string' || message.length > 1000) {
    throw new HttpsError('invalid-argument', 'Invalid message');
  }
  const chatRef = db.collection('chats').doc(chatId);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists) throw new HttpsError('not-found', 'Chat not found');
  const chat = chatSnap.data() as any;
  const participants: string[] = Array.isArray(chat.participants) ? chat.participants : [];
  if (!participants.includes(uid)) throw new HttpsError('permission-denied', 'Not a participant');

  // Rate limit: at most 1 message per 500ms per user per chat
  const recentSnap = await db.collection('chats').doc(chatId)
    .collection('messages')
    .where('senderId', '==', uid)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();
  const now = Date.now();
  const last = recentSnap.docs[0]?.data()?.timestamp?.toMillis?.() ?? 0;
  if (now - last < 500) throw new HttpsError('resource-exhausted', 'Slow down');

  const other = participants.find((p) => p !== uid) ?? undefined;
  await db.collection('chats').doc(chatId).collection('messages').add({
    senderId: uid,
    receiverId: other ?? null,
    message,
    timestamp: FieldValue.serverTimestamp(),
    readBy: [uid],
  });
  await chatRef.set({ lastMessage: message, lastMessageAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});

export const setTyping = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');
  const { chatId, typing } = request.data as { chatId: string; typing: boolean };
  if (!chatId) throw new HttpsError('invalid-argument', 'chatId required');
  const chatRef = db.collection('chats').doc(chatId);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists) throw new HttpsError('not-found', 'Chat not found');
  const chat = chatSnap.data() as any;
  const participants: string[] = Array.isArray(chat.participants) ? chat.participants : [];
  if (!participants.includes(uid)) throw new HttpsError('permission-denied', 'Not a participant');
  await chatRef.set({ typing: { ...(chat.typing ?? {}), [uid]: !!typing } }, { merge: true });
  return { ok: true };
});

export const flagMessage = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');
  const { chatId, messageId, reason } = request.data as { chatId: string; messageId: string; reason?: string };
  if (!chatId || !messageId) throw new HttpsError('invalid-argument', 'chatId and messageId required');
  // capture sender for moderation
  const msg = await db.collection('chats').doc(chatId).collection('messages').doc(messageId).get();
  await db.collection('moderationFlags').add({ chatId, messageId, senderId: msg.data()?.senderId ?? null, reason: reason ?? null, reporterId: uid, createdAt: FieldValue.serverTimestamp() });
  return { ok: true };
});

export const muteUser = onCall(async (request) => {
  await requireRole({ auth: request.auth }, ['admin', 'manager']);
  const { userId, until } = request.data as { userId: string; until?: number };
  if (!userId) throw new HttpsError('invalid-argument', 'userId required');
  await db.collection('users').doc(userId).set({ mutedUntil: until ?? null }, { merge: true });
  return { ok: true };
});

export const blockUser = onCall(async (request) => {
  await requireRole({ auth: request.auth }, ['admin', 'manager']);
  const { userId, blocked } = request.data as { userId: string; blocked: boolean };
  if (!userId) throw new HttpsError('invalid-argument', 'userId required');
  await db.collection('users').doc(userId).set({ blocked: !!blocked }, { merge: true });
  return { ok: true };
});
