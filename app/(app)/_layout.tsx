import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { colors } from "../../lib/theme";

function TripsBackButton() {
  const handlePress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)/trips");
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={handlePress}
      style={({ pressed }) => [
        styles.tripsBackButton,
        pressed ? styles.tripsBackButtonPressed : null,
      ]}
    >
      <Ionicons name="chevron-back" size={21} color={colors.primary} />
    </Pressable>
  );
}

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleAlign: "center",
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="home" options={{ title: "Home" }} />
      <Stack.Screen
        name="trips/index"
        options={{ title: "Trips", headerLeft: () => null }}
      />
      <Stack.Screen name="trips/new" options={{ title: "New Trip" }} />
      <Stack.Screen
        name="trips/[tripId]"
        options={{
          title: "Trip",
          headerBackTitle: "Back",
          headerLeft: () => <TripsBackButton />,
        }}
      />
      <Stack.Screen
        name="trips/[tripId]/members"
        options={{ title: "Members" }}
      />
      <Stack.Screen
        name="trips/[tripId]/setup"
        options={{ title: "Trip Setup" }}
      />
      <Stack.Screen
        name="trips/[tripId]/invite"
        options={{ title: "Invite" }}
      />
      <Stack.Screen
        name="trips/[tripId]/poll"
        options={{ title: "Trip Poll" }}
      />
      <Stack.Screen
        name="trips/[tripId]/poll-results"
        options={{ title: "Poll Results" }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  tripsBackButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  tripsBackButtonPressed: {
    opacity: 0.65,
  },
});
