import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useProfile } from "../../lib/useProfile";
import { upsertMyProfile } from "../../lib/profile";
import { useAuthStore } from "../../store/useAuthStore";
import { colors, radius, spacing, typography } from "../../lib/theme";

export default function ProfileScreen() {
  const userId = useAuthStore((s) => s.userId);
  const { profile, refresh } = useProfile();
  const [signingOut, setSigningOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [homeAirport, setHomeAirport] = useState("");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile?.display_name?.trim() || profile?.full_name?.trim() || "");
    setHomeAirport(profile?.home_airport?.trim() || "");
  }, [profile]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setEmail(data.user?.email ?? null);
    });

    return () => {
      mounted = false;
    };
  }, []);

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
    profile?.display_name?.trim() ||
    profile?.full_name?.trim() ||
    "Your profile";
  const fullName = profile?.full_name?.trim() || "Not set yet";
  const emailLabel = email?.trim() || "Not available";
  const homeAirportLabel = profile?.home_airport?.trim() || "Not set yet";
  const canSave = !!userId && !saving;

  const handleSaveProfile = useCallback(async () => {
    if (!userId) return;

    try {
      setSaving(true);
      const nextDisplayName = displayName.trim() || null;
      const nextHomeAirport = homeAirport.trim().toUpperCase() || null;
      const { error } = await upsertMyProfile(userId, {
        display_name: nextDisplayName,
        home_airport: nextHomeAirport,
      });
      if (error) throw error;
      await refresh();
      setEditing(false);
    } catch (e: any) {
      Alert.alert("Could not save profile", e?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }, [displayName, homeAirport, refresh, userId]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Profile</Text>
        <Text style={styles.screenBody}>
          Keep the basics ready for planning trips with friends.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.eyebrow}>Account</Text>
          {!editing ? (
            <Pressable
              onPress={() => setEditing(true)}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed ? styles.buttonPressed : null,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Edit Profile</Text>
            </Pressable>
          ) : null}
        </View>
        {editing ? (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Display name</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={colors.textSubtle}
                autoCapitalize="words"
                style={styles.input}
              />
            </View>
            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => {
                  setEditing(false);
                  setDisplayName(profile?.display_name?.trim() || profile?.full_name?.trim() || "");
                  setHomeAirport(profile?.home_airport?.trim() || "");
                }}
                disabled={saving}
                style={({ pressed }) => [
                  styles.secondaryActionButton,
                  pressed && !saving ? styles.buttonPressed : null,
                  saving ? styles.disabled : null,
                ]}
              >
                <Text style={styles.secondaryActionText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveProfile}
                disabled={!canSave}
                style={({ pressed }) => [
                  styles.primaryActionButton,
                  pressed && canSave ? styles.buttonPressed : null,
                  !canSave ? styles.disabled : null,
                ]}
              >
                <Text style={styles.primaryActionText}>
                  {saving ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.detailList}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Display name</Text>
              <Text style={styles.detailValue}>{name}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Full name</Text>
              <Text style={styles.detailValue}>{fullName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{emailLabel}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Travel Basics</Text>
        {editing ? (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Home airport</Text>
            <TextInput
              value={homeAirport}
              onChangeText={setHomeAirport}
              placeholder="LAX"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={32}
              style={styles.input}
            />
          </View>
        ) : (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Home airport</Text>
            <Text style={styles.detailValue}>{homeAirportLabel}</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>App</Text>
        <Text style={styles.body}>Manage your session on this device.</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  screenTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 30,
  },
  screenBody: {
    ...typography.bodyMuted,
    lineHeight: 20,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
  },
  detailList: {
    gap: spacing.sm,
  },
  detailRow: {
    gap: 3,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  detailValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  form: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  secondaryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  primaryActionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionText: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  signOutButton: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  signOutButtonText: {
    color: colors.danger,
    fontWeight: "700",
  },
  buttonPressed: { opacity: 0.86 },
  signOutButtonPressed: { opacity: 0.86 },
  signOutButtonDisabled: { opacity: 0.45 },
  disabled: { opacity: 0.45 },
});
