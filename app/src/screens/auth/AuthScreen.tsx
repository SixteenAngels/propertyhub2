import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import { PhoneAuthProvider, signInWithCredential, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, linkWithCredential } from 'firebase/auth';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { auth, firebaseApp } from '../../config/firebase';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierModal>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);

  const doEmailSignIn = async () => {
    if (!email || !password) return;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      await createUserWithEmailAndPassword(auth, email, password);
    }
  };

  const sendSms = async () => {
    const provider = new PhoneAuthProvider(auth);
    const id = await provider.verifyPhoneNumber(phone, recaptchaRef.current as any);
    setVerificationId(id);
  };

  const confirmSms = async () => {
    if (!verificationId) return;
    const credential = PhoneAuthProvider.credential(verificationId, code);
    try {
      await signInWithCredential(auth, credential);
    } catch {
      if (auth.currentUser) {
        await linkWithCredential(auth.currentUser, credential);
      }
    }
  };

  return (
    <View style={styles.container}>
      <FirebaseRecaptchaVerifierModal ref={recaptchaRef} firebaseConfig={firebaseApp.options as any} />
      <Text style={styles.header}>Sign in</Text>

      <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry />
      <Pressable style={styles.btn} onPress={doEmailSignIn}><Text style={styles.btnText}>Sign in with Email</Text></Pressable>

      <View style={{ height: 16 }} />
      <TextInput placeholder="Phone +123..." value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" />
      {verificationId ? (
        <>
          <TextInput placeholder="SMS Code" value={code} onChangeText={setCode} style={styles.input} keyboardType="numeric" />
          <Pressable style={styles.btn} onPress={confirmSms}><Text style={styles.btnText}>Confirm Code</Text></Pressable>
        </>
      ) : (
        <Pressable style={styles.btn} onPress={sendSms}><Text style={styles.btnText}>Send SMS</Text></Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 10, marginVertical: 6 },
  btn: { backgroundColor: '#2563eb', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  btnText: { color: 'white', fontWeight: '700' },
});

