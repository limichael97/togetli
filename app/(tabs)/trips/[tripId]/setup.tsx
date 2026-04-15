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
  markPollSent,
  markTripPlanned,
  saveTripLength,
  upsertTripBudgetOptions,
  upsertTripDateOptions,
} from "../../../../lib/polls";
import type {
  TripBudgetOptionInput,
  TripDateOptionInput,
} from "../../../../lib/polls";
import { Screen } from "../../../../components/ui/Screen";
import { AppButton } from "../../../../components/ui/AppButton";
import { AppInput } from "../../../../components/ui/AppInput";
import { colors, radius, spacing, typography } from "../../../../lib/theme";

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

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function sortDateOptions(options: TripDateOptionInput[]) {
  return [...options].sort((a, b) => a.start_date.localeCompare(b.start_date));
}

function DateOptionItem({
  option,
  onRemove,
}: {
  option: TripDateOptionInput;
  onRemove: () => void;
}) {
  return (
    <View style={styles.dateOptionCard}>
      <View style={styles.dateOptionTextBlock}>
        <Text style={styles.dateOptionTitle}>{option.label?.trim() || "Date option"}</Text>
        <Text style={styles.dateOptionDates}>
          {option.start_date} to {option.end_date}
        </Text>
      </View>
      <Pressable
        onPress={onRemove}
        style={({ pressed }) => [
          styles.removeDateButton,
          pressed ? styles.removeDateButtonPressed : null,
        ]}
      >
        <Text style={styles.removeDateButtonText}>Remove</Text>
      </Pressable>
    </View>
  );
}

