import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { createTrip, type TripType } from "../../../lib/trips";
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

export default function NewTripScreen() {
  const userId = useAuthStore((s) => s.userId);

  const [tripName, setTripName] = useState("");
  const [tripType, setTripType] = useState<TripType | null>(null);
  const [loading, setLoading] = useState(false);

  const isValid = tripName.trim().length > 0 && tripType !== null;

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
      Alert.alert("Select trip type", "Please choose what kind of event this is.");
      return;
    }

    setLoading(true);

    try {
      const trip = await createTrip({
        type: tripType,
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

      router.push(`/(app)/trips/${trip.id}`);
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
      subtitle="Start by naming the trip and choosing what kind of event it is."
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

      <Text style={styles.label}>What kind of trip is this?</Text>

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
    marginBottom: 24,
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
});
