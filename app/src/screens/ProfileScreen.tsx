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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  btn: { marginTop: 16, backgroundColor: '#111827', padding: 12, borderRadius: 10 },
  btnText: { color: 'white', fontWeight: '700' }
});

