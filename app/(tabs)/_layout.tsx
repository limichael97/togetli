import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs, router } from "expo-router";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../../lib/theme";

const TAB_BAR_HEIGHT = 82;
const TAB_ROOT_ROUTES = {
  trips: "/(tabs)/trips",
  ideas: "/(tabs)/ideas",
  inbox: "/(tabs)/inbox",
} as const;

function resetToTabRoot(href: (typeof TAB_ROOT_ROUTES)[keyof typeof TAB_ROOT_ROUTES]) {
  router.replace(href);
}

function resetProfileTab() {
  router.replace({
    pathname: "/(tabs)/profile",
    params: { tabReset: String(Date.now()) },
  });
}

function TabIcon({
  name,
  focused,
  size,
}: {
  name: ComponentProps<typeof Ionicons>["name"];
  focused: boolean;
  size: number;
}) {
  return (
    <View style={[styles.tabIconShell, focused ? styles.tabIconShellActive : null]}>
      <Ionicons
        name={name}
        size={focused ? size : size - 2}
        color={focused ? colors.primaryText : colors.textSubtle}
      />
    </View>
  );
}

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
        tabBarActiveTintColor: colors.primaryText,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800",
          marginTop: 2,
        },
        tabBarStyle: {
          height: TAB_BAR_HEIGHT,
          paddingTop: 8,
          paddingBottom: 18,
          marginHorizontal: 0,
          marginBottom: 0,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          backgroundColor: colors.accentPrimary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          borderWidth: 1,
          borderColor: colors.border,
          position: "absolute",
          bottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="trips"
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            resetToTabRoot(TAB_ROOT_ROUTES.trips);
          },
        }}
        options={{
          title: "Trips",
          tabBarIcon: ({ focused, size }) => (
            <TabIcon name="airplane-outline" focused={focused} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="ideas"
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            resetToTabRoot(TAB_ROOT_ROUTES.ideas);
          },
        }}
        options={{
          title: "Ideas",
          headerShown: true,
          tabBarIcon: ({ focused, size }) => (
            <TabIcon name="bulb-outline" focused={focused} size={size} />
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
            <View
              style={[styles.createIcon, focused ? styles.createIconFocused : null]}
            >
              <Ionicons name="add" size={26} color={colors.primaryText} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            resetToTabRoot(TAB_ROOT_ROUTES.inbox);
          },
        }}
        options={{
          title: "Inbox",
          headerShown: true,
          tabBarIcon: ({ focused, size }) => (
            <TabIcon name="notifications-outline" focused={focused} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            resetProfileTab();
          },
        }}
        options={{
          title: "Profile",
          headerShown: true,
          tabBarIcon: ({ focused, size }) => (
            <TabIcon name="person-outline" focused={focused} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconShell: {
    width: 34,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconShellActive: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.text,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
    elevation: 3,
  },
  createIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -10,
    shadowColor: colors.text,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
    elevation: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  createIconFocused: {
    backgroundColor: colors.primary,
  },
});
