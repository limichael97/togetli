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
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthStore } from "../../../../store/useAuthStore";
import {
  hasAvailabilityPollResponse,
  getMyPollResponse,
  getTripSetupData,
  listPollResponseDetails,
  parseStayPollDefinition,
  parseStayPollRankings,
  type StayPollDefinition,
  type StayPollRankings,
  upsertPollResponse,
} from "../../../../lib/polls";
import { getTripStage } from "../../../../lib/tripState";

const STAY_RANK_FIELDS = [
  "first_choice_note_id",
  "second_choice_note_id",
  "third_choice_note_id",
] as const;

const STAY_RANK_LABELS: Record<(typeof STAY_RANK_FIELDS)[number], string> = {
  first_choice_note_id: "1st",
  second_choice_note_id: "2nd",
  third_choice_note_id: "3rd",
};

function normalizeLink(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getLinkTypeLabel(link: string | null) {
  const normalized = normalizeLink(link)?.toLowerCase() ?? "";
  if (!normalized) return "Link";
  if (normalized.includes("tiktok.com")) return "TikTok";
  if (normalized.includes("instagram.com")) return "Instagram";
  if (normalized.includes("airbnb.")) return "Airbnb";
  return "Link";
}

function formatStayPriceSummary(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/[$,\s]/g, "");
  if (/^\d+(\.\d+)?$/.test(normalized)) {
    const amount = Number(normalized);
    if (Number.isFinite(amount)) {
      const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
      });
      return `${formatter.format(amount)} total`;
    }
  }

  return trimmed;
}

function getStaySummaryItems(option: {
  total_price?: string | null;
  beds?: string | null;
  bedrooms?: string | null;
  bathrooms?: string | null;
  location?: string | null;
  note?: string | null;
}) {
  const items: string[] = [];
  const price = formatStayPriceSummary(option.total_price);
  if (price) items.push(price);
  if (option.beds?.trim()) items.push(`${option.beds.trim()} beds`);
  if (option.bedrooms?.trim()) items.push(`${option.bedrooms.trim()} bedrooms`);
  if (option.bathrooms?.trim()) items.push(`${option.bathrooms.trim()} bathrooms`);
  if (option.location?.trim()) items.push(option.location.trim());
  if (option.note?.trim()) items.push(option.note.trim());
  return items;
}

