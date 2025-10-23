import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions, Text, Pressable, Image, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import * as Location from 'expo-location';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import Constants from 'expo-constants';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { geohashQueryBounds } from 'geofire-common';
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
  const [region, setRegion] = useState<Region>(initialRegion);

  useEffect(() => {
    (async () => {
      const filters = [where('status', '==', 'approved')];
      if (type !== 'All') filters.push(where('type', '==', type));
      const min = parseFloat(minPrice) || 0;
      const max = parseFloat(maxPrice) || Number.MAX_SAFE_INTEGER;
      const bounds = geohashQueryBounds([region.latitude, region.longitude], Math.max(1000, region.latitudeDelta * 111_320));
      const results: Record<string, Property> = {};
      await Promise.all(
        bounds.map(async ([start, end]) => {
          const qs = query(collection(db, 'properties'), ...filters, where('geohash', '>=', start), where('geohash', '<=', end));
          const snap = await getDocs(qs);
          snap.forEach((d) => {
            const p = { id: d.id, ...(d.data() as any) } as Property;
            if (!p.location) return;
            if ((p.price ?? 0) < min || (p.price ?? 0) > max) return;
            results[p.id] = p;
          });
        })
      );
      setProperties(Object.values(results));
    })();
  }, [region, type, minPrice, maxPrice]);

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <Pressable style={[styles.filterPill, type==='All' && styles.filterActive]} onPress={() => setType('All')}><Text>All</Text></Pressable>
        {(['Sell','Rent','Lease','Stay'] as const).map((t) => (
          <Pressable key={t} style={[styles.filterPill, type===t && styles.filterActive]} onPress={() => setType(t)}><Text>{t}</Text></Pressable>
        ))}
        <Pressable style={[styles.filterPill, { backgroundColor: '#111827' }]} onPress={async () => {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') return;
          const loc = await Location.getCurrentPositionAsync({});
          const r = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.2, longitudeDelta: 0.2 };
          setRegion(r);
        }}><Text style={{ color: 'white' }}>Near me</Text></Pressable>
        <View style={{ flexDirection: 'row', gap: 6, marginLeft: 'auto' }}>
          <TextInput placeholder="Min" keyboardType="numeric" value={minPrice} onChangeText={setMinPrice} style={styles.priceInput} />
          <TextInput placeholder="Max" keyboardType="numeric" value={maxPrice} onChangeText={setMaxPrice} style={styles.priceInput} />
        </View>
      </View>
      <GooglePlacesAutocomplete
        placeholder="Search places"
        fetchDetails
        onPress={(data, details) => {
          const g = details?.geometry?.location;
          if (g) setRegion({ latitude: g.lat, longitude: g.lng, latitudeDelta: 0.2, longitudeDelta: 0.2 });
        }}
        query={{ key: (Constants as any)?.expoConfig?.extra?.GOOGLE_PLACES_API_KEY || (Constants as any)?.manifest?.extra?.GOOGLE_PLACES_API_KEY, language: 'en' }}
        styles={{ container: { position: 'absolute', top: 58, left: 12, right: 12, zIndex: 20 }, listView: { backgroundColor: 'white' } }}
      />
      <ClusteredMapView style={styles.map} initialRegion={initialRegion} region={region} onRegionChangeComplete={setRegion}>
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

