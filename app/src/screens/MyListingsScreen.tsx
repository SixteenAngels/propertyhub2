import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Image, FlatList } from 'react-native';
import MapView, { Marker, MapPressEvent } from 'react-native-maps';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytesResumable, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';
import { reverseGeocode } from '../services/geocoding';

export default function MyListingsScreen() {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState<'Sell'|'Rent'|'Lease'|'Stay'>('Rent');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number[]>([]);
  const [address, setAddress] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [myListings, setMyListings] = useState<any[]>([]);
  const [amenities, setAmenities] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const ql = query(collection(db, 'properties'), where('ownerId', '==', uid));
    const unsub = onSnapshot(ql, (snap) => setMyListings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))));
    return () => unsub();
  }, []);

  const onMapPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLocation({ lat: latitude, lng: longitude });
  };

  const submit = async () => {
    setError('');
    if (!title.trim() || !price) { setError('Title and price are required'); return; }
    if (!location) { setError('Please drop a pin on the map'); return; }
    const photos: string[] = [];
    if (photoUris.length) {
      const progresses = photoUris.map(() => 0);
      setUploadProgress(progresses);
      await Promise.all(
        photoUris.map(async (uri, idx) => {
          const blob = await (await fetch(uri)).blob();
          const key = `user_uploads/${auth.currentUser?.uid ?? 'demo'}/${Date.now()}_${idx}.jpg`;
          const r = ref(storage, key);
          await new Promise<void>((resolve, reject) => {
            const task = uploadBytesResumable(r, blob);
            task.on('state_changed', (snap) => {
              const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
              setUploadProgress((prev) => {
                const next = [...prev];
                next[idx] = pct;
                return next;
              });
            }, reject, async () => {
              const url = await getDownloadURL(r);
              photos.push(url);
              resolve();
            });
          });
        })
      );
    }
    let addr: string | null = address;
    if (!addr && location) {
      addr = await reverseGeocode(location.lat, location.lng);
      setAddress(addr);
    }
    if (editingId) {
      await updateDoc(doc(db, 'properties', editingId), {
        title,
        price: Number(price) || 0,
        type,
        description: addr ?? '',
        photos: photos.length ? photos : undefined,
        location,
        amenities: amenities.split(',').map((s) => s.trim()).filter(Boolean),
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(collection(db, 'properties'), {
        ownerId: auth.currentUser?.uid ?? 'demo',
        title,
        price: Number(price) || 0,
        type,
        description: addr ?? '',
        photos,
        location,
        amenities: amenities.split(',').map((s) => s.trim()).filter(Boolean),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    setTitle('');
    setPrice('');
    setLocation(null);
    setPhotoUris([]);
    setUploadProgress([]);
    setEditingId(null);
    setAmenities('');
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: 5 });
    if (!res.canceled && res.assets?.length) setPhotoUris((prev) => [...prev, ...res.assets.map((a) => a.uri)]);
  };

  const loadForEdit = (item: any) => {
    setEditingId(item.id);
    setTitle(item.title ?? '');
    setPrice(String(item.price ?? ''));
    setAddress(item.description ?? null);
    setLocation(item.location ?? null);
    setPhotoUris(item.photos ?? []);
  };

  const deleteListing = async (id: string) => {
    await deleteDoc(doc(db, 'properties', id));
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
      <TextInput placeholder="Amenities (comma separated)" value={amenities} onChangeText={setAmenities} style={styles.input} />
      {!!error && <Text style={{ color: '#dc2626' }}>{error}</Text>}
      {photoUris.length > 0 && (
        <FlatList
          data={photoUris}
          keyExtractor={(u, i) => u + i}
          horizontal
          renderItem={({ item, index }) => (
            <View style={{ marginRight: 8 }}>
              <Image source={{ uri: item }} style={{ width: 100, height: 100, borderRadius: 10 }} />
              {uploadProgress[index] != null && uploadProgress[index] > 0 && uploadProgress[index] < 100 && (
                <Text style={{ textAlign: 'center', marginTop: 4 }}>{uploadProgress[index]}%</Text>
              )}
              <Pressable onPress={() => setPhotoUris((prev) => prev.filter((_, i) => i !== index))} style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, borderRadius: 8 }}>
                <Text style={{ color: 'white' }}>X</Text>
              </Pressable>
            </View>
          )}
        />
      )}
      <Pressable style={[styles.btn, { backgroundColor: '#111827' }]} onPress={pickImage}>
        <Text style={styles.btnText}>Pick Photo</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={submit}>
        <Text style={styles.btnText}>{editingId ? 'Save Changes' : 'Submit for Approval'}</Text>
      </Pressable>

      <Text style={[styles.header, { marginTop: 16 }]}>My Listings</Text>
      <FlatList
        data={myListings}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
            <Text style={{ fontWeight: '600' }}>{item.title} • {item.status}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <Pressable style={[styles.btn, { backgroundColor: '#1f2937' }]} onPress={() => loadForEdit(item)}>
                <Text style={styles.btnText}>Edit</Text>
              </Pressable>
              <Pressable style={[styles.btn, { backgroundColor: '#dc2626' }]} onPress={() => deleteListing(item.id)}>
                <Text style={styles.btnText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
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

