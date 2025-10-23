import { useEffect, useState } from 'react';
import { auth, db } from '../config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export type UserRole = 'user' | 'manager' | 'admin' | null;

export function useUserRole(): UserRole {
  const [role, setRole] = useState<UserRole>(null);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const ref = doc(db, 'users', uid);
    const unsub = onSnapshot(ref, (snap) => {
      setRole((snap.data()?.role as any) ?? 'user');
    });
    return () => unsub();
  }, [auth.currentUser?.uid]);
  return role;
}
