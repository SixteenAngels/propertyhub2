import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { collection, getDocs, doc } from 'firebase/firestore';
import { db, firebaseApp } from '../../config/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

type User = { id: string; role?: 'user'|'manager'|'admin'; email?: string };

export default function AdminRolesScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const fns = getFunctions(firebaseApp);
  const setRoleFn = httpsCallable(fns, 'setUserRole');
  const approveHostFn = httpsCallable(fns, 'approveHost');

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    })();
  }, []);

  const setRole = async (uid: string, role: 'user'|'manager'|'admin') => {
    await setRoleFn({ uid, role });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={users}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.title}>{item.email ?? item.id}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['user','manager','admin'] as const).map((r) => (
                <Pressable key={r} style={[styles.btn, item.role === r && styles.btnActive]} onPress={() => setRole(item.id, r)}>
                  <Text style={styles.btnText}>{r}</Text>
                </Pressable>
              ))}
              <Pressable style={[styles.btn, { backgroundColor: '#16a34a' }]} onPress={() => approveHostFn({ userId: item.id, canHost: true })}>
                <Text style={styles.btnText}>Grant Host</Text>
              </Pressable>
              <Pressable style={[styles.btn, { backgroundColor: '#dc2626' }]} onPress={() => approveHostFn({ userId: item.id, canHost: false })}>
                <Text style={styles.btnText}>Revoke Host</Text>
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
  btn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#111827' },
  btnActive: { backgroundColor: '#2563eb' },
  btnText: { color: 'white', fontWeight: '700' },
});

