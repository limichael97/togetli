import {
  Stack,
  router,
  useRootNavigationState,
  useSegments,
} from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import * as Linking from "expo-linking";
import { supabase } from "../supabaseClient";
import { useAuthStore } from "../store/useAuthStore";
import { fetchMyProfile } from "../lib/profile";
import { colors } from "../lib/theme";

type GateState = "loading" | "auth" | "onboarding" | "app";
const PROFILE_FETCH_TIMEOUT_MS = 8000;

function isAuthCallbackUrl(url: string) {
  const parsed = Linking.parse(url);
  const path = (parsed.path ?? "").replace(/^--\//, "");
  return path === "auth-callback" || path.endsWith("/auth-callback");
}

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

function closeNewTripModal() {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace("/(tabs)/trips");
}

function AuthGate() {
  const initAuth = useAuthStore((s) => s.init);
  const session = useAuthStore((s) => s.session);
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const [gateState, setGateState] = useState<GateState>("loading");

  const setGateStateWithLog = (nextState: GateState, reason: string) => {
    console.log("[AuthGate] gateState ->", nextState, "| reason:", reason);
    setGateState(nextState);
  };

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
      console.log("[AuthGate] resolveGateState start", {
        hasSession: !!session,
        userId: session?.user?.id ?? null,
      });

      if (!session?.user?.id) {
        setGateStateWithLog("auth", "no session user id");
        return;
      }

      setGateStateWithLog("loading", `resolving profile for ${session.user.id}`);

      try {
        console.log("[AuthGate] fetchMyProfile start", {
          userId: session.user.id,
          timeoutMs: PROFILE_FETCH_TIMEOUT_MS,
        });

        const profileResult = await Promise.race([
          fetchMyProfile(session.user.id),
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error("fetchMyProfile timed out"));
            }, PROFILE_FETCH_TIMEOUT_MS);
          }),
        ]);

        const { data: profile, error } = profileResult;
        console.log("[AuthGate] fetchMyProfile resolved", {
          userId: session.user.id,
          hasProfile: !!profile,
          onboardingCompleted: profile?.onboarding_completed ?? null,
          errorCode: (error as { code?: string } | null)?.code ?? null,
          errorMessage: (error as { message?: string } | null)?.message ?? null,
        });

        if (error && (error as { code?: string }).code !== "PGRST116") {
          throw error;
        }

        setGateStateWithLog(
          profile?.onboarding_completed === true ? "app" : "onboarding",
          `profile resolved for ${session.user.id}`,
        );
        console.log("[AuthGate] resolveGateState done", {
          userId: session.user.id,
          target:
            profile?.onboarding_completed === true ? "app" : "onboarding",
        });
      } catch (error) {
        console.log("[AuthGate] profile gate failed", error);
        setGateStateWithLog("onboarding", "profile fetch failed");
      }
    };

    const handleAuthCallbackUrl = async (url: string) => {
      try {
        if (!isAuthCallbackUrl(url)) return;

        const tokens = parseFragmentTokens(url);
        if (tokens) {
          console.log("[AuthGate] callback setSession start");
          const { error } = await supabase.auth.setSession(tokens);
          console.log("[AuthGate] callback setSession done", {
            error: error ?? null,
          });
          if (error) throw error;
          return;
        }

        if (url.includes("code=")) {
          console.log("[AuthGate] callback exchangeCodeForSession start");
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          console.log("[AuthGate] callback exchangeCodeForSession done", {
            error: error ?? null,
          });
          if (error) throw error;
        }
      } catch (error: any) {
        console.log("[AuthGate] callback handling failed:", error?.message ?? error);
      }
    };

    (async () => {
      try {
        unsubAuth = await initAuth();
        console.log("[AuthGate] initAuth complete");
      } catch (error) {
        console.log("[AuthGate] initAuth failed", error);
      }

      const initialUrl = await Linking.getInitialURL();
      console.log("[AuthGate] initialUrl", initialUrl ?? null);
      if (initialUrl) {
        await handleAuthCallbackUrl(initialUrl);
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.log("[AuthGate] getSession failed", error);
      }
      console.log("[AuthGate] getSession resolved", {
        hasSession: !!data.session,
        userId: data.session?.user?.id ?? null,
      });
      await resolveGateState(data.session);

      const { data: authSub } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log("[AuthGate] onAuthStateChange", {
            event,
            userId: session?.user?.id ?? null,
          });
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
    let cancelled = false;

    const enforceGate = async () => {
      if (!rootNavigationState?.key || !targetHref || !targetRootSegment) return;
      if (gateState === "app" && currentRootSegment === "new-trip") return;
      if (currentRootSegment === targetRootSegment) return;

      console.log("[AuthGate] route mismatch detected", {
        currentRootSegment: currentRootSegment ?? null,
        targetRootSegment,
        targetHref,
        gateState,
        sessionUserId: session?.user?.id ?? null,
      });

      if (
        (gateState === "onboarding" || gateState === "app") &&
        session?.user?.id
      ) {
        const { data: freshProfile, error: freshProfileError } =
          await fetchMyProfile(session.user.id);

        if (cancelled) return;

        console.log("[AuthGate] route mismatch revalidation", {
          userId: session.user.id,
          freshProfile,
          freshProfileError: freshProfileError ?? null,
        });

        if (!freshProfileError) {
          const nextGateState =
            freshProfile?.onboarding_completed === true ? "app" : "onboarding";
          setGateStateWithLog(nextGateState, "route mismatch revalidation");

          if (
            (nextGateState === "app" && currentRootSegment === "(tabs)") ||
            (nextGateState === "onboarding" && currentRootSegment === "(onboarding)")
          ) {
            return;
          }

          router.replace(
            nextGateState === "app"
              ? "/(tabs)/trips"
              : "/(onboarding)/profile",
          );
          return;
        }
      }

      console.log("[AuthGate] enforcing route", { targetHref });
      router.replace(targetHref);
    };

    void enforceGate();

    return () => {
      cancelled = true;
    };
  }, [
    currentRootSegment,
    gateState,
    rootNavigationState?.key,
    session?.user?.id,
    targetHref,
    targetRootSegment,
  ]);

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
      >
        <Stack.Screen
          name="new-trip"
          options={{
            title: "New Trip",
            headerShown: true,
            presentation: "modal",
            animation: "slide_from_bottom",
            headerShadowVisible: false,
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTitleStyle: {
              fontSize: 17,
              fontWeight: "700",
              color: colors.text,
            },
            headerLeft: () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close new trip"
                onPress={closeNewTripModal}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed ? styles.closeButtonPressed : null,
                ]}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            ),
          }}
        />
      </Stack>
      <AuthGate />
    </>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  closeButtonPressed: {
    opacity: 0.72,
  },
});
