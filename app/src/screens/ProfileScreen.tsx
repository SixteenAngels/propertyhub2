import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { registerForPushNotificationsAsync } from '../services/notifications';
import { auth, db } from '../config/firebase';
import { arrayUnion, doc, setDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';

export default function ProfileScreen() {
  const nav = useNavigation<any>();
  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      // In MVP, you would store token in Firestore under users/{uid}
      if (token && auth.currentUser) {
        const ref = doc(db, 'users', auth.currentUser.uid);
        setDoc(ref, { fcmTokens: arrayUnion(token) }, { merge: true });
      }
    });
  }, []);

  return (
    <View style={styles.container}>
      <Text>Profile (stub)</Text>
      <Pressable style={styles.btn} onPress={() => nav.navigate('Approvals')}>
        <Text style={styles.btnText}>Open Approvals</Text>
      </Pressable>
      <Pressable style={[styles.btn, { backgroundColor: '#2563eb' }]} onPress={() => nav.navigate('Auth')}>
        <Text style={styles.btnText}>Sign in options</Text>
      </Pressable>
      <Pressable style={[styles.btn, { backgroundColor: '#0f766e' }]} onPress={() => nav.navigate('AdminRoles')}>
        <Text style={styles.btnText}>Admin: Assign Roles</Text>
      </Pressable>
      <Pressable style={[styles.btn, { backgroundColor: '#6d28d9' }]} onPress={() => nav.navigate('EscrowConsole')}>
        <Text style={styles.btnText}>Admin: Escrow Console</Text>
      </Pressable>
      <Pressable style={[styles.btn, { backgroundColor: '#9333ea' }]} onPress={() => nav.navigate('Moderation')}>
        <Text style={styles.btnText}>Manager: Moderation</Text>
      </Pressable>
      <Pressable style={[styles.btn, { backgroundColor: '#f97316' }]} onPress={() => nav.navigate('MyBookings')}>
        <Text style={styles.btnText}>My Bookings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  btn: { marginTop: 16, backgroundColor: '#111827', padding: 12, borderRadius: 10 },
  btnText: { color: 'white', fontWeight: '700' }
});

