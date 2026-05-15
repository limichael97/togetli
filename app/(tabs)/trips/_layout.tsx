import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { colors } from "../../../lib/theme";

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

export default function TripsStackLayout() {
  return (
    <Stack
      screenOptions={{
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
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: "Trips", headerLeft: () => null }}
      />
      <Stack.Screen name="new" options={{ title: "New Trip" }} />
      <Stack.Screen
        name="[tripId]"
        options={{
          title: "Trip",
          headerBackTitle: "Back",
          headerLeft: () => <TripsBackButton />,
        }}
      />
      <Stack.Screen name="[tripId]/members" options={{ title: "Members" }} />
      <Stack.Screen name="[tripId]/setup" options={{ title: "Trip Setup" }} />
      <Stack.Screen name="[tripId]/invite" options={{ title: "Invite" }} />
      <Stack.Screen name="[tripId]/poll" options={{ title: "Trip Poll" }} />
      <Stack.Screen
        name="[tripId]/poll-results"
        options={{ title: "Poll Results" }}
      />
      <Stack.Screen name="[tripId]/notes" options={{ title: "Shared Ideas" }} />
      <Stack.Screen name="[tripId]/travel" options={{ title: "Travel" }} />
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
