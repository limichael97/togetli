import { Stack } from "expo-router";

export default function TripsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleAlign: "center",
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Trips" }} />
      <Stack.Screen name="new" options={{ title: "New Trip" }} />
      <Stack.Screen
        name="[tripId]"
        options={{ title: "Trip", headerBackTitle: "Back" }}
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
