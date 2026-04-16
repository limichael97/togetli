import { useEffect, useState } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { supabase } from "../supabaseClient";
import { ensureProfileIdentity, fetchMyProfile } from "../lib/profile";

function parseFragment(url: string) {
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) return {};
  const fragment = url.slice(hashIndex + 1);
  const params = new URLSearchParams(fragment);
  return {
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
  };
}

export default function AuthCallbackScreen() {
  const url = Linking.useURL();
  const [status, setStatus] = useState("Signing you in…");

  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let lastUrl: string | null = null;

    const handle = async (incomingUrl: string) => {
      if (!incomingUrl || incomingUrl === lastUrl) return;
      lastUrl = incomingUrl;
      try {
        console.log("[auth-callback] url:", incomingUrl);
        setStatus("Establishing session…");

        // 1) Establish session
        const frag = parseFragment(incomingUrl);

        if (frag.access_token && frag.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: frag.access_token,
            refresh_token: frag.refresh_token,
          });
          if (error) throw error;
        } else if (incomingUrl.includes("code=")) {
          const { error } =
            await supabase.auth.exchangeCodeForSession(incomingUrl);
          if (error) throw error;
        } else {
          throw new Error("No auth tokens found in callback URL.");
        }

        setStatus("Loading profile…");

        // 2) Decide where to go next
        const { data: u, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        const userId = u.user?.id;
        if (!userId) {
          router.replace("/(auth)/sign-in");
          return;
        }

        const metadata = u.user?.user_metadata ?? {};
        const fullName =
          typeof metadata.full_name === "string"
            ? metadata.full_name
            : typeof metadata.name === "string"
              ? metadata.name
              : null;
        const displayName =
          typeof metadata.given_name === "string"
            ? metadata.given_name
            : typeof metadata.display_name === "string"
              ? metadata.display_name
              : null;

        await ensureProfileIdentity(userId, u.user?.email, {
          fullName,
          displayName,
        });

        const { data: profile, error: profileErr } =
          await fetchMyProfile(userId);

        if (profileErr) throw profileErr;

        router.replace(
          profile?.onboarding_completed === true
            ? "/(tabs)/trips"
            : "/(onboarding)/profile",
        );
      } catch (e: any) {
        console.log("[auth-callback] failed:", e?.message ?? e);
        setStatus("Sign-in failed. Returning to sign-in…");
        setTimeout(() => router.replace("/(auth)/sign-in"), 600);
      }
    };

    (async () => {
      // Cold start
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) await handle(initialUrl);

      // Warm start
      sub = Linking.addEventListener("url", ({ url }) => {
        handle(url);
      });

      // Also attempt the hook URL
      if (url) await handle(url);
    })();

    return () => sub?.remove?.();
  }, [url]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
      <Text style={{ marginTop: 12 }}>{status}</Text>
    </View>
  );
}
