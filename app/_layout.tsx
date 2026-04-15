import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import * as Linking from "expo-linking";
import { supabase } from "../supabaseClient";
import { useAuthStore } from "../store/useAuthStore";

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

export default function RootLayout() {
  const initAuth = useAuthStore((s) => s.init);

  useEffect(() => {
    let unsubAuth: null | (() => void) = null;
    let unsubSession: null | (() => void) = null;
    let subUrl: { remove: () => void } | null = null;

    const handleMagicLinkUrl = async (url: string) => {
      try {
        // Example: togetli://auth-callback#access_token=...&refresh_token=...
        if (!url.includes("togetli://auth-callback")) return;

        console.log("[DeepLink handler] got:", url);

        const tokens = parseFragmentTokens(url);
        if (tokens) {
          const { error } = await supabase.auth.setSession({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
          });
          if (error) throw error;

          console.log("[DeepLink handler] session set ✅");
          router.replace("/(tabs)/trips");
          return;
        }

        // If you ever switch to PKCE code flow, this handles it:
        if (url.includes("code=")) {
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          if (error) throw error;

          console.log("[DeepLink handler] exchanged code ✅");
        router.replace("/(tabs)/trips");
          return;
        }

        console.log("[DeepLink handler] no usable tokens found");
      } catch (e: any) {
        console.log("[DeepLink handler] failed:", e?.message ?? e);
      }
    };

    const routeForSession = (session: { user?: unknown } | null) => {
      if (session?.user) {
        router.replace("/(tabs)/trips");
      } else {
        router.replace("/(auth)/sign-in");
      }
    };

    (async () => {
      // 1) init supabase auth listener/store
      try {
        unsubAuth = await initAuth();
        console.log("[RootLayout] initAuth done");
      } catch (e) {
        console.log("[RootLayout] initAuth failed", e);
      }

      // 2) route based on current session
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.log("[RootLayout] getSession failed", error);
      }
      routeForSession(data.session);

      // 3) respond to auth state changes
      const { data: authSub } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          routeForSession(session);
        }
      );
      unsubSession = () => authSub.subscription.unsubscribe();

      // 4) handle cold start URL (sometimes null because router consumes it, but try anyway)
      const initial = await Linking.getInitialURL();
      if (initial) await handleMagicLinkUrl(initial);

      // 5) handle URLs while app is running
      subUrl = Linking.addEventListener("url", ({ url }) => {
        handleMagicLinkUrl(url);
      });
    })();

    return () => {
      unsubAuth?.();
      unsubSession?.();
      subUrl?.remove?.();
    };
  }, [initAuth]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShadowVisible: false, headerTitleAlign: "center" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
