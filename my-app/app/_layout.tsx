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
        tabBarActiveTintColor: "#2D5A27",
        tabBarInactiveTintColor: "#8B9A8B",
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
          title: "Study",
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
        name="calendar"
        options={{
          href: null, // Hide from tab bar - functionality moved to Study tab
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
        name="user-profile/[id]"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
      </AuthWrapper>
    </AuthProvider>
  );
}