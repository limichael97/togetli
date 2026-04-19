import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import {
  createTrip,
  TRIP_TYPE_OPTIONS,
  type TripType,
} from "../../../lib/trips";
import { useAuthStore } from "../../../store/useAuthStore";
import { Screen } from "../../../components/ui/Screen";
import { AppInput } from "../../../components/ui/AppInput";
import { AppButton } from "../../../components/ui/AppButton";
import { colors, radius, spacing, typography } from "../../../lib/theme";

export default function NewTripScreen() {
  const userId = useAuthStore((s) => s.userId);

  const [tripName, setTripName] = useState("");
  const [tripType, setTripType] = useState<TripType | null>(null);
  const [loading, setLoading] = useState(false);

  const isValid = tripName.trim().length > 0 && !!tripType;

  async function handleCreate() {
    if (!userId) {
      Alert.alert("Not signed in", "Please sign in first.");
      return;
    }

    if (!tripName.trim()) {
      Alert.alert("Missing trip name", "Please enter a trip name.");
      return;
    }
    if (!tripType) {
      Alert.alert("Select trip type", "Choose the trip type before continuing.");
      return;
    }

    setLoading(true);

    try {
      const trip = await createTrip({
        type: tripType,
        mode: "poll",
        title: tripName.trim(),
        tripLengthDays: 3,
        planningMode: "planner_decides",
        hideFromCreator: false,
        notes: "Created from app",
        dateOptions: [],
        flightBudgetLabels: [],
        lodgingBudgetLabels: [],
        customQuestions: [],
      });
      router.replace(`/(tabs)/trips/${trip.id}`);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error creating trip", err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      title="Create a Trip"
      topInset="sm"
      footer={
        <AppButton
          label={loading ? "Creating..." : "Create Trip"}
          onPress={handleCreate}
          disabled={!isValid || loading}
        />
      }
    >
      <AppInput
        label="Trip Name"
        placeholder="e.g. Vegas 2026, Miami Bach, Tahoe Trip"
        value={tripName}
        onChangeText={setTripName}
        editable={!loading}
      />

      <Text style={styles.label}>What Kind Of Trip Is This?</Text>
      <View style={styles.typeList}>
        {TRIP_TYPE_OPTIONS.map((option) => {
          const selected = tripType === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => setTripType(option.value)}
              disabled={loading}
              style={[styles.typeOption, selected && styles.typeOptionSelected]}
            >
              <Text style={[styles.typeOptionText, selected && styles.typeOptionTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.label,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: 12,
  },
  typeList: {
    gap: spacing.md,
  },
  typeOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  typeOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeOptionText: {
    ...typography.button,
    color: colors.text,
  },
  typeOptionTextSelected: {
    color: colors.onPrimary,
  },
});
