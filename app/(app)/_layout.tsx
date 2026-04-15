import { Stack, router } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "../../store/useAuthStore";
import { useProfile } from "../../lib/useProfile";

export default function AppLayout() {
  const { session, loading: authLoading } = useAuthStore();
  const { profile, loading: profileLoading } = useProfile();

  useEffect(() => {
    if (authLoading || profileLoading) return;

    // Not logged in -> auth
    if (!session) {
      router.replace("/(auth)/sign-in");
      return;
    }

    // Logged in but missing name -> onboarding
    const missingName = !profile?.full_name?.trim() && !profile?.display_name?.trim();
    if (missingName) {
      router.replace("/(onboarding)/profile");
      return;
    }
  }, [session, authLoading, profile, profileLoading]);

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
      <Stack.Screen name="trips/[tripId]/members" options={{ title: "Members" }} />
      <Stack.Screen name="trips/[tripId]/setup" options={{ title: "Trip Setup" }} />
      <Stack.Screen name="trips/[tripId]/invite" options={{ title: "Invite" }} />
      <Stack.Screen name="trips/[tripId]/poll" options={{ title: "Trip Poll" }} />
      <Stack.Screen
        name="trips/[tripId]/poll-results"
        options={{ title: "Poll Results" }}
      />
    </Stack>
  );
}
