import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { collection, doc, getDoc, getDocs, query, setDoc, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import * as WebBrowser from 'expo-web-browser';
import { getFunctions, httpsCallable } from 'firebase/functions';
import DateTimePicker from '@react-native-community/datetimepicker';
import { firebaseApp } from '../../config/firebase';

type Property = {
  title: string;
  description?: string;
  price: number;
  type: 'Sell' | 'Rent' | 'Lease' | 'Stay';
  photos?: string[];
  ownerId: string;
};

export default function PropertyDetailScreen() {
  const route = useRoute<any>();
  const { propertyId } = route.params ?? {};
  const nav = useNavigation<any>();
  const [prop, setProp] = useState<Property | null>(null);
  const [loading, setLoading] = useState(false);
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);

  useEffect(() => {
    (async () => {
      if (!propertyId) return;
      const snap = await getDoc(doc(db, 'properties', propertyId));
      if (snap.exists()) setProp(snap.data() as any);
    })();
  }, [propertyId]);

  if (!prop) return <View style={styles.container}><Text>Loading...</Text></View>;

  const createBooking = async () => {
    if (!propertyId || !prop) return;
    setLoading(true);
    try {
      const fn = httpsCallable(getFunctions(firebaseApp), 'createBooking');
      const res: any = await fn({ propertyId, amount: prop.price, transactionType: prop.type, payerEmail: 'demo@example.com', startDate: start?.getTime(), endDate: end?.getTime() });
      if (res?.data?.authorizationUrl) {
        await WebBrowser.openBrowserAsync(res.data.authorizationUrl);
        // After returning from browser, route to booking detail (mock for now)
        nav.navigate('BookingDetail', { bookingId: res.data.bookingId });
      }
    } finally {
      setLoading(false);
    }
  };

  const contactOwner = async () => {
    if (!propertyId || !prop) return;
    // chat id per property between current user and owner
    const participants = [prop.ownerId, (firebaseApp as any).auth?.currentUser?.uid].filter(Boolean);
    const chatQ = query(collection(db, 'chats'), where('propertyId', '==', propertyId));
    const existing = await getDocs(chatQ);
    const first = existing.docs[0];
    const chatId = first?.id ?? propertyId;
    if (!first) {
      await setDoc(doc(db, 'chats', chatId), { propertyId, participants, lastMessage: '', lastMessageAt: serverTimestamp(), typing: {} });
    }
    nav.navigate('ChatThread', { chatId });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {(prop.type === 'Stay' || prop.type === 'Rent') && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: '600', marginBottom: 6 }}>Select dates</Text>
          <DateTimePicker mode="date" value={start ?? new Date()} onChange={(_, d) => setStart(d ?? null)} />
          <View style={{ height: 6 }} />
          <DateTimePicker mode="date" value={end ?? new Date()} onChange={(_, d) => setEnd(d ?? null)} />
        </View>
      )}
      {prop.photos?.[0] && (
        <Image source={{ uri: prop.photos[0] }} style={{ height: 220, borderRadius: 12, marginBottom: 12 }} />
      )}
      <Text style={styles.title}>{prop.title}</Text>
      <Text style={styles.meta}>{prop.type} • ${prop.price}</Text>
      <Text style={styles.desc}>{prop.description ?? 'No description'}</Text>
      <Pressable disabled={loading} style={[styles.btn, loading && { opacity: 0.6 }]} onPress={createBooking}>
        <Text style={styles.btnText}>{loading ? 'Loading…' : 'Book / Request'}</Text>
      </Pressable>
      <Pressable style={[styles.btn, { backgroundColor: '#1f2937' }]} onPress={contactOwner}>
        <Text style={styles.btnText}>Chat with Owner</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  meta: { marginTop: 6, color: '#374151' },
  desc: { marginTop: 12, lineHeight: 20 },
  btn: { marginTop: 16, backgroundColor: '#2563eb', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: '700' },
});

