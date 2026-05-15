import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs, router } from "expo-router";
import { StyleSheet, View } from "react-native";
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
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginTop: 2,
        },
        tabBarStyle: {
          height: 88,
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
        name="ideas"
        options={{
          title: "Ideas",
          headerShown: true,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bulb-outline" size={size - 1} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            router.push("/new-trip");
          },
        }}
        options={{
          title: "Create",
          tabBarIcon: ({ focused }) => (
            <View style={[styles.createIcon, focused ? styles.createIconFocused : null]}>
              <Ionicons name="add" size={26} color={colors.primaryText} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          headerShown: true,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size - 1} color={color} />
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

const styles = StyleSheet.create({
  createIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -10,
    shadowColor: colors.text,
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  createIconFocused: {
    backgroundColor: colors.inkSoft,
  },
});
