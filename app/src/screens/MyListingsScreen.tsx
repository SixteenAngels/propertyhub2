import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import MapView, { Marker, MapPressEvent } from 'react-native-maps';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';

export default function MyListingsScreen() {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState<'Sell'|'Rent'|'Lease'|'Stay'>('Rent');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const onMapPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLocation({ lat: latitude, lng: longitude });
  };

  const submit = async () => {
    await addDoc(collection(db, 'properties'), {
      ownerId: auth.currentUser?.uid ?? 'demo',
      title,
      price: Number(price) || 0,
      type,
      description: '',
      photos: [],
      location,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setTitle('');
    setPrice('');
    setLocation(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Create Listing (MVP)</Text>
      <TextInput placeholder="Title" value={title} onChangeText={setTitle} style={styles.input} />
      <TextInput placeholder="Price" value={price} onChangeText={setPrice} keyboardType="numeric" style={styles.input} />
      <View style={{ height: 220, borderRadius: 12, overflow: 'hidden', marginVertical: 8 }}>
        <MapView style={{ flex: 1 }} onPress={onMapPress}>
          {location && <Marker coordinate={{ latitude: location.lat, longitude: location.lng }} />}
        </MapView>
      </View>
      <Pressable style={styles.btn} onPress={submit}>
        <Text style={styles.btnText}>Submit for Approval</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 10,
    marginVertical: 6,
  },
  btn: { backgroundColor: '#16a34a', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700' },
});

