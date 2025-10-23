import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import Constants from 'expo-constants';

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

const expoExtra = (Constants?.expoConfig as any)?.extra || (Constants as any)?.manifest?.extra || {};

const firebaseConfig: FirebaseConfig = {
  apiKey: expoExtra.FIREBASE_API_KEY || '',
  authDomain: expoExtra.FIREBASE_AUTH_DOMAIN || '',
  projectId: expoExtra.FIREBASE_PROJECT_ID || '',
  storageBucket: expoExtra.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: expoExtra.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: expoExtra.FIREBASE_APP_ID || '',
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0]!;
}

export const firebaseApp = app;
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
