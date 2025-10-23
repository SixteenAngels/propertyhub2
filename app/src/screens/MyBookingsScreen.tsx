import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

type Booking = { id: string; status: string; amount: number; transactionType: string };

export default function MyBookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, 'bookings'), where('userId', '==', uid), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => setBookings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))));
    return () => unsub();
  }, []);
  return (
    <View style={styles.container}>
      <FlatList
        data={bookings}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.title}>{item.transactionType} • ${item.amount}</Text>
            <Text>Status: {item.status}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#eee' }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  row: { paddingVertical: 10 },
  title: { fontWeight: '600' },
});