export default function TripSetupScreen() {
  const params = useLocalSearchParams();
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [lengthChoice, setLengthChoice] = useState<number | "custom">(3);
  const [customLength, setCustomLength] = useState("");
  const [dateOptions, setDateOptions] = useState<TripDateOptionInput[]>([]);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [showDateForm, setShowDateForm] = useState(false);
  const [dateFormError, setDateFormError] = useState<string | null>(null);

  const [selectedBudgetKeys, setSelectedBudgetKeys] = useState<string[]>([]);
  const [flightOptions, setFlightOptions] = useState<TripBudgetOptionInput[]>(BASE_FLIGHT_OPTIONS);
  const [lodgingOptions, setLodgingOptions] = useState<TripBudgetOptionInput[]>(BASE_LODGING_OPTIONS);
  const [canManageTrip, setCanManageTrip] = useState(false);
  const [tripMode, setTripMode] = useState<"poll" | "planned">("poll");
  const [existingFinalDates, setExistingFinalDates] = useState<{
    start: string | null;
    end: string | null;
  }>({ start: null, end: null });

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
        setCanManageTrip(member?.role === "creator" || member?.role === "planner");
        setTripMode(res.trip.mode === "planned" ? "planned" : "poll");
        setExistingFinalDates({
          start: res.trip.final_start_date,
          end: res.trip.final_end_date,
        });

        setDateOptions(
          sortDateOptions(
            res.dateOptions.map((d) => ({
              start_date: d.start_date,
              end_date: d.end_date,
              label: d.label,
            }))
          )
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
        setFlightOptions(
          mergeBudgetOptions(
            BASE_FLIGHT_OPTIONS,
            existingBudget.filter((b) => b.type === "flight")
          )
        );
        setLodgingOptions(
          mergeBudgetOptions(
            BASE_LODGING_OPTIONS,
            existingBudget.filter((b) => b.type === "lodging")
          )
        );
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

  const resolvedLength =
    lengthChoice === "custom" ? Number(customLength) : Number(lengthChoice);

  const selectedBudgets = useMemo(() => {
    const options = [...flightOptions, ...lodgingOptions];
    const selected = new Set(selectedBudgetKeys);
    return options.filter((o) => selected.has(budgetKey(o)));
  }, [flightOptions, lodgingOptions, selectedBudgetKeys]);

  const selectedFlightBudgets = selectedBudgets.filter((option) => option.type === "flight");
  const selectedLodgingBudgets = selectedBudgets.filter((option) => option.type === "lodging");

  const builderError =
    !resolvedLength || Number.isNaN(resolvedLength) || resolvedLength <= 0
      ? "Enter a valid trip length."
      : dateOptions.length === 0
        ? "Add at least one date option."
        : dateOptions.some(
              (option) =>
                !isValidDateInput(option.start_date) ||
                !isValidDateInput(option.end_date) ||
                option.end_date < option.start_date
            )
          ? "Fix invalid date options before continuing."
          : null;

  const toggleBudget = (option: TripBudgetOptionInput) => {
    const key = budgetKey(option);
    setSelectedBudgetKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const validateNewDateOption = () => {
    const start = newStart.trim();
    const end = newEnd.trim();
    const label = newLabel.trim();

    if (!start || !end) return "Enter both start and end dates.";
    if (!isValidDateInput(start) || !isValidDateInput(end)) {
      return "Use YYYY-MM-DD format for both dates.";
    }
    if (end < start) return "End date cannot be earlier than start date.";
    const duplicate = dateOptions.some(
      (option) =>
        option.start_date === start &&
        option.end_date === end &&
        (option.label?.trim() ?? "") === label
    );
    if (duplicate) return "That date range is already added.";
    return null;
  };

  const addDateOption = () => {
    const error = validateNewDateOption();
    if (error) {
      setDateFormError(error);
      return;
    }

    setDateFormError(null);
    setDateOptions((prev) =>
      sortDateOptions([
        ...prev,
        {
          start_date: newStart.trim(),
          end_date: newEnd.trim(),
          label: newLabel.trim(),
        },
      ])
    );
    setNewStart("");
    setNewEnd("");
    setNewLabel("");
    setShowDateForm(false);
  };

  const removeDateOption = (index: number) => {
    setDateOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const persistBuilder = async () => {
    if (!tripId) return;
    await saveTripLength(tripId, resolvedLength);
    await upsertTripDateOptions(tripId, dateOptions);
    await upsertTripBudgetOptions(tripId, selectedBudgets);
  };

  const handleOpenReview = async () => {
    if (builderError) {
      Alert.alert("Trip details incomplete", builderError);
      return;
    }

    try {
      setSaving(true);
      await persistBuilder();
      setReviewing(true);
    } catch (e: any) {
      Alert.alert("Save failed", e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSendPoll = async () => {
    if (!tripId) return;

    try {
      setSaving(true);
      await persistBuilder();
      await markPollSent(tripId);
      router.replace(`/(tabs)/trips/${tripId}/invite?sent=1`);
    } catch (e: any) {
      Alert.alert("Failed to send poll", e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizeTrip = async () => {
    if (!tripId) return;
    if (builderError) {
      Alert.alert("Trip details incomplete", builderError);
      return;
    }

    try {
      setSaving(true);
      await persistBuilder();
      const finalizedOption =
        existingFinalDates.start && existingFinalDates.end
          ? {
              start_date: existingFinalDates.start,
              end_date: existingFinalDates.end,
            }
          : sortDateOptions(dateOptions)[0] ?? null;

      await markTripPlanned({
        tripId,
        finalStartDate: finalizedOption?.start_date ?? null,
        finalEndDate: finalizedOption?.end_date ?? null,
      });
      router.replace(`/(tabs)/trips/${tripId}`);
    } catch (e: any) {
      Alert.alert("Failed to finalize trip", e?.message ?? String(e));
    } finally {
      setSaving(false);
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

  if (!canManageTrip) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Only planners and creators can edit trip setup.</Text>
      </View>
    );
  }

  const pageTitle = tripMode === "planned" ? "Finalize Trip" : "Build Poll";
  const primaryLabel = reviewing
    ? tripMode === "planned"
      ? "Finalize Trip"
      : "Send Poll"
    : "Continue";

  return (
    <Screen topInset="sm">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>{pageTitle}</Text>
        <Text style={styles.stepText}>
          {reviewing ? "Review" : "Setup"}
        </Text>

        {!reviewing ? (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Trip Length</Text>
              <Text style={styles.helperText}>Pick the length.</Text>
              <View style={styles.chipRow}>
                {LENGTH_OPTIONS.map((len) => (
                  <Pressable
                    key={len}
                    onPress={() => setLengthChoice(len)}
                    style={[styles.chip, lengthChoice === len ? styles.chipActive : null]}
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
                <AppInput
                  label="Custom trip length"
                  placeholder="Enter number of days"
                  keyboardType="number-pad"
                  value={customLength}
                  onChangeText={setCustomLength}
                />
              ) : null}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Dates</Text>
              <Text style={styles.helperText}>
                {tripMode === "planned" ? "Add the trip dates." : "Add the date options."}
              </Text>

              <Pressable
                onPress={() => setShowDateForm((v) => !v)}
                style={styles.textButton}
              >
                <Text style={styles.textButtonText}>
                  {showDateForm ? "Cancel" : "Add dates"}
                </Text>
              </Pressable>

              {showDateForm ? (
                <View style={styles.formCard}>
                  <Text style={styles.formTitle}>Add dates</Text>
                  <AppInput
                    label="Start date"
                    placeholder="YYYY-MM-DD"
                    value={newStart}
                    onChangeText={setNewStart}
                    autoCapitalize="none"
                  />
                  <AppInput
                    label="End date"
                    placeholder="YYYY-MM-DD"
                    value={newEnd}
                    onChangeText={setNewEnd}
                    autoCapitalize="none"
                  />
                  <AppInput
                    label="Label"
                    placeholder="Optional"
                    value={newLabel}
                    onChangeText={setNewLabel}
                  />
                  {dateFormError ? <Text style={styles.inlineError}>{dateFormError}</Text> : null}
                  <AppButton label="Add dates" onPress={addDateOption} />
                </View>
              ) : null}

              <View style={styles.dateOptionsSection}>
                {dateOptions.length === 0 ? (
                  <View style={styles.emptyStateCard}>
                    <Text style={styles.emptyStateTitle}>No dates yet</Text>
                    <Text style={styles.emptyStateBody}>
                      Add your first travel window.
                    </Text>
                  </View>
                ) : (
                  dateOptions.map((option, index) => (
                    <DateOptionItem
                      key={`${option.start_date}-${option.end_date}-${index}`}
                      option={option}
                      onRemove={() => removeDateOption(index)}
                    />
                  ))
                )}
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Budget</Text>
              <Text style={styles.helperText}>Optional guidance for the group.</Text>

              <Text style={styles.subTitle}>Flights</Text>
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

              <Text style={styles.subTitle}>Accommodation</Text>
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
            </View>

            {builderError ? <Text style={styles.inlineError}>{builderError}</Text> : null}
          </>
        ) : (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Review</Text>
              <Text style={styles.helperText}>
                {tripMode === "planned"
                  ? "Confirm the details."
                  : "Check the poll before you send it."}
              </Text>
              <View style={styles.reviewStatsRow}>
                <View style={styles.reviewStatCard}>
                  <Text style={styles.reviewStatValue}>{dateOptions.length}</Text>
                  <Text style={styles.reviewStatLabel}>Date options</Text>
                </View>
                <View style={styles.reviewStatCard}>
                  <Text style={styles.reviewStatValue}>{selectedBudgets.length}</Text>
                  <Text style={styles.reviewStatLabel}>Budget options</Text>
                </View>
              </View>
              <Text style={styles.reviewLead}>
                Trip length: {resolvedLength} day{resolvedLength === 1 ? "" : "s"}
              </Text>
              <Text style={styles.reviewLabel}>Dates</Text>
              {dateOptions.map((option, index) => (
                <Text key={`${option.start_date}-${index}`} style={styles.reviewLine}>
                  {option.label ? `${option.label}: ` : ""}
                  {option.start_date} → {option.end_date}
                </Text>
              ))}
              <Text style={styles.reviewLabel}>Budget guidance</Text>
              {selectedFlightBudgets.length === 0 && selectedLodgingBudgets.length === 0 ? (
                <Text style={styles.muted}>None selected</Text>
              ) : (
                <>
                  {selectedFlightBudgets.map((budget) => (
                    <Text key={`flight-${budgetKey(budget)}`} style={styles.reviewLine}>
                      FLIGHT: {budget.label}
                    </Text>
                  ))}
                  {selectedLodgingBudgets.map((budget) => (
                    <Text key={`lodging-${budgetKey(budget)}`} style={styles.reviewLine}>
                      LODGING: {budget.label}
                    </Text>
                  ))}
                </>
              )}
            </View>
          </>
        )}

        <View style={styles.footer}>
          {reviewing ? (
            <Pressable
              onPress={() => setReviewing(false)}
              style={styles.secondaryBtn}
              disabled={saving}
            >
              <Text style={styles.secondaryBtnText}>Back</Text>
            </Pressable>
          ) : tripMode === "poll" ? (
            <Pressable
              onPress={async () => {
                if (builderError) {
                  Alert.alert("Trip details incomplete", builderError);
                  return;
                }
                try {
                  setSaving(true);
                  await persistBuilder();
                  setTripMode("planned");
                  setReviewing(true);
                } catch (e: any) {
                  Alert.alert("Save failed", e?.message ?? String(e));
                } finally {
                  setSaving(false);
                }
              }}
              style={styles.secondaryBtn}
              disabled={saving}
            >
              <Text style={styles.secondaryBtnText}>Already Planned</Text>
            </Pressable>
          ) : (
            <View style={styles.footerSpacer} />
          )}

          <View style={styles.primaryAction}>
            <AppButton
              label={saving ? "Saving..." : primaryLabel}
              onPress={reviewing ? (tripMode === "planned" ? handleFinalizeTrip : handleSendPoll) : handleOpenReview}
              disabled={saving}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: {
    paddingBottom: spacing.xxl,
    paddingTop: 0,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  stepText: { ...typography.bodyMuted, marginBottom: spacing.sm },
  sectionCard: {
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ececec",
    backgroundColor: "#fff",
    marginBottom: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  helperText: {
    ...typography.bodyMuted,
    marginBottom: spacing.md,
  },
  subTitle: { color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm },
  muted: { ...typography.bodyMuted },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "500" as const },
  chipTextActive: { color: colors.onPrimary },
  textButton: {
    alignSelf: "flex-start",
    marginBottom: spacing.md,
  },
  textButtonText: {
    ...typography.label,
    color: colors.primary,
  },
  dateOptionsSection: { gap: spacing.sm },
  emptyStateCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyStateBody: {
    ...typography.bodyMuted,
  },
  dateOptionCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  dateOptionTextBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  dateOptionTitle: {
    ...typography.label,
    color: colors.text,
  },
  dateOptionDates: {
    ...typography.bodyMuted,
  },
  removeDateButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  removeDateButtonText: {
    ...typography.label,
    color: colors.text,
  },
  removeDateButtonPressed: { opacity: 0.7 },
  formCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "#fff",
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  formHelperText: {
    ...typography.bodyMuted,
    marginBottom: spacing.md,
  },
  inlineError: {
    color: "tomato",
    marginTop: spacing.sm,
  },
  reviewStatsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  reviewStatCard: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  reviewStatValue: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
  },
  reviewStatLabel: {
    ...typography.bodyMuted,
    marginTop: spacing.xs,
  },
  reviewLead: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  reviewLabel: {
    marginTop: spacing.sm,
    color: colors.textMuted,
  },
  reviewLine: { color: "#333", marginBottom: 4 },
  footer: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  footerSpacer: {
    flex: 1,
  },
  primaryAction: {
    flex: 1,
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eee",
  },
  secondaryBtnText: { fontWeight: "600" },
  error: { color: "tomato" },
});
