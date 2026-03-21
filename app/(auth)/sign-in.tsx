import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Alert } from "react-native";
import { supabase } from "../../supabaseClient";
import { useLocalSearchParams, useRouter } from "expo-router";


export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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
      const { error } =
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

      if (inviteToken) {
        router.replace({ pathname: "/invite", params: { token: inviteToken } });
      } else {
        router.replace("/(app)/home");
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
  linkButton: { paddingVertical: 12 },
  linkText: { color: "#111", textAlign: "center", fontWeight: "500" },
});
