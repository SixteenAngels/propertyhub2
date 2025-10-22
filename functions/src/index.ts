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
  const { propertyId, status } = request.data as { propertyId: string; status: 'approved' | 'rejected' };
  if (!propertyId || !status) throw new HttpsError('invalid-argument', 'propertyId and status required');
  const ref = db.collection('properties').doc(propertyId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Property not found');
  const ownerId = (snap.data() as any).ownerId as string;
  await ref.set({ status, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  // Notify owner
  const tokens = await getUserTokens(ownerId);
  if (tokens.length) {
    await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: status === 'approved' ? 'Listing approved' : 'Listing rejected',
        body: (snap.data() as any)?.title ?? 'Your listing status was updated',
      },
      data: { type: 'listing_status', propertyId, status },
    });
  }
  return { ok: true };
});

export const createBooking = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');
  const { propertyId, amount, transactionType, payerEmail } = request.data as {
    propertyId: string; amount: number; transactionType: 'Sell'|'Rent'|'Lease'|'Stay'; payerEmail: string;
  };
  if (!propertyId || !amount || !transactionType || !payerEmail) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }
  const propRef = db.collection('properties').doc(propertyId);
  const propSnap = await propRef.get();
  if (!propSnap.exists || (propSnap.data() as any).status !== 'approved') {
    throw new HttpsError('failed-precondition', 'Property not available');
  }
  const bookingRef = db.collection('bookings').doc();
  const bookingId = bookingRef.id;
  await bookingRef.set({
    propertyId,
    ownerId: (propSnap.data() as any).ownerId,
    userId: uid,
    amount,
    transactionType,
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
      metadata: { bookingId, propertyId, uid, transactionType },
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
  const tokens = await getUserTokens(receiverId);
  if (!tokens.length) return;
  await messaging.sendEachForMulticast({
    tokens,
    notification: { title: 'New message', body: msg.message?.slice(0, 120) ?? 'You have a new message' },
    data: { type: 'chat', chatId: event.params?.chatId ?? '' },
  });
});
