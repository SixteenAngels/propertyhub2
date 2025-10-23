import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function BookingDetailScreen() {
  const route = useRoute<any>();
  const { bookingId } = route.params ?? {};
  const [booking, setBooking] = useState<any>(null);
  useEffect(() => {
    (async () => {
      if (!bookingId) return;
      const snap = await getDoc(doc(db, 'bookings', bookingId));
      if (snap.exists()) setBooking(snap.data());
    })();
  }, [bookingId]);
  if (!booking) return <View style={styles.container}><Text>Loading...</Text></View>;
  const verify = async () => {
    const fn = httpsCallable(getFunctions(), 'verifyBooking');
    const res: any = await fn({ bookingId });
    if (res?.data?.status) {
      const snap = await getDoc(doc(db, 'bookings', bookingId));
      if (snap.exists()) setBooking(snap.data());
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Booking {bookingId}</Text>
      <Text>Status: {booking.status}</Text>
      <Text>Amount: ${booking.amount}</Text>
      {booking.startDate && booking.endDate && (
        <Text>Dates: {new Date(booking.startDate).toDateString()} - {new Date(booking.endDate).toDateString()}</Text>
      )}
      <Pressable style={{ marginTop: 12, backgroundColor: '#2563eb', padding: 10, borderRadius: 10 }} onPress={verify}>
        <Text style={{ color: 'white', fontWeight: '700' }}>Verify Payment</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontWeight: '700', fontSize: 18, marginBottom: 8 },
});

