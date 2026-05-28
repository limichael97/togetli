import { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import * as Localization from "expo-localization";
import { router } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { supabase } from "../../supabaseClient";
import { fetchMyProfile, upsertMyProfile } from "../../lib/profile";
import { colors, radius, spacing } from "../../lib/theme";

export default function OnboardingProfileScreen() {
  const guessedTz = useMemo(
    () => Localization.getCalendars()?.[0]?.timeZone ?? null,
    []
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const lastNameInputRef = useRef<TextInput>(null);
  const trimmedFirstName = firstName.trim();
  const trimmedLastName = lastName.trim();
  const canContinue = !!trimmedFirstName && !!trimmedLastName && !loading;

  const save = async () => {
    const fullName = `${trimmedFirstName} ${trimmedLastName}`;

    if (!trimmedFirstName || !trimmedLastName) {
      Alert.alert(
        "Name required",
        "Enter your first and last name so your group can recognize you."
      );
      return;
    }

    setLoading(true);
    try {
      console.log("[onboarding-profile] submit start");
      const { data: u, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const userId = u.user?.id;
      if (!userId) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const payload = {
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
        full_name: fullName,
        display_name: trimmedFirstName,
        onboarding_completed: true,
        timezone: guessedTz,
      } as const;
      console.log("[onboarding-profile] saving payload", {
        userId,
        ...payload,
      });

      const { data: savedProfile, error } = await upsertMyProfile(userId, payload);
      console.log("[onboarding-profile] upsert result", {
        savedProfile,
        error: error ?? null,
      });
      if (error) throw error;

      const { data: confirmedProfile, error: confirmError } =
        await fetchMyProfile(userId);
      console.log("[onboarding-profile] confirmed profile", {
        confirmedProfile,
        confirmError: confirmError ?? null,
      });

      if (confirmError && (confirmError as { code?: string }).code !== "PGRST116") {
        throw confirmError;
      }

      if (confirmedProfile?.onboarding_completed !== true) {
        Alert.alert(
          "Could not finish setup",
          "Your profile did not save correctly. Please try again."
        );
        return;
      }

      console.log("[onboarding-profile] routing to tabs");
      router.replace("/(tabs)/trips");
    } catch (e: any) {
      console.log("[onboarding-profile] submit failed", {
        message: e?.message ?? String(e),
        code: e?.code ?? null,
        details: e?.details ?? null,
        hint: e?.hint ?? null,
        raw: e,
      });
      Alert.alert("Could not save profile", e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="What’s your name?" topInset="sm" safeAreaTop>
      <View style={styles.content}>
        <Text style={styles.helperText}>
          This helps friends recognize you in trips and polls.
        </Text>
        <View style={styles.formBlock}>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Michael"
            value={firstName}
            onChangeText={setFirstName}
            editable={!loading}
            autoCapitalize="words"
            autoFocus
            returnKeyType="next"
            onSubmitEditing={() => {
              if (!loading) {
                lastNameInputRef.current?.focus();
              }
            }}
          />
        </View>

        <View style={styles.formBlock}>
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            ref={lastNameInputRef}
            style={styles.input}
            placeholder="Chen"
            value={lastName}
            onChangeText={setLastName}
            editable={!loading}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={() => {
              if (canContinue) {
                void save();
              }
            }}
          />
        </View>

        <Pressable
          style={[
            styles.button,
            !canContinue ? styles.buttonDisabled : null,
          ]}
          onPress={save}
          disabled={!canContinue}
        >
          <Text
            style={[
              styles.buttonText,
              !canContinue ? styles.buttonTextDisabled : null,
            ]}
          >
            {loading ? "Saving..." : "Continue"}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
  },
  formBlock: {
    gap: spacing.sm,
  },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
  },
  buttonDisabled: {
    backgroundColor: colors.primaryMuted,
  },
  buttonText: {
    color: colors.primaryText,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
  },
  buttonTextDisabled: {
    color: colors.textSubtle,
  },
});
