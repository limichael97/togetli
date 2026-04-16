import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Alert } from "react-native";
import { supabase } from "../../supabaseClient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { ensureProfileIdentity } from "../../lib/profile";

WebBrowser.maybeCompleteAuthSession();

function getOAuthRedirectUrl() {
  return makeRedirectUri({
    path: "auth-callback",
    native: "togetli://auth-callback",
  });
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

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");

  const router = useRouter();
  const params = useLocalSearchParams<{ inviteToken?: string }>();
  const inviteToken = Array.isArray(params.inviteToken)
    ? params.inviteToken[0]
    : params.inviteToken;


  const submit = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert("Missing email", "Enter your email first.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      Alert.alert("Invalid email", "Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Invalid password", "Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error } =
        mode === "sign-in"
          ? await supabase.auth.signInWithPassword({
              email: trimmedEmail,
              password,
            })
          : await supabase.auth.signUp({
              email: trimmedEmail,
              password,
            });
      if (error) {
        console.error("[auth] submit error", error);
        throw error;
      }

      const userId = authData.user?.id ?? authData.session?.user?.id;
      const userEmail = authData.user?.email ?? authData.session?.user?.email ?? trimmedEmail;
      if (userId) {
        await ensureProfileIdentity(userId, userEmail);
      }

      if (inviteToken) {
        router.replace({ pathname: "/invite", params: { token: inviteToken } });
      } else {
        router.replace("/(tabs)/trips");
      }

    } catch (e: any) {
      console.error("[auth] submit failed", {
        message: e?.message,
        status: e?.status,
        name: e?.name,
        stack: e?.stack,
        raw: e,
      });
      Alert.alert(
        mode === "sign-in" ? "Could not sign in" : "Could not sign up",
        e?.message ?? String(e)
      );
    } finally {
      setLoading(false);
    }
  };

  const continueWithGoogle = async () => {
    setGoogleLoading(true);
    try {
      const redirectTo = getOAuthRedirectUrl();
      console.log("[google-oauth] redirectTo:", redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) throw error;
      if (!data?.url) {
        throw new Error("Could not start Google sign in.");
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      console.log("[google-oauth] result.type:", result.type);
      console.log("[google-oauth] result.url:", "url" in result ? result.url ?? null : null);

      if (result.type === "cancel" || result.type === "dismiss") {
        return;
      }

      if (result.type === "success" && result.url) {
        const tokens = parseFragmentTokens(result.url);

        if (tokens) {
          console.log("[google-oauth] finalizing session with fragment tokens");
          console.log("[google-oauth] setSession start");
          const { error: sessionError } = await supabase.auth.setSession(tokens);
          console.log("[google-oauth] setSession done");
          console.log("[google-oauth] setSession error:", sessionError ?? null);
          if (sessionError) throw sessionError;
          return;
        }

        if (result.url.includes("code=")) {
          console.log("[google-oauth] finalizing session with code exchange");
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(result.url);
          console.log(
            "[google-oauth] exchangeCodeForSession error:",
            exchangeError ?? null,
          );
          if (exchangeError) throw exchangeError;
          return;
        }
      }

      console.log("[google-oauth] no session tokens found in auth result");
    } catch (e: any) {
      Alert.alert("Could not continue with Google", e?.message ?? String(e));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Togetli</Text>
      <Text style={styles.subtitle}>
        {mode === "sign-in"
          ? "Sign in with your email and password."
          : "Create an account with your email and password."}
      </Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Password (min 8 characters)"
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
        editable={!loading}
      />

      <Pressable style={styles.button} onPress={submit} disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? "Working..." : mode === "sign-in" ? "Sign in" : "Create account"}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
        onPress={continueWithGoogle}
        disabled={loading || googleLoading}
      >
        <Text style={styles.googleButtonText}>
          {googleLoading ? "Opening Google..." : "Continue with Google"}
        </Text>
      </Pressable>

      <Pressable
        style={styles.linkButton}
        onPress={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
        disabled={loading}
      >
        <Text style={styles.linkText}>
          {mode === "sign-in"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 80 },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#555", marginBottom: 32 },
  label: { fontSize: 14, fontWeight: "500", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 16,
  },
  button: { backgroundColor: "black", paddingVertical: 14, borderRadius: 999, marginTop: 8 },
  buttonText: { color: "white", textAlign: "center", fontWeight: "600", fontSize: 16 },
  googleButton: {
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "white",
    paddingVertical: 14,
    borderRadius: 999,
    marginTop: 12,
  },
  googleButtonText: {
    color: "#111",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 16,
  },
  buttonDisabled: { opacity: 0.7 },
  linkButton: { paddingVertical: 12 },
  linkText: { color: "#111", textAlign: "center", fontWeight: "500" },
});
