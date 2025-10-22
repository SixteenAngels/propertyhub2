import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { registerForPushNotificationsAsync } from '../services/notifications';

export default function ProfileScreen() {
  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      // In MVP, you would store token in Firestore under users/{uid}
      console.log('FCM token', token);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Text>Profile (stub)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

