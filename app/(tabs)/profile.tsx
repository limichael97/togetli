import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useProfile } from "../../lib/useProfile";

export default function ProfileScreen() {
  const { profile } = useProfile();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    try {
      setSigningOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/(auth)/sign-in");
    } catch (e: any) {
      Alert.alert("Sign out failed", e?.message ?? "Please try again.");
    } finally {
      setSigningOut(false);
    }
  }, []);

  const name =
    profile?.full_name?.trim() ||
    profile?.display_name?.trim() ||
    "Your profile";

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.body}>Manage your account and app access.</Text>

        <Pressable
          onPress={handleSignOut}
          disabled={signingOut}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && !signingOut ? styles.signOutButtonPressed : null,
            signingOut ? styles.signOutButtonDisabled : null,
          ]}
        >
          <Text style={styles.signOutButtonText}>
            {signingOut ? "Signing out..." : "Sign out"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f7f7",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: "#666",
    marginBottom: 24,
  },
  signOutButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#111",
    alignItems: "center",
  },
  signOutButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  signOutButtonPressed: { opacity: 0.82 },
  signOutButtonDisabled: { opacity: 0.45 },
});
