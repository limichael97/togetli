import { Stack, router } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "../../store/useAuthStore";
import { useProfile } from "../../lib/useProfile";

export default function OnboardingLayout() {
  const { session, loading: authLoading } = useAuthStore();
  const { profile, loading: profileLoading } = useProfile();

  useEffect(() => {
    if (authLoading || profileLoading) return;

    // Not logged in -> auth
    if (!session) {
      router.replace("/(auth)/sign-in");
      return;
    }

    // Profile complete -> app
    const complete = !!profile?.full_name?.trim() || !!profile?.display_name?.trim();
    if (complete) {
      router.replace("/(tabs)/trips");
      return;
    }
  }, [session, authLoading, profile, profileLoading]);

  return <Stack screenOptions={{ headerTitleAlign: "center" }} />;
}
