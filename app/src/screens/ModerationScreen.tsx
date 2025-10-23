import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { collectionGroup, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

type Msg = { id: string; message: string; timestamp?: any; chatId: string; senderId?: string };

export default function ModerationScreen() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const fns = getFunctions();
  const flagFn = httpsCallable(fns, 'flagMessage');
  const muteFn = httpsCallable(fns, 'muteUser');
  const blockFn = httpsCallable(fns, 'blockUser');
  useEffect(() => {
    const q = query(collectionGroup(db, 'messages'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, chatId: d.ref.parent.parent?.id ?? '', ...(d.data() as any) }))));
    return () => unsub();
  }, []);
  return (
    <View style={styles.container}>
      <FlatList data={messages} keyExtractor={(i) => i.id} renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.title}>{item.chatId}</Text>
          <Text numberOfLines={1}>{item.message}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <Pressable style={styles.btn} onPress={() => flagFn({ chatId: item.chatId, messageId: item.id, reason: 'Inappropriate' })}><Text style={styles.btnText}>Flag</Text></Pressable>
            <Pressable style={[styles.btn, { backgroundColor: '#f59e0b' }]} onPress={() => muteFn({ userId: item.senderId, until: Date.now() + 3600000 })}><Text style={styles.btnText}>Mute</Text></Pressable>
            <Pressable style={[styles.btn, { backgroundColor: '#dc2626' }]} onPress={() => blockFn({ userId: item.senderId, blocked: true })}><Text style={styles.btnText}>Block</Text></Pressable>
          </View>
        </View>
      )} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontWeight: '600', marginBottom: 4 },
});

