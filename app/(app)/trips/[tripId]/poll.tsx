import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthStore } from "../../../../store/useAuthStore";
import { getTripSetupData, upsertPollResponse } from "../../../../lib/polls";

export default function TripPollScreen() {
  const params = useLocalSearchParams();
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  const [dateOptions, setDateOptions] = useState<
    { id: string; start_date: string; end_date: string; label: string | null }[]
  >([]);
  const [budgetOptions, setBudgetOptions] = useState<
    { id: string; type: "flight" | "lodging"; label: string; is_any: boolean }[]
  >([]);
  const [selectedDateIds, setSelectedDateIds] = useState<string[]>([]);
  const [selectedFlightBudgetId, setSelectedFlightBudgetId] = useState<string | null>(null);
  const [selectedLodgingBudgetId, setSelectedLodgingBudgetId] = useState<string | null>(null);
  const [pollSent, setPollSent] = useState(false);
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
        setDateOptions(res.dateOptions);
        setBudgetOptions(res.budgetOptions);
        setPollSent(!!res.trip.poll_sent_at);
        const member = res.members.find((m) => m.user_id === userId);
        setIsCreator(member?.role === "creator");
      } catch (e: any) {
        if (mounted) setErrorMsg(e?.message ?? "Failed to load poll");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tripId, userId]);

  const toggleDate = (id: string) => {
    setSelectedDateIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const selectFlightBudget = (id: string) => {
    setSelectedFlightBudgetId((prev) => (prev === id ? null : id));
  };

  const selectLodgingBudget = (id: string) => {
    setSelectedLodgingBudgetId((prev) => (prev === id ? null : id));
  };

  const selectedDates = useMemo(
    () => dateOptions.filter((d) => selectedDateIds.includes(d.id)),
    [dateOptions, selectedDateIds]
  );

  const selectedFlightBudget = useMemo(
    () => budgetOptions.find((b) => b.id === selectedFlightBudgetId) ?? null,
    [budgetOptions, selectedFlightBudgetId]
  );

  const selectedLodgingBudget = useMemo(
    () => budgetOptions.find((b) => b.id === selectedLodgingBudgetId) ?? null,
    [budgetOptions, selectedLodgingBudgetId]
  );

  const handleSubmit = async () => {
    if (!tripId || !userId) return;
    try {
      setSubmitting(true);
      await upsertPollResponse({
        tripId,
        userId,
        availableDateOptionIds: selectedDateIds,
        flightBudgetLabel: selectedFlightBudget?.label ?? null,
        lodgingBudgetLabel: selectedLodgingBudget?.label ?? null,
      });
      router.replace(`/(app)/trips/${tripId}`);
    } catch (e: any) {
      Alert.alert("Submit failed", e?.message ?? String(e));
    } finally {
      setSubmitting(false);
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

  if (!pollSent) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Poll not sent yet.</Text>
      </View>
    );
  }

  if (isCreator) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Creators don’t fill out this poll.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.stepText}>Step {step} of 3</Text>
      <Text style={styles.title}>Trip Poll</Text>

      {step === 1 ? (
        <>
          <Text style={styles.sectionTitle}>Which weekends work for you?</Text>
          <View style={styles.chipRow}>
            {dateOptions.map((d) => {
              const active = selectedDateIds.includes(d.id);
              return (
                <Pressable
                  key={d.id}
                  onPress={() => toggleDate(d.id)}
                  style={[styles.chip, active ? styles.chipActive : null]}
                >
                  <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                    {d.label ? `${d.label}: ` : ""}
                    {d.start_date} → {d.end_date}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Text style={styles.sectionTitle}>What’s your comfortable budget?</Text>

          <Text style={styles.subTitle}>Flights</Text>
          <View style={styles.chipRow}>
            {budgetOptions
              .filter((b) => b.type === "flight")
              .map((b) => {
                const active = selectedFlightBudgetId === b.id;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => selectFlightBudget(b.id)}
                    style={[styles.chip, active ? styles.chipActive : null]}
                  >
                    <Text
                      style={[styles.chipText, active ? styles.chipTextActive : null]}
                    >
                      {b.label}
                    </Text>
                  </Pressable>
                );
              })}
          </View>

          <Text style={styles.subTitle}>Accommodation</Text>
          <View style={styles.chipRow}>
            {budgetOptions
              .filter((b) => b.type === "lodging")
              .map((b) => {
                const active = selectedLodgingBudgetId === b.id;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => selectLodgingBudget(b.id)}
                    style={[styles.chip, active ? styles.chipActive : null]}
                  >
                    <Text
                      style={[styles.chipText, active ? styles.chipTextActive : null]}
                    >
                      {b.label}
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

          <Text style={styles.reviewLabel}>Dates</Text>
          {selectedDates.length === 0 ? (
            <Text style={styles.muted}>None selected</Text>
          ) : (
            selectedDates.map((d) => (
              <Text key={d.id} style={styles.reviewLine}>
                {d.label ? `${d.label}: ` : ""}
                {d.start_date} → {d.end_date}
              </Text>
            ))
          )}

          <Text style={styles.reviewLabel}>Budget</Text>
          {!selectedFlightBudget && !selectedLodgingBudget ? (
            <Text style={styles.muted}>None selected</Text>
          ) : (
            <>
              <Text style={styles.reviewLine}>
                FLIGHT: {selectedFlightBudget?.label ?? "None selected"}
              </Text>
              <Text style={styles.reviewLine}>
                LODGING: {selectedLodgingBudget?.label ?? "None selected"}
              </Text>
            </>
          )}
        </>
      ) : null}

      <View style={styles.footer}>
        {step > 1 ? (
          <Pressable
            onPress={() => setStep((s) => (s === 2 ? 1 : 2))}
            style={styles.secondaryBtn}
            disabled={submitting}
          >
            <Text style={styles.secondaryBtnText}>Back</Text>
          </Pressable>
        ) : (
          <View />
        )}

        <Pressable
          onPress={() => (step === 3 ? handleSubmit() : setStep((s) => (s + 1) as 2 | 3))}
          style={styles.primaryBtn}
          disabled={submitting}
        >
          <Text style={styles.primaryBtnText}>
            {submitting ? "Submitting..." : step === 3 ? "Submit Availability" : "Next"}
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
  subTitle: { color: "#666", marginTop: 8, marginBottom: 6 },
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
  footer: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewLine: { color: "#333", marginBottom: 4 },
  reviewLabel: { marginTop: 8, color: "#666" },
  error: { color: "tomato" },
});