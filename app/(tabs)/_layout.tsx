import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { colors } from "../../lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="trips"
      screenOptions={{
        headerShown: false,
        headerTitleAlign: "center",
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTitleStyle: {
          fontSize: 17,
          fontWeight: "700",
          color: colors.text,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarStyle: {
          height: 84,
          paddingTop: 8,
          paddingBottom: 18,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="trips"
        options={{
          title: "Trips",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="airplane-outline" size={size - 1} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          headerShown: true,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="mail-outline" size={size - 1} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: true,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size - 1} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
