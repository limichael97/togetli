import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs, router } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "../../store/useAuthStore";
import { useProfile } from "../../lib/useProfile";

export default function TabsLayout() {
  const { session, loading: authLoading } = useAuthStore();
  const { profile, loading: profileLoading } = useProfile();

  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!session) {
      router.replace("/(auth)/sign-in");
      return;
    }

    const missingName =
      !profile?.full_name?.trim() && !profile?.display_name?.trim();
    if (missingName) {
      router.replace("/(onboarding)/profile");
    }
  }, [session, authLoading, profile, profileLoading]);

  return (
    <Tabs
      initialRouteName="trips"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#111",
        tabBarInactiveTintColor: "#8a8a8a",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#ececec",
        },
      }}
    >
      <Tabs.Screen
        name="trips"
        options={{
          title: "Trips",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="airplane-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="mail-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
