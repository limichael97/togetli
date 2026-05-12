import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useProfile } from "../../lib/useProfile";
import { colors, radius } from "../../lib/theme";

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
        <View style={styles.profileCard}>
          <Text style={styles.eyebrow}>Account</Text>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.body}>Manage your account and app access.</Text>
        </View>

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
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 24,
    gap: 16,
  },
  profileCard: {
    padding: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
  },
  signOutButton: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutButtonText: {
    color: colors.primaryText,
    fontWeight: "700",
  },
  signOutButtonPressed: { opacity: 0.86 },
  signOutButtonDisabled: { opacity: 0.45 },
});
