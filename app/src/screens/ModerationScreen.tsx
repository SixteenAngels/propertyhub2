import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { collectionGroup, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';

type Msg = { id: string; message: string; timestamp?: any; chatId: string };

export default function ModerationScreen() {
  const [messages, setMessages] = useState<Msg[]>([]);
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

