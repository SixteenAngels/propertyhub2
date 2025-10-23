import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, setDoc, doc, updateDoc, getDoc, onSnapshot as onSnapDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

type Message = { id: string; senderId: string; receiverId: string; message: string; timestamp: any };
const demoUid = auth.currentUser?.uid ?? 'demo';

export default function ChatThreadScreen() {
  const route = useRoute<any>();
  const { chatId } = route.params ?? {};
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useMemo(() => collection(db, 'chats', chatId, 'messages'), [chatId]);
  const chatRef = useMemo(() => doc(db, 'chats', chatId), [chatId]);
  const functions = useMemo(() => getFunctions(), []);
  const sendMessageFn = useMemo(() => httpsCallable(functions, 'sendMessage'), [functions]);
  const setTypingFn = useMemo(() => httpsCallable(functions, 'setTyping'), [functions]);

  useEffect(() => {
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))));
    return () => unsub();
  }, [messagesRef]);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const unsub = onSnapDoc(chatRef, (snap) => {
      const t = (snap.data()?.typing ?? {}) as Record<string, boolean>;
      setTypingUsers(t);
    });
    return () => unsub();
  }, [chatRef]);

  useEffect(() => {
    // mark as read for current user
    (async () => {
      const c = await getDoc(chatRef);
      if (!c.exists()) return;
      // naive: no per-message updates to keep rules simple; could keep lastReadTimestamp per user
      await updateDoc(chatRef, { [`lastRead.${demoUid}`]: serverTimestamp() } as any);
    })();
  }, [chatRef]);

  const send = async () => {
    if (!text.trim()) return;
    await sendMessageFn({ chatId, message: text.trim() });
    setText('');
  };

  useEffect(() => {
    setTypingFn({ chatId, typing: true });
    const t = setTimeout(() => setTypingFn({ chatId, typing: false }), 800);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={styles.container}>
      {Object.entries(typingUsers).some(([uid, val]) => uid !== demoUid && val) && (
        <Text style={{ padding: 8, color: '#6b7280' }}>Typing…</Text>
      )}
      <FlatList
        data={messages}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.senderId === demoUid ? styles.bubbleMe : styles.bubbleOther]}>
            <Text style={styles.msgText}>{item.message}</Text>
            {item.readBy?.includes?.(demoUid) && <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>Read</Text>}
          </View>
        )}
        contentContainerStyle={{ padding: 12 }}
      />
      <View style={styles.inputRow}>
        <TextInput value={text} onChangeText={setText} placeholder="Message" style={styles.input} />
        <Pressable onPress={send} style={styles.sendBtn}><Text style={{ color: 'white' }}>Send</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bubble: { padding: 10, borderRadius: 12, marginVertical: 6, maxWidth: '80%' },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: '#2563eb' },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: '#e5e7eb' },
  msgText: { color: '#111827' },
  inputRow: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 10, marginRight: 8 },
  sendBtn: { backgroundColor: '#2563eb', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
});

