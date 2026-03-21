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

  return <Stack screenOptions={{ headerTitleAlign: "center" }} />;
}
