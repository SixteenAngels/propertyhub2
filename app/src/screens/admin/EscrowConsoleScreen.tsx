import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp } from '../../config/firebase';

export default function EscrowConsoleScreen() {
  const [bookingId, setBookingId] = useState('');
  const fns = getFunctions(firebaseApp);
  const releaseFn = httpsCallable(fns, 'releaseEscrow');
  const refundFn = httpsCallable(fns, 'refundEscrow');

  const release = async () => { if (bookingId) await releaseFn({ bookingId }); };
  const refund = async () => { if (bookingId) await refundFn({ bookingId }); };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Escrow Console</Text>
      <TextInput placeholder="Booking ID" value={bookingId} onChangeText={setBookingId} style={styles.input} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable style={[styles.btn, { backgroundColor: '#16a34a' }]} onPress={release}><Text style={styles.btnText}>Release</Text></Pressable>
        <Pressable style={[styles.btn, { backgroundColor: '#dc2626' }]} onPress={refund}><Text style={styles.btnText}>Refund</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 10, marginVertical: 6 },
  btn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  btnText: { color: 'white', fontWeight: '700' },
});

