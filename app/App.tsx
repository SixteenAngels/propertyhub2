import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatThreadScreen from './src/screens/chat/ChatThreadScreen';
import PropertyDetailScreen from './src/screens/property/PropertyDetailScreen';
import ApprovalsScreen from './src/screens/admin/ApprovalsScreen';
import AuthScreen from './src/screens/auth/AuthScreen';
import AdminRolesScreen from './src/screens/admin/AdminRolesScreen';
import EscrowConsoleScreen from './src/screens/admin/EscrowConsoleScreen';
import ModerationScreen from './src/screens/ModerationScreen';
import MyBookingsScreen from './src/screens/MyBookingsScreen';
import HomeMapScreen from './src/screens/HomeMapScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import MyListingsScreen from './src/screens/MyListingsScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from './src/config/firebase';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './src/config/firebase';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeMapScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="MyListings" component={MyListingsScreen} />
      <Tab.Screen name="Chat" component={ChatListScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      (async () => {
        if (!u) {
          try { await signInAnonymously(auth); } catch {}
          return;
        }
        try {
          const ref = doc(db, 'users', u.uid);
          const snap = await getDoc(ref);
          if (!snap.exists()) {
            await setDoc(ref, {
              email: u.email ?? null,
              name: u.displayName ?? null,
              role: 'user',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }, { merge: true });
          } else {
            await setDoc(ref, { updatedAt: serverTimestamp() }, { merge: true });
          }
        } catch {}
      })();
    });
    return () => unsub();
  }, []);
  return (
    <NavigationContainer>
      <RootStack.Navigator>
        <RootStack.Screen name="Root" component={Tabs} options={{ headerShown: false }} />
        <RootStack.Screen name="Auth" component={AuthScreen} options={{ title: 'Sign in' }} />
        <RootStack.Screen name="ChatThread" component={ChatThreadScreen} options={{ title: 'Chat' }} />
        <RootStack.Screen name="PropertyDetail" component={PropertyDetailScreen} options={{ title: 'Property' }} />
        <RootStack.Screen name="Approvals" component={ApprovalsScreen} options={{ title: 'Approvals' }} />
        <RootStack.Screen name="AdminRoles" component={AdminRolesScreen} options={{ title: 'Assign Roles' }} />
        <RootStack.Screen name="EscrowConsole" component={EscrowConsoleScreen} options={{ title: 'Escrow Console' }} />
        <RootStack.Screen name="Moderation" component={ModerationScreen} options={{ title: 'Moderation' }} />
        <RootStack.Screen name="MyBookings" component={MyBookingsScreen} options={{ title: 'My Bookings' }} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
