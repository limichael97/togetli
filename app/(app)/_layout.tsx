import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleAlign: "center",
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="home" options={{ title: "Home" }} />
      <Stack.Screen name="trips/index" options={{ title: "Trips" }} />
      <Stack.Screen name="trips/new" options={{ title: "New Trip" }} />
      <Stack.Screen
        name="trips/[tripId]"
        options={{ title: "Trip", headerBackTitle: "Back" }}
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
