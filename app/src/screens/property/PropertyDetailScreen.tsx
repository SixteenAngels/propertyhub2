import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, Pressable } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

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
  const [prop, setProp] = useState<Property | null>(null);

  useEffect(() => {
    (async () => {
      if (!propertyId) return;
      const snap = await getDoc(doc(db, 'properties', propertyId));
      if (snap.exists()) setProp(snap.data() as any);
    })();
  }, [propertyId]);

  if (!prop) return <View style={styles.container}><Text>Loading...</Text></View>;

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {prop.photos?.[0] && (
        <Image source={{ uri: prop.photos[0] }} style={{ height: 220, borderRadius: 12, marginBottom: 12 }} />
      )}
      <Text style={styles.title}>{prop.title}</Text>
      <Text style={styles.meta}>{prop.type} • ${prop.price}</Text>
      <Text style={styles.desc}>{prop.description ?? 'No description'}</Text>
      <Pressable style={styles.btn}><Text style={styles.btnText}>Book / Request</Text></Pressable>
      <Pressable style={[styles.btn, { backgroundColor: '#1f2937' }]}><Text style={styles.btnText}>Chat with Owner</Text></Pressable>
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

