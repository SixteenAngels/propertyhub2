import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions, Text, Pressable, Image, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

type Property = {
  id: string;
  title: string;
  price: number;
  type: 'Sell' | 'Rent' | 'Lease' | 'Stay';
  photos?: string[];
  location?: { lat: number; lng: number };
};

export default function HomeMapScreen() {
  const nav = useNavigation<any>();
  const [properties, setProperties] = useState<Property[]>([]);
  const [type, setType] = useState<'Sell'|'Rent'|'Lease'|'Stay'|'All'>('All');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const initialRegion: Region = useMemo(
    () => ({ latitude: 6.5244, longitude: 3.3792, latitudeDelta: 0.3, longitudeDelta: 0.3 }),
    []
  );

  useEffect(() => {
    const filters = [where('status', '==', 'approved')];
    if (type !== 'All') filters.push(where('type', '==', type));
    // Note: Firestore requires indexes for price filters combined with others; keep simple in MVP or filter client-side
    const q = query(collection(db, 'properties'), ...filters);
    const unsub = onSnapshot(q, (snap) => {
      let items: Property[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const min = parseFloat(minPrice) || 0;
      const max = parseFloat(maxPrice) || Number.MAX_SAFE_INTEGER;
      items = items.filter(p => (p.price ?? 0) >= min && (p.price ?? 0) <= max);
      setProperties(items);
    });
    return () => unsub();
  }, [type, minPrice, maxPrice]);

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <Pressable style={[styles.filterPill, type==='All' && styles.filterActive]} onPress={() => setType('All')}><Text>All</Text></Pressable>
        {(['Sell','Rent','Lease','Stay'] as const).map((t) => (
          <Pressable key={t} style={[styles.filterPill, type===t && styles.filterActive]} onPress={() => setType(t)}><Text>{t}</Text></Pressable>
        ))}
        <View style={{ flexDirection: 'row', gap: 6, marginLeft: 'auto' }}>
          <TextInput placeholder="Min" keyboardType="numeric" value={minPrice} onChangeText={setMinPrice} style={styles.priceInput} />
          <TextInput placeholder="Max" keyboardType="numeric" value={maxPrice} onChangeText={setMaxPrice} style={styles.priceInput} />
        </View>
      </View>
      <ClusteredMapView style={styles.map} initialRegion={initialRegion}>
        {properties.map((p) => (
          p.location ? (
            <Marker key={p.id} coordinate={{ latitude: p.location.lat, longitude: p.location.lng }}>
              <Callout tooltip>
                <View style={styles.card}>
                  {p.photos?.[0] ? (
                    <Image source={{ uri: p.photos[0] }} style={styles.cardImage} />
                  ) : null}
                  <View style={styles.cardContent}>
                    <Text numberOfLines={1} style={styles.cardTitle}>{p.title}</Text>
                    <Text style={styles.cardSubtitle}>{p.type} • ${p.price}</Text>
                    <Pressable style={styles.cta} onPress={() => nav.navigate('PropertyDetail', { propertyId: p.id })}>
                      <Text style={styles.ctaText}>View</Text>
                    </Pressable>
                  </View>
                </View>
              </Callout>
            </Marker>
          ) : null
        ))}
      </ClusteredMapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  filters: {
    position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.8)',
    padding: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#fff'
  },
  filterPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#e5e7eb', marginRight: 6 },
  filterActive: { backgroundColor: '#93c5fd' },
  priceInput: { width: 70, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  card: {
    width: 240,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.9)'
  },
  cardImage: { width: '100%', height: 120 },
  cardContent: { padding: 12 },
  cardTitle: { fontWeight: '600', fontSize: 16 },
  cardSubtitle: { color: '#333', marginTop: 4 },
  cta: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center'
  },
  ctaText: { color: 'white', fontWeight: '600' }
});

