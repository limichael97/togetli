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
import {
  getTripSetupData,
  listPollResponses,
  upsertPollResponse,
} from "../../../../lib/polls";
import { getTripStage } from "../../../../lib/tripState";

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
  const [isPolling, setIsPolling] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [isPlanner, setIsPlanner] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dateVoteCounts, setDateVoteCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!tripId) return;
    let mounted = true;

    (async () => {
      try {
        setErrorMsg(null);
        setLoading(true);
        const res = await getTripSetupData(tripId);
        const pollResponses = await listPollResponses(tripId);
        if (!mounted) return;
        setDateOptions(res.dateOptions);
        setBudgetOptions(res.budgetOptions);
        setIsPolling(getTripStage(res) === "polling");
        const member = res.members.find((m) => m.user_id === userId);
        setIsCreator(member?.role === "creator");
        setIsPlanner(member?.role === "planner");
        setIsGuest(member?.role === "guest");
        const counts: Record<string, number> = {};
        pollResponses.forEach((response) => {
          response.available_date_option_ids?.forEach((dateId) => {
            counts[dateId] = (counts[dateId] ?? 0) + 1;
          });
        });
        setDateVoteCounts(counts);
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
  const selectedCount = selectedDateIds.length;
  const canSubmitAvailability = selectedCount > 0 && !submitting;

  const handleSubmit = async () => {
    if (!tripId || !userId || selectedDateIds.length === 0) return;
    try {
      setSubmitting(true);
      await upsertPollResponse({
        tripId,
        userId,
        availableDateOptionIds: selectedDateIds,
        flightBudgetLabel: selectedFlightBudget?.label ?? null,
        lodgingBudgetLabel: selectedLodgingBudget?.label ?? null,
      });
      setSubmitted(true);
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

  if (!isPolling) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Poll not open yet.</Text>
      </View>
    );
  }

  const canRespondToPoll = isPlanner || isGuest;

  if (!canRespondToPoll) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Creators don’t fill out this poll.</Text>
      </View>
    );
  }

  if (submitted) {
    return (
      <View style={styles.centerCardWrap}>
        <View style={styles.confirmationCard}>
          <Text style={styles.confirmationTitle}>You're all set</Text>
          <Text style={styles.confirmationBody}>Waiting on others.</Text>
          <Pressable
            onPress={() => router.replace(`/(tabs)/trips/${tripId}`)}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed ? styles.primaryBtnPressed : null,
            ]}
          >
            <Text style={styles.primaryBtnText}>Back to Trip</Text>
          </Pressable>
        </View>
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
          <Text style={styles.helperText}>Select all dates that work for you.</Text>
          <View style={styles.dateCardList}>
            {dateOptions.map((d) => {
              const active = selectedDateIds.includes(d.id);
              const voteCount = dateVoteCounts[d.id] ?? 0;
              return (
                <Pressable
                  key={d.id}
                  onPress={() => toggleDate(d.id)}
                  style={[
                    styles.dateCard,
                    active ? styles.dateCardActive : null,
                  ]}
                >
                  <View style={styles.dateCardRow}>
                    <View style={styles.dateCardTextBlock}>
                      <Text
                        style={[
                          styles.dateCardTitle,
                          active ? styles.dateCardTitleActive : null,
                        ]}
                      >
                        {d.label ? `${d.label}: ` : ""}
                        {d.start_date} → {d.end_date}
                      </Text>
                      <Text
                        style={[
                          styles.dateCardVotes,
                          active ? styles.dateCardVotesActive : null,
                        ]}
                      >
                        {voteCount} vote{voteCount === 1 ? "" : "s"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.selectionBadge,
                        active ? styles.selectionBadgeActive : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectionBadgeText,
                          active ? styles.selectionBadgeTextActive : null,
                        ]}
                      >
                        {active ? "✓" : ""}
                      </Text>
                    </View>
                  </View>
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

        {step === 3 ? (
          <Text style={styles.selectionCount}>{selectedCount} selected</Text>
        ) : null}

        <Pressable
          onPress={() => (step === 3 ? handleSubmit() : setStep((s) => (s + 1) as 2 | 3))}
          style={[
            styles.primaryBtn,
            step === 3 && !canSubmitAvailability ? styles.primaryBtnDisabled : null,
          ]}
          disabled={step === 3 ? !canSubmitAvailability : submitting}
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
  centerCardWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  stepText: { color: "#666", marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  helperText: { color: "#666", marginBottom: 10, lineHeight: 20 },
  subTitle: { color: "#666", marginTop: 8, marginBottom: 6 },
  muted: { color: "#666" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dateCardList: { gap: 10 },
  dateCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  dateCardActive: {
    borderColor: "#111",
    backgroundColor: "#111",
  },
  dateCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  dateCardTextBlock: { flex: 1, gap: 4 },
  dateCardTitle: { color: "#111", fontWeight: "600", fontSize: 15, lineHeight: 20 },
  dateCardTitleActive: { color: "#fff" },
  dateCardVotes: { color: "#666", fontSize: 13 },
  dateCardVotesActive: { color: "rgba(255,255,255,0.78)" },
  selectionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d0d0d0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  selectionBadgeActive: {
    borderColor: "#fff",
    backgroundColor: "#fff",
  },
  selectionBadgeText: { color: "#fff", fontWeight: "700" },
  selectionBadgeTextActive: { color: "#111" },
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
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnPressed: { opacity: 0.82 },
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
  selectionCount: { color: "#666", fontWeight: "600" },
  reviewLine: { color: "#333", marginBottom: 4 },
  reviewLabel: { marginTop: 8, color: "#666" },
  confirmationCard: {
    width: "100%",
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ececec",
    backgroundColor: "#fff",
    gap: 12,
  },
  confirmationTitle: { fontSize: 24, fontWeight: "700", color: "#111" },
  confirmationBody: { color: "#666", fontSize: 15, lineHeight: 21 },
  error: { color: "tomato" },
});