export default function TripPollScreen() {
  const params = useLocalSearchParams();
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const requestedPollKind = Array.isArray(params.pollKind)
    ? params.pollKind[0]
    : params.pollKind;
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);

  const [dateOptions, setDateOptions] = useState<
    { id: string; start_date: string; end_date: string; label: string | null }[]
  >([]);
  const [selectedDateIds, setSelectedDateIds] = useState<string[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [activeRole, setActiveRole] = useState<"creator" | "planner" | "guest" | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [isPlanner, setIsPlanner] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dateVoteCounts, setDateVoteCounts] = useState<Record<string, number>>({});
  const [stayPollDefinition, setStayPollDefinition] = useState<StayPollDefinition | null>(null);
  const [stayRankings, setStayRankings] = useState<StayPollRankings>({
    first_choice_note_id: null,
    second_choice_note_id: null,
    third_choice_note_id: null,
  });
  const [hasExistingStayResponse, setHasExistingStayResponse] = useState(false);
  const [existingResponse, setExistingResponse] = useState<Awaited<
    ReturnType<typeof getMyPollResponse>
  > | null>(null);
  const [hasExistingAvailabilityResponse, setHasExistingAvailabilityResponse] =
    useState(false);

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
        setIsPolling(getTripStage(res) === "polling");
        const stayDefinition = parseStayPollDefinition(
          res.trip.custom_poll_questions
        );
        setStayPollDefinition(stayDefinition);
        const member = res.members.find((m) => m.user_id === userId);
        setActiveRole(member?.role ?? null);
        setIsCreator(member?.role === "creator");
        setIsPlanner(member?.role === "planner");
        setIsGuest(member?.role === "guest");
        const existingResponse = userId
          ? await getMyPollResponse(tripId, userId)
          : null;
        if (!mounted) return;
        setExistingResponse(existingResponse);
        setHasExistingAvailabilityResponse(
          hasAvailabilityPollResponse(existingResponse)
        );
        setSelectedDateIds(existingResponse?.available_date_option_ids ?? []);

        if (stayDefinition) {
          const parsedRankings = parseStayPollRankings(
            existingResponse?.custom_poll_answers ?? null
          );
          setStayRankings(parsedRankings);
          setHasExistingStayResponse(
            !!parsedRankings.first_choice_note_id ||
              !!parsedRankings.second_choice_note_id ||
              !!parsedRankings.third_choice_note_id
          );
          setDateVoteCounts({});
        } else {
          const eligibleVotingUserIds = new Set(
            res.members
              .filter((tripMember) => tripMember.role !== "creator")
              .map((tripMember) => tripMember.user_id)
          );
          const pollResponses = await listPollResponseDetails(tripId);
          if (!mounted) return;
          const counts: Record<string, number> = {};
          pollResponses.forEach((response) => {
            if (!response.user_id || !eligibleVotingUserIds.has(response.user_id)) return;
            response.available_date_option_ids?.forEach((dateId) => {
              counts[dateId] = (counts[dateId] ?? 0) + 1;
            });
          });
          setDateVoteCounts(counts);
        }
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

  const selectedDates = useMemo(
    () => dateOptions.filter((d) => selectedDateIds.includes(d.id)),
    [dateOptions, selectedDateIds]
  );

  const selectedCount = selectedDateIds.length;
  const canSubmitAvailability = selectedCount > 0 && !submitting;
  const activePollKind =
    requestedPollKind === "availability" || requestedPollKind === "stay"
      ? requestedPollKind
      : stayPollDefinition
        ? "stay"
        : "availability";
  const isStayPoll = activePollKind === "stay" && !!stayPollDefinition;
  const canRespondToStayPoll = !!activeRole;
  const stayPollValidationError = !stayRankings.first_choice_note_id
    ? "Select your 1st choice before submitting."
    : null;

  const assignStayRank = (
    noteId: string,
    field: (typeof STAY_RANK_FIELDS)[number]
  ) => {
    setStayRankings((current) => {
      const next: StayPollRankings = {
        first_choice_note_id:
          current.first_choice_note_id === noteId ? null : current.first_choice_note_id,
        second_choice_note_id:
          current.second_choice_note_id === noteId ? null : current.second_choice_note_id,
        third_choice_note_id:
          current.third_choice_note_id === noteId ? null : current.third_choice_note_id,
      };

      next[field] = current[field] === noteId ? null : noteId;
      return next;
    });
  };

  const getAssignedRank = (noteId: string) => {
    return STAY_RANK_FIELDS.find((field) => stayRankings[field] === noteId) ?? null;
  };

  const handleOpenStayLink = async (value: string | null) => {
    const normalized = normalizeLink(value);
    if (!normalized) return;

    try {
      await Linking.openURL(normalized);
    } catch (e: any) {
      Alert.alert("Couldn't open link", e?.message ?? String(e));
    }
  };

  const handleSubmit = async () => {
    if (!tripId || !userId || selectedDateIds.length === 0) return;
    try {
      setSubmitting(true);
      await upsertPollResponse({
        tripId,
        userId,
        availableDateOptionIds: selectedDateIds,
        flightBudgetLabel: null,
        lodgingBudgetLabel: null,
        customPollAnswers:
          existingResponse?.custom_poll_answers &&
          typeof existingResponse.custom_poll_answers === "object" &&
          !Array.isArray(existingResponse.custom_poll_answers)
            ? (existingResponse.custom_poll_answers as Record<string, unknown>)
            : {},
      });
      setHasExistingAvailabilityResponse(true);
      setSubmitted(true);
    } catch (e: any) {
      Alert.alert("Submit failed", e?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitStayVote = async () => {
    if (!tripId || !userId) return;
    if (stayPollValidationError) {
      Alert.alert("Stay ranking incomplete", stayPollValidationError);
      return;
    }

    try {
      setSubmitting(true);
      await upsertPollResponse({
        tripId,
        userId,
        availableDateOptionIds: existingResponse?.available_date_option_ids ?? [],
        flightBudgetLabel: existingResponse?.flight_budget_label ?? null,
        lodgingBudgetLabel: existingResponse?.lodging_budget_label ?? null,
        customPollAnswers: {
          poll_type: "stay",
          stay_rankings: stayRankings,
        },
      });
      setHasExistingStayResponse(true);
      Alert.alert(
        hasExistingStayResponse
          ? "Stay vote updated"
          : "Stay vote saved",
        "Your rankings have been saved.",
        [
          {
            text: "Back to Trip",
            onPress: () => router.replace(`/(tabs)/trips/${tripId}`),
          },
          isCreator || isPlanner
            ? {
                text: "View Results",
                onPress: () =>
                  router.replace(
                    `/(tabs)/trips/${tripId}/poll-results?pollKind=stay`
                  ),
              }
            : {
                text: "Stay Poll",
                style: "cancel",
              },
        ]
      );
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

  if (activePollKind === "stay" && !stayPollDefinition) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Stay poll not open yet.</Text>
      </View>
    );
  }

  if (isStayPoll) {
    if (!canRespondToStayPoll) {
      return (
        <View style={styles.center}>
          <Text style={styles.error}>Only active trip members can vote on this stay poll.</Text>
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.stepText}>
          {stayPollDefinition.subtitle}
        </Text>
        <Text style={styles.title}>{stayPollDefinition.title}</Text>
        <Text style={styles.helperText}>
          Rank your top 3 stay options. Your 1st choice is required. 2nd and 3rd
          are optional.
        </Text>

        {hasExistingStayResponse ? (
          <View style={styles.stayStatusCard}>
            <Text style={styles.stayStatusTitle}>Your vote is editable</Text>
            <Text style={styles.stayStatusBody}>
              Update your rankings anytime while the stay poll is open.
            </Text>
          </View>
        ) : null}

        <View style={styles.stayOptionList}>
          {stayPollDefinition.options.map((option) => {
            const assignedRank = getAssignedRank(option.source_note_id);
            const summaryItems = getStaySummaryItems(option);
            const normalizedLink = normalizeLink(option.link);

            return (
              <View key={option.source_note_id} style={styles.stayVoteCard}>
                <View style={styles.stayVoteHeader}>
                  <View style={styles.stayVoteHeaderText}>
                    <Text style={styles.stayVoteTitle}>{option.title}</Text>
                    {assignedRank ? (
                      <Text style={styles.stayVoteAssigned}>
                        {STAY_RANK_LABELS[assignedRank]} choice
                      </Text>
                    ) : (
                      <Text style={styles.stayVoteAssignedMuted}>
                        Not ranked yet
                      </Text>
                    )}
                  </View>
                  {normalizedLink ? (
                    <Pressable
                      onPress={() => handleOpenStayLink(option.link)}
                      style={({ pressed }) => [
                        styles.linkMiniButton,
                        pressed ? styles.linkMiniButtonPressed : null,
                      ]}
                    >
                      <Text style={styles.linkMiniButtonText}>View</Text>
                    </Pressable>
                  ) : null}
                </View>

                {normalizedLink ? (
                  <View style={styles.stayLinkRow}>
                    <View style={styles.staySourceBadge}>
                      <Text style={styles.staySourceBadgeText}>
                        {getLinkTypeLabel(option.link)}
                      </Text>
                    </View>
                    <Text
                      style={styles.stayLinkValue}
                      numberOfLines={1}
                      ellipsizeMode="middle"
                    >
                      {normalizedLink}
                    </Text>
                  </View>
                ) : null}

                {summaryItems.length > 0 ? (
                  <View style={styles.staySummaryList}>
                    {summaryItems.map((item, index) => (
                      <View
                        key={`${option.source_note_id}-${index}`}
                        style={styles.staySummaryPill}
                      >
                        <Text style={styles.staySummaryPillText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.rankButtonRow}>
                  {STAY_RANK_FIELDS.map((field) => {
                    const active = assignedRank === field;
                    return (
                      <Pressable
                        key={field}
                        onPress={() => assignStayRank(option.source_note_id, field)}
                        style={[
                          styles.rankButton,
                          active ? styles.rankButtonActive : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.rankButtonText,
                            active ? styles.rankButtonTextActive : null,
                          ]}
                        >
                          {STAY_RANK_LABELS[field]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>

        {stayPollValidationError ? (
          <Text style={styles.errorText}>{stayPollValidationError}</Text>
        ) : null}

        <View style={styles.footer}>
          <View />
          <Pressable
            onPress={handleSubmitStayVote}
            style={[
              styles.primaryBtn,
              stayPollValidationError ? styles.primaryBtnDisabled : null,
            ]}
            disabled={submitting || !!stayPollValidationError}
          >
            <Text style={styles.primaryBtnText}>
              {submitting
                ? "Saving..."
                : hasExistingStayResponse
                  ? "Update Ranking"
                  : "Submit Ranking"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

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
          <Text style={styles.confirmationBody}>
            {hasExistingAvailabilityResponse
              ? "Your date vote has been updated."
              : "Waiting on others."}
          </Text>
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
      <Text style={styles.stepText}>Step {step} of 2</Text>
      <Text style={styles.title}>Date Poll</Text>

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
        </>
      ) : null}

      <View style={styles.footer}>
        {step > 1 ? (
          <Pressable
            onPress={() => setStep(1)}
            style={styles.secondaryBtn}
            disabled={submitting}
          >
            <Text style={styles.secondaryBtnText}>Back</Text>
          </Pressable>
        ) : (
          <View />
        )}

        {step === 2 ? (
          <Text style={styles.selectionCount}>{selectedCount} selected</Text>
        ) : null}

        <Pressable
          onPress={() => (step === 2 ? handleSubmit() : setStep(2))}
          style={[
            styles.primaryBtn,
            step === 2 && !canSubmitAvailability ? styles.primaryBtnDisabled : null,
          ]}
          disabled={step === 2 ? !canSubmitAvailability : submitting}
        >
          <Text style={styles.primaryBtnText}>
            {submitting ? "Submitting..." : step === 2 ? "Submit Vote" : "Next"}
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
  stayStatusCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ececec",
    backgroundColor: "#fff",
    gap: 6,
    marginBottom: 16,
  },
  stayStatusTitle: { fontSize: 15, fontWeight: "700", color: "#111" },
  stayStatusBody: { color: "#666", lineHeight: 20 },
  stayOptionList: { gap: 12 },
  stayVoteCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e7e7e7",
    backgroundColor: "#fff",
    gap: 12,
  },
  stayVoteHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  stayVoteHeaderText: { flex: 1, gap: 4 },
  stayVoteTitle: { fontSize: 17, fontWeight: "700", color: "#111" },
  stayVoteAssigned: { color: "#111", fontWeight: "600" },
  stayVoteAssignedMuted: { color: "#666" },
  linkMiniButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e4e4e4",
    backgroundColor: "#fff",
  },
  linkMiniButtonPressed: { opacity: 0.82 },
  linkMiniButtonText: { color: "#111", fontWeight: "600" },
  stayLinkRow: { gap: 8 },
  staySourceBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#efe8dd",
  },
  staySourceBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#725f47",
  },
  stayLinkValue: { color: "#1d4ed8", fontSize: 14 },
  staySummaryList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  staySummaryPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
  },
  staySummaryPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  rankButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rankButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  rankButtonActive: {
    borderColor: "#111",
    backgroundColor: "#111",
  },
  rankButtonText: { color: "#333", fontWeight: "600" },
  rankButtonTextActive: { color: "#fff" },
  errorText: {
    color: "tomato",
    marginTop: 16,
  },
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
