import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions, Text, Pressable, Image } from 'react-native';
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
  const initialRegion: Region = useMemo(
    () => ({ latitude: 6.5244, longitude: 3.3792, latitudeDelta: 0.3, longitudeDelta: 0.3 }),
    []
  );

  useEffect(() => {
    const q = query(collection(db, 'properties'), where('status', '==', 'approved'));
    const unsub = onSnapshot(q, (snap) => {
      const items: Property[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setProperties(items);
    });
    return () => unsub();
  }, []);

  return (
    <View style={styles.container}>
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

