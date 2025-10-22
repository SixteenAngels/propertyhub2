import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Image } from 'react-native';
import MapView, { Marker, MapPressEvent } from 'react-native-maps';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../config/firebase';
import { reverseGeocode } from '../services/geocoding';

export default function MyListingsScreen() {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState<'Sell'|'Rent'|'Lease'|'Stay'>('Rent');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  const onMapPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLocation({ lat: latitude, lng: longitude });
  };

  const submit = async () => {
    let photos: string[] = [];
    if (photoUri) {
      const blob = await (await fetch(photoUri)).blob();
      const key = `user_uploads/${auth.currentUser?.uid ?? 'demo'}/${Date.now()}.jpg`;
      const r = ref(storage, key);
      await uploadBytes(r, blob);
      const url = await getDownloadURL(r);
      photos = [url];
    }
    let addr: string | null = address;
    if (!addr && location) {
      addr = await reverseGeocode(location.lat, location.lng);
      setAddress(addr);
    }
    await addDoc(collection(db, 'properties'), {
      ownerId: auth.currentUser?.uid ?? 'demo',
      title,
      price: Number(price) || 0,
      type,
      description: addr ?? '',
      photos,
      location,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setTitle('');
    setPrice('');
    setLocation(null);
    setPhotoUri(null);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!res.canceled && res.assets?.length) setPhotoUri(res.assets[0].uri);
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
      {photoUri && <Image source={{ uri: photoUri }} style={{ height: 120, borderRadius: 10 }} />}
      <Pressable style={[styles.btn, { backgroundColor: '#111827' }]} onPress={pickImage}>
        <Text style={styles.btnText}>Pick Photo</Text>
      </Pressable>
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

