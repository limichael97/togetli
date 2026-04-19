import { useMemo, useState } from "react";
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

export default function OnboardingProfileScreen() {
  const guessedTz = useMemo(
    () => Localization.getCalendars()?.[0]?.timeZone ?? null,
    []
  );
  const [firstName, setFirstName] = useState("");
  const [loading, setLoading] = useState(false);
  const trimmedFirstName = firstName.trim();

  const save = async () => {
    const fullName = trimmedFirstName;

    if (!trimmedFirstName) {
      Alert.alert(
        "First name required",
        "Enter your first name so your group can recognize you."
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
    <Screen title="What should we call you?" topInset="sm">
      <View style={styles.content}>
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
            returnKeyType="done"
            onSubmitEditing={() => {
              if (!loading && trimmedFirstName) {
                void save();
              }
            }}
          />
        </View>

        <Pressable
          style={[
            styles.button,
            !trimmedFirstName || loading ? styles.buttonDisabled : null,
          ]}
          onPress={save}
          disabled={loading || !trimmedFirstName}
        >
          <Text
            style={[
              styles.buttonText,
              !trimmedFirstName || loading ? styles.buttonTextDisabled : null,
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
    paddingTop: 8,
    gap: 24,
  },
  formBlock: {
    gap: 8,
  },
  label: { fontSize: 14, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "black",
    borderRadius: 999,
    paddingVertical: 14,
  },
  buttonDisabled: {
    backgroundColor: "#e6e6e6",
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
  },
  buttonTextDisabled: {
    color: "#8b8b8b",
  },
});
