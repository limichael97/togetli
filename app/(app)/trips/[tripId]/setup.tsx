import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthStore } from "../../../../store/useAuthStore";
import {
  getTripSetupData,
  markPollSent,
  saveTripLength,
  upsertTripBudgetOptions,
  upsertTripDateOptions,
} from "../../../../lib/polls";
import type { TripBudgetOptionInput, TripDateOptionInput } from "../../../../lib/polls";

const LENGTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

const BASE_FLIGHT_OPTIONS: TripBudgetOptionInput[] = [
  { type: "flight", label: "Under $300" },
  { type: "flight", label: "$300-$500" },
  { type: "flight", label: "$500-$800" },
  { type: "flight", label: "Whatever works", is_any: true },
];

const BASE_LODGING_OPTIONS: TripBudgetOptionInput[] = [
  { type: "lodging", label: "Under $200/night" },
  { type: "lodging", label: "$200-$350/night" },
  { type: "lodging", label: "$350+/night" },
  { type: "lodging", label: "Whatever works", is_any: true },
];

function budgetKey(option: TripBudgetOptionInput) {
  return `${option.type}:${option.label}:${option.is_any ? "any" : "std"}`;
}

function mergeBudgetOptions(
  base: TripBudgetOptionInput[],
  existing: TripBudgetOptionInput[]
) {
  const map = new Map<string, TripBudgetOptionInput>();
  base.forEach((o) => map.set(budgetKey(o), o));
  existing.forEach((o) => map.set(budgetKey(o), o));
  return Array.from(map.values());
}

