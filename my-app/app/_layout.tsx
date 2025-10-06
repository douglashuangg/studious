import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';

// Override navigation types globally
declare global {
  namespace ReactNavigation {
    interface RootParamList {
      [key: string]: any;
    }
  }
}
import { TouchableOpacity, Text } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect } from 'react';
import { AuthProvider } from "../contexts/AuthContext";
import AuthWrapper from "../components/AuthWrapper";
import { requestNotificationPermissions, getExpoPushToken } from "../firebase/notificationService";

// Import your existing screen components
import HomeScreen from './index';
import RecordScreen from './record';
import CalendarScreen from './calendar';
import ProfileScreen from './profile';
import FollowersScreen from './followers';
import FollowingScreen from './following';
import SearchScreen from './search';
import ExternalUserProfileScreen from './user-profile/external-user-profile';
import NotificationsScreen from './notifications';
import EditProfileScreen from './edit-profile';
import StatisticsScreen from './statistics';
import PostDetailScreen from './post-detail';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerBackButtonDisplayMode: "minimal", headerTintColor: '#000000' }}>
      <Stack.Screen 
        name="ProfileMain" 
        component={ProfileScreen} 
        options={{ title: "Profile" }}
      />
      <Stack.Screen 
        name="Followers" 
        component={FollowersScreen} 
        options={{ title: "Followers" }}
      />
      <Stack.Screen 
        name="Following" 
        component={FollowingScreen} 
        options={{ title: "Following" }}
      />
      <Stack.Screen 
        name="ExternalUserProfile" 
        component={ExternalUserProfileScreen} 
        options={{ 
          headerShown: true,
          title: ""
        }}
      />
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen} 
        options={{ 
          title: "Edit Profile"
        }}
      />
      <Stack.Screen 
        name="Statistics" 
        component={StatisticsScreen} 
        options={{ title: "Statistics" }}
      />
    </Stack.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, headerBackButtonDisplayMode: "minimal", headerTintColor: '#000000' }}>
      <Stack.Screen name="Tabs" component={AppTabs} />
      <Stack.Screen 
        name="Search" 
        component={SearchScreen} 
        options={{ 
          headerShown: true,
          title: "Search" 
        }}
      />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{ 
          headerShown: true,
          title: "Notifications" 
        }}
      />
      <Stack.Screen 
        name="ExternalUserProfile" 
        component={ExternalUserProfileScreen} 
        options={{ 
          headerShown: true,
          title: ""
        }}
      />
      <Stack.Screen 
        name="Followers" 
        component={FollowersScreen} 
        options={{ 
          headerShown: true,
          title: "Followers" 
        }}
      />
      <Stack.Screen 
        name="Following" 
        component={FollowingScreen} 
        options={{ 
          headerShown: true,
          title: "Following" 
        }}
      />
      <Stack.Screen 
        name="PostDetail" 
        component={PostDetailScreen} 
        options={{ 
          headerShown: false,
          title: "Post Details"
        }}
      />
    </Stack.Navigator>
  );
}

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: "#4A7C59",
        tabBarInactiveTintColor: "#8E8E93",
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E5E5EA",
          height: 80,
          paddingBottom: 20,
          paddingTop: 10,
        },
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Record" 
        component={RecordScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stopwatch" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Calendar" 
        component={CalendarScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileStack} 
        options={{ 
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }} 
      />
    </Tab.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    // Initialize notifications when app starts
    const initializeNotifications = async () => {
      try {
        const hasPermission = await requestNotificationPermissions();
        if (hasPermission) {
          const token = await getExpoPushToken();
          if (token) {
            console.log('Push notification token:', token);
            // You can save this token to your backend/database here
          }
        }
      } catch (error) {
        console.error('Error initializing notifications:', error);
      }
    };

    initializeNotifications();
  }, []);

  return (
    <AuthProvider>
      <AuthWrapper>
        <NavigationContainer>
          <MainStack />
        </NavigationContainer>
      </AuthWrapper>
    </AuthProvider>
  );
}