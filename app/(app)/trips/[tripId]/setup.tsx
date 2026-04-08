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
  saveTripLength,
  upsertTripBudgetOptions,
  upsertTripDateOptions,
} from "../../../../lib/polls";
import type { TripBudgetOptionInput, TripDateOptionInput } from "../../../../lib/polls";
import { Screen } from "../../../../components/ui/Screen";
import { AppButton } from "../../../../components/ui/AppButton";
import { AppInput } from "../../../../components/ui/AppInput";
import { colors, radius, spacing, typography } from "../../../../lib/theme";
import { countPendingTripInvites } from "../../../../lib/invites";

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

const STEP_LABELS = ["Trip Details", "Budget", "Review"] as const;

const STEP_CONTENT: Record<
  1 | 2 | 3,
  { eyebrow: string; title: string; description: string }
> = {
  1: {
    eyebrow: "Step 1 of 3",
    title: "Set up the poll",
    description: "Choose trip length and add date options.",
  },
  2: {
    eyebrow: "Step 2 of 3",
    title: "Add budget options",
    description: "Choose the ranges your group can vote on.",
  },
  3: {
    eyebrow: "Step 3 of 3",
    title: "Review and send",
    description: "Check the poll, then send it to the group.",
  },
};

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
  const [step, setStep] = useState<1 | 2 | 3>(1);
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
  const [isCreator, setIsCreator] = useState(false);
  const [activeNonCreatorMemberCount, setActiveNonCreatorMemberCount] = useState(0);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);

  useEffect(() => {
    if (!tripId) return;
    let mounted = true;

    (async () => {
      try {
        setErrorMsg(null);
        setLoading(true);
        const [res, inviteCount] = await Promise.all([
          getTripSetupData(tripId),
          countPendingTripInvites(tripId),
        ]);
        if (!mounted) return;

        const member = res.members.find((m) => m.user_id === userId);
        setIsCreator(member?.role === "creator");
        setActiveNonCreatorMemberCount(
          res.members.filter((m) => m.role !== "creator").length
        );
        setPendingInviteCount(inviteCount);

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

  const selectedFlightBudgets = useMemo(
    () => selectedBudgets.filter((option) => option.type === "flight"),
    [selectedBudgets]
  );

  const selectedLodgingBudgets = useMemo(
    () => selectedBudgets.filter((option) => option.type === "lodging"),
    [selectedBudgets]
  );

  const resolvedLength =
    lengthChoice === "custom" ? Number(customLength) : Number(lengthChoice);

  const invalidDateOption = dateOptions.find(
    (option) =>
      !isValidDateInput(option.start_date) ||
      !isValidDateInput(option.end_date) ||
      option.end_date < option.start_date
  );

  const stepOneError =
    !resolvedLength || Number.isNaN(resolvedLength) || resolvedLength <= 0
      ? "Enter a valid trip length."
      : dateOptions.length === 0
        ? "Add at least one date option."
        : invalidDateOption
          ? "Fix invalid date options before continuing."
          : null;

  const stepTwoError =
    selectedFlightBudgets.length === 0
      ? "Select at least one flight budget."
      : selectedLodgingBudgets.length === 0
        ? "Select at least one lodging budget."
        : null;

  const isCurrentStepValid =
    step === 1 ? !stepOneError : step === 2 ? !stepTwoError : true;
  const currentStepContent = STEP_CONTENT[step];
  const hasParticipantTargets =
    activeNonCreatorMemberCount > 0 || pendingInviteCount > 0;
  const sendBlockedMessage =
    "Add at least one non-creator member or create an invite before sending the poll.";
  const canSendPoll =
    step === 3 ? isCurrentStepValid && hasParticipantTargets : isCurrentStepValid;

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
        { start_date: newStart.trim(), end_date: newEnd.trim(), label: newLabel.trim() },
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

  const renderBudgetGroup = (
    title: string,
    options: TripBudgetOptionInput[]
  ) => (
    <View style={styles.budgetGroup}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.helperText}>Choose all options that feel realistic for your group.</Text>
      <View style={styles.chipRow}>
        {options.map((opt) => {
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
  );

  const handleNext = async () => {
    if (!tripId) return;

    if (step === 1) {
      if (stepOneError) {
        Alert.alert("Trip details incomplete", stepOneError);
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
      if (stepTwoError) {
        Alert.alert("Budget setup incomplete", stepTwoError);
        return;
      }
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
      if (!hasParticipantTargets) {
        Alert.alert("Can't send poll yet", sendBlockedMessage);
        return;
      }
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
    <Screen topInset="sm">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Build Poll</Text>
        <Text style={styles.stepText}>{currentStepContent.eyebrow}</Text>

        <View style={styles.stepIndicator}>
          {STEP_LABELS.map((label, index) => {
            const isActive = step === index + 1;
            const isComplete = step > index + 1;
            return (
              <View
                key={label}
                style={[
                  styles.stepChip,
                  isActive ? styles.stepChipActive : null,
                  isComplete ? styles.stepChipComplete : null,
                ]}
              >
                <Text
                  style={[
                    styles.stepChipText,
                    isActive ? styles.stepChipTextActive : null,
                    isComplete ? styles.stepChipTextComplete : null,
                  ]}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.stepTitle}>{currentStepContent.title}</Text>
        <Text style={styles.stepDescription}>{currentStepContent.description}</Text>

        {step === 1 ? (
          <>
            <Text style={styles.sectionTitle}>How long should the trip be?</Text>
            <Text style={styles.helperText}>Choose the expected trip length.</Text>
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
              <AppInput
                label="Custom trip length"
                placeholder="Enter number of days"
                keyboardType="number-pad"
                value={customLength}
                onChangeText={setCustomLength}
              />
            ) : null}

            <Text style={styles.sectionTitle}>Which date options should the group vote on?</Text>
            <Text style={styles.helperText}>Add the date ranges your group can vote on.</Text>
            <View style={styles.dateOptionsSection}>
              {dateOptions.length === 0 ? (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateTitle}>No date options yet</Text>
                  <Text style={styles.emptyStateBody}>
                    Add your first possible weekend or travel window.
                  </Text>
                </View>
              ) : (
                dateOptions.map((d, idx) => (
                  <DateOptionItem
                    key={`${d.start_date}-${d.end_date}-${idx}`}
                    option={d}
                    onRemove={() => removeDateOption(idx)}
                  />
                ))
              )}
            </View>

            <Pressable
              onPress={() => setShowDateForm((v) => !v)}
              style={styles.textButton}
            >
              <Text style={styles.textButtonText}>
                {showDateForm
                  ? "Cancel"
                  : dateOptions.length > 0
                    ? "Add another date option"
                    : "Add first date option"}
              </Text>
            </Pressable>

            {showDateForm ? (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>Add a date option</Text>
                <Text style={styles.formHelperText}>
                  Use YYYY-MM-DD, for example 2026-06-12.
                </Text>
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
                <AppButton label="Add date range" onPress={addDateOption} />
              </View>
            ) : null}
            {stepOneError ? <Text style={styles.inlineError}>{stepOneError}</Text> : null}
          </>
        ) : null}

        {step === 2 ? (
          <>
            {renderBudgetGroup("Flight budget", flightOptions)}
            {renderBudgetGroup("Accommodation budget", lodgingOptions)}
            {stepTwoError ? <Text style={styles.inlineError}>{stepTwoError}</Text> : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.sectionTitle}>Ready to send to the group</Text>
            <Text style={styles.helperText}>Your group will respond to this poll.</Text>
            <Text style={styles.helperText}>
              Targets: {activeNonCreatorMemberCount} joined, {pendingInviteCount} invite
              {pendingInviteCount === 1 ? "" : "s"} pending.
            </Text>
            {!hasParticipantTargets ? (
              <Text style={styles.inlineError}>{sendBlockedMessage}</Text>
            ) : null}
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
            <View style={styles.reviewCard}>
              <Text style={styles.reviewLead}>
                Trip length: {resolvedLength} day{resolvedLength === 1 ? "" : "s"}
              </Text>
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
              {selectedFlightBudgets.length === 0 && selectedLodgingBudgets.length === 0 ? (
                <Text style={styles.muted}>None selected</Text>
              ) : (
                <>
                  <Text style={styles.reviewLabel}>Flight</Text>
                  {selectedFlightBudgets.length === 0 ? (
                    <Text style={styles.muted}>None selected</Text>
                  ) : (
                    selectedFlightBudgets.map((b) => (
                      <Text key={`review-${budgetKey(b)}`} style={styles.reviewLine}>
                        {b.label}
                      </Text>
                    ))
                  )}
                  <Text style={styles.reviewLabel}>Accommodation</Text>
                  {selectedLodgingBudgets.length === 0 ? (
                    <Text style={styles.muted}>None selected</Text>
                  ) : (
                    selectedLodgingBudgets.map((b) => (
                      <Text key={`review-${budgetKey(b)}`} style={styles.reviewLine}>
                        {b.label}
                      </Text>
                    ))
                  )}
                </>
              )}
              <View style={styles.sendReadyCard}>
                <Text style={styles.sendReadyTitle}>What happens next</Text>
                <Text style={styles.sendReadyBody}>
                  The poll will be available in the trip right away.
                </Text>
              </View>
            </View>
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
            <View style={styles.footerSpacer} />
          )}

          <View style={styles.primaryAction}>
            <AppButton
              label={saving ? "Saving..." : step === 3 ? "Send to Group" : "Next"}
              onPress={handleNext}
              disabled={saving || !canSendPoll}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingBottom: spacing.xxl, paddingTop: 0 },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  stepText: { ...typography.bodyMuted, marginBottom: spacing.sm },
  stepIndicator: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  stepChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  stepChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepChipComplete: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  stepChipText: {
    ...typography.label,
    color: colors.textMuted,
  },
  stepChipTextActive: { color: colors.onPrimary },
  stepChipTextComplete: { color: colors.text },
  stepTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  stepDescription: {
    ...typography.bodyMuted,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  muted: { ...typography.bodyMuted },
  helperText: {
    ...typography.bodyMuted,
    marginBottom: spacing.sm,
  },
  dateOptionsSection: {
    gap: spacing.sm,
  },
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
  budgetGroup: { marginBottom: spacing.md },
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
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
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
  reviewCard: {
    marginTop: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  reviewStatsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  reviewStatCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  reviewStatValue: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
  },
  reviewStatLabel: {
    ...typography.bodyMuted,
    marginTop: spacing.xs,
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  secondaryBtnText: { ...typography.button, color: colors.text },
  textButton: { marginTop: spacing.md, alignSelf: "flex-start" },
  textButtonText: { ...typography.label, color: colors.text },
  reviewLead: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  reviewLine: { color: colors.text, marginBottom: spacing.xs },
  reviewLabel: { marginTop: spacing.sm, color: colors.textMuted },
  sendReadyCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background ?? "#f5f5f5",
  },
  sendReadyTitle: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sendReadyBody: {
    ...typography.bodyMuted,
  },
  inlineError: {
    color: "tomato",
    marginTop: spacing.sm,
  },
  footer: {
    marginTop: spacing.xl,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  footerSpacer: { flex: 1 },
  primaryAction: { flex: 1 },
  error: { color: "tomato" },
});
