import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { createTrip, type TripMode, type TripType } from "../../../lib/trips";
import { useAuthStore } from "../../../store/useAuthStore";
import { Screen } from "../../../components/ui/Screen";
import { AppInput } from "../../../components/ui/AppInput";
import { AppButton } from "../../../components/ui/AppButton";
import { colors, radius, spacing, typography } from "../../../lib/theme";

const TRIP_TYPE_OPTIONS: { label: string; value: TripType }[] = [
  { label: "Bachelor", value: "bachelor" },
  { label: "Bachelorette", value: "bachelorette" },
  { label: "Group Trip", value: "joint" },
];

const PLANNING_OPTIONS: { label: string; value: TripMode; description: string }[] = [
  {
    label: "Plan with Group",
    value: "poll",
    description: "Collect date and budget preferences before locking things in.",
  },
  {
    label: "Already Planned",
    value: "planned",
    description: "Skip the poll and use the trip for coordination.",
  },
];

export default function NewTripScreen() {
  const userId = useAuthStore((s) => s.userId);

  const [tripName, setTripName] = useState("");
  const [tripMode, setTripMode] = useState<TripMode>("poll");
  const [tripType, setTripType] = useState<TripType>("joint");
  const [loading, setLoading] = useState(false);

  const isValid = tripName.trim().length > 0;

  async function handleCreate() {
    if (!userId) {
      Alert.alert("Not signed in", "Please sign in first.");
      return;
    }

    if (!tripName.trim()) {
      Alert.alert("Missing trip name", "Please enter a trip name.");
      return;
    }

    setLoading(true);

    try {
      const trip = await createTrip({
        type: tripType,
        mode: tripMode,
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

      Alert.alert("Success", "Trip created!");

      router.replace(`/(tabs)/trips/${trip.id}/setup`);
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
      subtitle="Start with the trip name and choose whether the group needs to vote."
      footer={
        <AppButton
          label={loading ? "Creating..." : "Create Trip"}
          onPress={handleCreate}
          disabled={!isValid || loading}
        />
      }
    >
      <AppInput
        label="Trip name"
        placeholder="Las Vegas 2026"
        value={tripName}
        onChangeText={setTripName}
        editable={!loading}
      />

      <Text style={styles.label}>How are you planning this trip?</Text>
      <View style={styles.typeList}>
        {PLANNING_OPTIONS.map((option) => {
          const selected = tripMode === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => setTripMode(option.value)}
              disabled={loading}
              style={[styles.typeOption, selected && styles.typeOptionSelected]}
            >
              <Text style={[styles.typeOptionText, selected && styles.typeOptionTextSelected]}>
                {option.label}
              </Text>
              <Text
                style={[
                  styles.optionDescription,
                  selected ? styles.optionDescriptionSelected : null,
                ]}
              >
                {option.description}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.optionalLabel}>Optional: trip type</Text>
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
    marginBottom: 12,
  },
  optionalLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: 12,
  },
  typeList: {
    gap: spacing.md,
    marginBottom: 24,
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
  optionDescription: {
    ...typography.bodyMuted,
    marginTop: spacing.xs,
  },
  optionDescriptionSelected: {
    color: "rgba(255,255,255,0.82)",
  },
});
