import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Alert } from "react-native";
import { supabase } from "../../supabaseClient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { ensureProfileIdentity } from "../../lib/profile";
import { colors, radius } from "../../lib/theme";

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
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to Togetli</Text>
        <Text style={styles.valueLine}>
          Plan trips with your group, without the chaos.
        </Text>
        <Text style={styles.subtitle}>
          {mode === "sign-in"
            ? "Sign in with your email and password."
            : "Create an account with your email and password."}
        </Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={colors.textSubtle}
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
          placeholderTextColor={colors.textSubtle}
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
          editable={!loading}
        />

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
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={submit}
          disabled={loading || googleLoading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Working..." : mode === "sign-in" ? "Sign in" : "Create account"}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 22,
    paddingTop: 78,
  },
  header: {
    marginBottom: 26,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  valueLine: { fontSize: 17, color: colors.text, marginBottom: 8, lineHeight: 24 },
  subtitle: { fontSize: 15, color: colors.textMuted, lineHeight: 21 },
  formCard: {
    padding: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: colors.text,
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  label: { fontSize: 13, fontWeight: "700", color: colors.text, marginBottom: 7 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 16,
    fontSize: 16,
    color: colors.text,
  },
  googleButton: {
    minHeight: 52,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.pill,
    marginTop: 8,
    justifyContent: "center",
  },
  googleButtonText: {
    color: colors.primaryText,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
  },
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 52,
    paddingVertical: 14,
    borderRadius: radius.pill,
    marginTop: 12,
    justifyContent: "center",
  },
  buttonText: { color: colors.text, textAlign: "center", fontWeight: "700", fontSize: 16 },
  buttonDisabled: { opacity: 0.55 },
  linkButton: { paddingVertical: 14, marginTop: 2 },
  linkText: { color: colors.text, textAlign: "center", fontWeight: "600" },
});