export default function TripSetupScreen() {
  const params = useLocalSearchParams();
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  const [lengthChoice, setLengthChoice] = useState<number | "custom">(3);
  const [customLength, setCustomLength] = useState("");
  const [dateOptions, setDateOptions] = useState<TripDateOptionInput[]>([]);

  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [showDateForm, setShowDateForm] = useState(false);

  const [selectedBudgetKeys, setSelectedBudgetKeys] = useState<string[]>([]);
  const [flightOptions, setFlightOptions] = useState<TripBudgetOptionInput[]>(BASE_FLIGHT_OPTIONS);
  const [lodgingOptions, setLodgingOptions] = useState<TripBudgetOptionInput[]>(BASE_LODGING_OPTIONS);
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    let mounted = true;

    (async () => {
      try {
        setErrorMsg(null);
        setLoading(true);
        const res = await getTripSetupData(tripId);
        if (!mounted) return;

        const member = res.members.find((m) => m.user_id === userId);
        setIsCreator(member?.role === "creator");

        setDateOptions(
          res.dateOptions.map((d) => ({
            start_date: d.start_date,
            end_date: d.end_date,
            label: d.label,
          }))
        );

        if (res.trip.trip_length_days && res.trip.trip_length_days <= 7) {
          setLengthChoice(res.trip.trip_length_days as number);
          setCustomLength("");
        } else if (res.trip.trip_length_days) {
          setLengthChoice("custom");
          setCustomLength(String(res.trip.trip_length_days));
        }

        const existingBudget = res.budgetOptions.map((b) => ({
          type: b.type,
          label: b.label,
          is_any: b.is_any,
        }));
        const mergedFlights = mergeBudgetOptions(
          BASE_FLIGHT_OPTIONS,
          existingBudget.filter((b) => b.type === "flight")
        );
        const mergedLodging = mergeBudgetOptions(
          BASE_LODGING_OPTIONS,
          existingBudget.filter((b) => b.type === "lodging")
        );
        setFlightOptions(mergedFlights);
        setLodgingOptions(mergedLodging);
        setSelectedBudgetKeys(existingBudget.map(budgetKey));
      } catch (e: any) {
        if (mounted) setErrorMsg(e?.message ?? "Failed to load setup");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tripId, userId]);

  const selectedBudgets = useMemo(() => {
    const options = [...flightOptions, ...lodgingOptions];
    const set = new Set(selectedBudgetKeys);
    return options.filter((o) => set.has(budgetKey(o)));
  }, [flightOptions, lodgingOptions, selectedBudgetKeys]);

  const resolvedLength =
    lengthChoice === "custom" ? Number(customLength) : Number(lengthChoice);

  const toggleBudget = (option: TripBudgetOptionInput) => {
    const key = budgetKey(option);
    setSelectedBudgetKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const addDateOption = () => {
    if (!newStart.trim() || !newEnd.trim()) {
      Alert.alert("Missing dates", "Enter both start and end dates.");
      return;
    }
    setDateOptions((prev) => [
      ...prev,
      { start_date: newStart.trim(), end_date: newEnd.trim(), label: newLabel.trim() },
    ]);
    setNewStart("");
    setNewEnd("");
    setNewLabel("");
    setShowDateForm(false);
  };

  const removeDateOption = (index: number) => {
    setDateOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNext = async () => {
    if (!tripId) return;

    if (step === 1) {
      if (!resolvedLength || Number.isNaN(resolvedLength)) {
        Alert.alert("Invalid trip length", "Enter a valid number of days.");
        return;
      }
      try {
        setSaving(true);
        await saveTripLength(tripId, resolvedLength);
        await upsertTripDateOptions(tripId, dateOptions);
        setStep(2);
      } catch (e: any) {
        Alert.alert("Save failed", e?.message ?? String(e));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (step === 2) {
      try {
        setSaving(true);
        await upsertTripBudgetOptions(tripId, selectedBudgets);
        setStep(3);
      } catch (e: any) {
        Alert.alert("Save failed", e?.message ?? String(e));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (step === 3) {
      try {
        setSaving(true);
        await markPollSent(tripId);
        router.replace(`/(app)/trips/${tripId}`);
      } catch (e: any) {
        Alert.alert("Failed to send poll", e?.message ?? String(e));
      } finally {
        setSaving(false);
      }
    }
  };

  if (!tripId) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Missing trip id.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{errorMsg}</Text>
      </View>
    );
  }

  if (!isCreator) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Only the creator can edit trip setup.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.stepText}>Step {step} of 3</Text>
      <Text style={styles.title}>Trip Setup</Text>

      {step === 1 ? (
        <>
          <Text style={styles.sectionTitle}>Trip length</Text>
          <View style={styles.chipRow}>
            {LENGTH_OPTIONS.map((len) => (
              <Pressable
                key={len}
                onPress={() => setLengthChoice(len)}
                style={[
                  styles.chip,
                  lengthChoice === len ? styles.chipActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    lengthChoice === len ? styles.chipTextActive : null,
                  ]}
                >
                  {len} days
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setLengthChoice("custom")}
              style={[
                styles.chip,
                lengthChoice === "custom" ? styles.chipActive : null,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  lengthChoice === "custom" ? styles.chipTextActive : null,
                ]}
              >
                Custom
              </Text>
            </Pressable>
          </View>
          {lengthChoice === "custom" ? (
            <TextInput
              style={styles.input}
              placeholder="Enter number of days"
              keyboardType="number-pad"
              value={customLength}
              onChangeText={setCustomLength}
            />
          ) : null}

          <Text style={styles.sectionTitle}>Date options</Text>
          <View style={styles.chipRow}>
            {dateOptions.length === 0 ? (
              <Text style={styles.muted}>No dates yet.</Text>
            ) : (
              dateOptions.map((d, idx) => (
                <Pressable
                  key={`${d.start_date}-${d.end_date}-${idx}`}
                  onPress={() => removeDateOption(idx)}
                  style={styles.chip}
                >
                  <Text style={styles.chipText}>
                    {d.label ? `${d.label}: ` : ""}
                    {d.start_date} → {d.end_date}
                  </Text>
                </Pressable>
              ))
            )}
          </View>

          <Pressable
            onPress={() => setShowDateForm((v) => !v)}
            style={styles.textButton}
          >
            <Text style={styles.textButtonText}>
              {showDateForm ? "Cancel" : "Add Trip Date Range"}
            </Text>
          </Pressable>

          {showDateForm ? (
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Start date (YYYY-MM-DD)"
                value={newStart}
                onChangeText={setNewStart}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="End date (YYYY-MM-DD)"
                value={newEnd}
                onChangeText={setNewEnd}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Label (optional)"
                value={newLabel}
                onChangeText={setNewLabel}
              />
              <Pressable onPress={addDateOption} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Add date range</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Text style={styles.sectionTitle}>Flight budget</Text>
          <View style={styles.chipRow}>
            {flightOptions.map((opt) => {
              const active = selectedBudgetKeys.includes(budgetKey(opt));
              return (
                <Pressable
                  key={budgetKey(opt)}
                  onPress={() => toggleBudget(opt)}
                  style={[styles.chip, active ? styles.chipActive : null]}
                >
                  <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Accommodation budget</Text>
          <View style={styles.chipRow}>
            {lodgingOptions.map((opt) => {
              const active = selectedBudgetKeys.includes(budgetKey(opt));
              return (
                <Pressable
                  key={budgetKey(opt)}
                  onPress={() => toggleBudget(opt)}
                  style={[styles.chip, active ? styles.chipActive : null]}
                >
                  <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Text style={styles.sectionTitle}>Review</Text>
          <Text style={styles.reviewLine}>Trip length: {resolvedLength} days</Text>
          <Text style={styles.reviewLabel}>Date options</Text>
          {dateOptions.length === 0 ? (
            <Text style={styles.muted}>None</Text>
          ) : (
            dateOptions.map((d, idx) => (
              <Text key={`review-${idx}`} style={styles.reviewLine}>
                {d.label ? `${d.label}: ` : ""}
                {d.start_date} → {d.end_date}
              </Text>
            ))
          )}
          <Text style={styles.reviewLabel}>Budget options</Text>
          {selectedBudgets.length === 0 ? (
            <Text style={styles.muted}>None</Text>
          ) : (
            selectedBudgets.map((b) => (
              <Text key={`review-${budgetKey(b)}`} style={styles.reviewLine}>
                {b.type.toUpperCase()}: {b.label}
              </Text>
            ))
          )}
          <Text style={styles.muted}>Notes: (coming soon)</Text>
        </>
      ) : null}

      <View style={styles.footer}>
        {step > 1 ? (
          <Pressable
            onPress={() => setStep((s) => (s === 2 ? 1 : 2))}
            style={styles.secondaryBtn}
            disabled={saving}
          >
            <Text style={styles.secondaryBtnText}>Back</Text>
          </Pressable>
        ) : (
          <View />
        )}

        <Pressable onPress={handleNext} style={styles.primaryBtn} disabled={saving}>
          <Text style={styles.primaryBtnText}>
            {saving ? "Saving..." : step === 3 ? "Send Poll" : "Next"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  stepText: { color: "#666", marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  muted: { color: "#666" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  chipActive: { backgroundColor: "black", borderColor: "black" },
  chipText: { color: "#333", fontWeight: "500" },
  chipTextActive: { color: "white" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginTop: 8,
  },
  form: { marginTop: 8, gap: 8 },
  primaryBtn: {
    backgroundColor: "black",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnText: { color: "white", fontWeight: "600" },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eee",
  },
  secondaryBtnText: { fontWeight: "600" },
  textButton: { marginTop: 10 },
  textButtonText: { color: "#111", fontWeight: "600" },
  reviewLine: { color: "#333", marginBottom: 4 },
  reviewLabel: { marginTop: 8, color: "#666" },
  footer: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  error: { color: "tomato" },
});
