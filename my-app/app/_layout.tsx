import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { AuthProvider } from "../contexts/AuthContext";
import AuthWrapper from "../components/AuthWrapper";

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthWrapper>
        <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#4A7C59",
        tabBarInactiveTintColor: "#8E8E93",
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
      <Tabs.Screen
        name="index"
        options={{
          title: "Studious",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: "Timer",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stopwatch" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="followers"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="following"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="edit-profile"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="user-profile"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="user-profile/external-user-profile"
        options={{
          href: null, // Hide from tab bar
          headerShown: false, // Hide the top header
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          href: null, // Hide from tab bar
          headerShown: false, // Hide the top header
        }}
      />
      <Tabs.Screen
        name="setup-profile"
        options={{
          href: null, // Hide from tab bar
          headerShown: false, // Hide the top header
          tabBarStyle: { display: 'none' }, // Completely hide tab bar
        }}
      />
      <Tabs.Screen
        name="setup-profile-picture"
        options={{
          href: null, // Hide from tab bar
          headerShown: false, // Hide the top header
          tabBarStyle: { display: 'none' }, // Completely hide tab bar
        }}
      />
    </Tabs>
        </AuthWrapper>
      </AuthProvider>
  );
}