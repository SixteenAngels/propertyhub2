import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatThreadScreen from './src/screens/chat/ChatThreadScreen';
import HomeMapScreen from './src/screens/HomeMapScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import MyListingsScreen from './src/screens/MyListingsScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import ProfileScreen from './src/screens/ProfileScreen';

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
  return (
    <NavigationContainer>
      <RootStack.Navigator>
        <RootStack.Screen name="Root" component={Tabs} options={{ headerShown: false }} />
        <RootStack.Screen name="ChatThread" component={ChatThreadScreen} options={{ title: 'Chat' }} />
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
