import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { db, firebaseApp } from '../../config/firebase';

type Property = { id: string; title: string };

export default function ApprovalsScreen() {
  const [pending, setPending] = useState<Property[]>([]);
  const functions = getFunctions(firebaseApp);
  const approveFn = httpsCallable(functions, 'approveListing');

  useEffect(() => {
    const q = query(collection(db, 'properties'), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, (snap) => setPending(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))));
    return () => unsub();
  }, []);

  const update = async (propertyId: string, status: 'approved' | 'rejected') => {
    await approveFn({ propertyId, status });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={pending}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.title}>{item.title}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => update(item.id, 'approved')} style={[styles.btn, styles.approve]}>
                <Text style={styles.btnText}>Approve</Text>
              </Pressable>
              <Pressable onPress={() => update(item.id, 'rejected')} style={[styles.btn, styles.reject]}>
                <Text style={styles.btnText}>Reject</Text>
              </Pressable>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#eee' }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  row: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: '600' },
  btn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  approve: { backgroundColor: '#16a34a' },
  reject: { backgroundColor: '#dc2626' },
  btnText: { color: 'white', fontWeight: '700' }
});

