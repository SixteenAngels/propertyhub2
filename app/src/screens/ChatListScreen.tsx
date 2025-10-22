import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useNavigation } from '@react-navigation/native';

type Chat = { id: string; lastMessage?: string; lastMessageAt?: any; participants: string[] };

const demoUid = 'demo';

export default function ChatListScreen() {
  const [chats, setChats] = useState<Chat[]>([]);
  const nav = useNavigation<any>();

  useEffect(() => {
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', demoUid),
      orderBy('lastMessageAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => setChats(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))));
    return () => unsub();
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={chats}
        keyExtractor={(i) => i.id}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#eee' }} />}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => nav.navigate('ChatThread', { chatId: item.id })}>
            <Text style={styles.title}>{item.id}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{item.lastMessage ?? ''}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { padding: 16 },
  title: { fontWeight: '600' },
  subtitle: { color: '#444', marginTop: 4 },
});

