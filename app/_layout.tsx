import {
  Stack,
  router,
  useRootNavigationState,
  useSegments,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import * as Linking from "expo-linking";
import { supabase } from "../supabaseClient";
import { useAuthStore } from "../store/useAuthStore";
import { fetchMyProfile } from "../lib/profile";

type GateState = "loading" | "auth" | "onboarding" | "app";

function parseFragmentTokens(url: string) {
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return null;

  const fragment = url.slice(hashIndex + 1);
  const params = new URLSearchParams(fragment);

  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");

  if (!access_token || !refresh_token) return null;

  return { access_token, refresh_token };
}

function LoadingOverlay() {
  return (
    <View style={styles.loadingOverlay}>
      <StatusBar style="dark" />
      <ActivityIndicator />
    </View>
  );
}

function AuthGate() {
  const initAuth = useAuthStore((s) => s.init);
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const [gateState, setGateState] = useState<GateState>("loading");

  const currentRootSegment = segments[0];
  const targetHref = useMemo(() => {
    if (gateState === "auth") return "/(auth)/sign-in";
    if (gateState === "onboarding") return "/(onboarding)/profile";
    if (gateState === "app") return "/(tabs)/trips";
    return null;
  }, [gateState]);
  const targetRootSegment = useMemo(() => {
    if (gateState === "auth") return "(auth)";
    if (gateState === "onboarding") return "(onboarding)";
    if (gateState === "app") return "(tabs)";
    return null;
  }, [gateState]);

  useEffect(() => {
    let active = true;
    let unsubAuth: null | (() => void) = null;
    let unsubSession: null | (() => void) = null;
    let subUrl: { remove: () => void } | null = null;

    const resolveGateState = async (
      session: { user?: { id: string } | null } | null,
    ) => {
      if (!active) return;

      if (!session?.user?.id) {
        setGateState("auth");
        return;
      }

      setGateState("loading");

      try {
        const { data: profile, error } = await fetchMyProfile(session.user.id);
        if (error && (error as { code?: string }).code !== "PGRST116") {
          throw error;
        }

        setGateState(
          profile?.onboarding_completed === true ? "app" : "onboarding",
        );
      } catch (error) {
        console.log("[AuthGate] profile gate failed", error);
        setGateState("onboarding");
      }
    };

    const handleAuthCallbackUrl = async (url: string) => {
      try {
        if (!url.includes("togetli://auth-callback")) return;

        const tokens = parseFragmentTokens(url);
        if (tokens) {
          const { error } = await supabase.auth.setSession(tokens);
          if (error) throw error;
          return;
        }

        if (url.includes("code=")) {
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          if (error) throw error;
        }
      } catch (error: any) {
        console.log("[AuthGate] callback handling failed:", error?.message ?? error);
      }
    };

    (async () => {
      try {
        unsubAuth = await initAuth();
      } catch (error) {
        console.log("[AuthGate] initAuth failed", error);
      }

      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await handleAuthCallbackUrl(initialUrl);
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.log("[AuthGate] getSession failed", error);
      }
      await resolveGateState(data.session);

      const { data: authSub } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          await resolveGateState(session);
        },
      );
      unsubSession = () => authSub.subscription.unsubscribe();

      subUrl = Linking.addEventListener("url", ({ url }) => {
        void handleAuthCallbackUrl(url);
      });
    })();

    return () => {
      active = false;
      unsubAuth?.();
      unsubSession?.();
      subUrl?.remove?.();
    };
  }, [initAuth]);

  useEffect(() => {
    if (!rootNavigationState?.key || !targetHref || !targetRootSegment) return;
    if (currentRootSegment === targetRootSegment) return;
    router.replace(targetHref);
  }, [currentRootSegment, rootNavigationState?.key, targetHref, targetRootSegment]);

  if (gateState === "loading") {
    return <LoadingOverlay />;
  }

  return null;
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
      <AuthGate />
    </>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
});
