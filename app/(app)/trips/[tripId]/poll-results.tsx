import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  markTripPlanned,
  listPollResponseDetails,
  type PollResponseDetailRow,
} from "../../../../lib/polls";
import {
  getTripMemberDisplayName,
  getTripOverview,
  type TripDateOptionRow,
  type TripMemberRow,
} from "../../../../lib/trips";
import { useAuthStore } from "../../../../store/useAuthStore";
import { colors, radius, spacing, typography } from "../../../../lib/theme";
import { formatDateRangeLabel } from "../../../../lib/dateFormatting";

type DateResult = {
  option: TripDateOptionRow;
  count: number;
  isLeading: boolean;
  percentage: number;
};

function formatDateRange(option: TripDateOptionRow) {
  return formatDateRangeLabel(option.start_date, option.end_date);
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export default function DatePollResultsScreen() {
  const params = useLocalSearchParams();
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const userId = useAuthStore((s) => s.userId);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dateOptions, setDateOptions] = useState<TripDateOptionRow[]>([]);
  const [members, setMembers] = useState<TripMemberRow[]>([]);
  const [responses, setResponses] = useState<PollResponseDetailRow[]>([]);
  const [canManageTrip, setCanManageTrip] = useState(false);
  const [isTripMember, setIsTripMember] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    if (!tripId) return;

    let mounted = true;

    (async () => {
      try {
        setErrorMsg(null);
        setLoading(true);

        const [overview, responses] = await Promise.all([
          getTripOverview(tripId),
          listPollResponseDetails(tripId),
        ]);

        if (!mounted) return;

        const currentMember = overview.members.find(
          (member) => member.user_id === userId
        );
        setIsTripMember(!!currentMember);
        setCanManageTrip(
          currentMember?.role === "creator" || currentMember?.role === "planner"
        );
        setMembers(overview.members);
        setDateOptions(overview.dateOptions);
        setResponses(responses);
      } catch (e: any) {
        if (mounted) setErrorMsg(e?.message ?? "Failed to load poll results");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tripId, userId]);

  const { dateResults, leadingResults, voterNames, waitingNames, voterCount } = useMemo(() => {
    const voteCounts = new Map<string, number>();
    const eligibleMembers = members.filter((member) => member.role !== "creator");
    const eligibleUserIds = new Set(eligibleMembers.map((member) => member.user_id));

    dateOptions.forEach((option) => {
      voteCounts.set(option.id, 0);
    });

    responses.forEach((response) => {
      if (!response.user_id || !eligibleUserIds.has(response.user_id)) return;
      (response.available_date_option_ids ?? []).forEach((optionId) => {
        voteCounts.set(optionId, (voteCounts.get(optionId) ?? 0) + 1);
      });
    });

    const maxVotes = Math.max(0, ...Array.from(voteCounts.values()));
    const results = dateOptions
      .map((option) => {
        const count = voteCounts.get(option.id) ?? 0;
        return {
          option,
          count,
          isLeading: maxVotes > 0 && count === maxVotes,
          percentage:
            eligibleMembers.length > 0
              ? Math.round((count / eligibleMembers.length) * 100)
              : 0,
        };
      })
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.option.start_date.localeCompare(b.option.start_date);
      });

    const voterSet = new Set(
      responses
        .filter(
          (response) =>
            !!response.user_id &&
            eligibleUserIds.has(response.user_id) &&
            (response.available_date_option_ids?.length ?? 0) > 0
        )
        .map((response) => response.user_id!)
    );

    return {
      dateResults: results,
      leadingResults: results.filter((result) => result.isLeading),
      voterNames: eligibleMembers
        .filter((member) => voterSet.has(member.user_id))
        .map(getTripMemberDisplayName),
      waitingNames: eligibleMembers
        .filter((member) => !voterSet.has(member.user_id))
        .map(getTripMemberDisplayName),
      voterCount: eligibleMembers.length,
    };
  }, [dateOptions, members, responses]);

  const hasLeadingTie = leadingResults.length > 1;
  const waitingCount = Math.max(voterCount - voterNames.length, 0);
  const allEligibleVotersVoted = voterCount > 0 && waitingCount === 0;
  const canFinalizeLeadingDates =
    canManageTrip &&
    allEligibleVotersVoted &&
    leadingResults.length === 1 &&
    leadingResults[0].count > 0;
  const finalizeDisabledReason = !allEligibleVotersVoted
    ? "Waiting on everyone to vote before finalizing."
    : hasLeadingTie
      ? "Resolve the tie before finalizing."
      : "A clear leading date is needed before finalizing.";

  const handleFinalize = () => {
    const leading = leadingResults[0];
    if (!tripId || !leading || !canFinalizeLeadingDates || finalizing) return;

    Alert.alert("Finalize dates?", formatDateRange(leading.option), [
      { text: "Cancel", style: "cancel" },
      {
        text: "Finalize Dates",
        onPress: () => {
          const persist = async () => {
            setFinalizing(true);
            try {
              await markTripPlanned({
                tripId,
                finalStartDate: leading.option.start_date,
                finalEndDate: leading.option.end_date,
              });
              Alert.alert("Dates finalized", "The trip dates are now locked.");
            } catch (e: any) {
              Alert.alert("Couldn't finalize dates", e?.message ?? String(e));
            } finally {
              setFinalizing(false);
            }
          };

          void persist();
        },
      },
    ]);
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

  if (!isTripMember) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Only active trip members can view results.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Date Poll Results</Text>
        <Text style={styles.body}>See which dates work best for the group.</Text>
      </View>

      {canManageTrip ? (
        <View style={styles.finalizeBlock}>
          <Pressable
            onPress={handleFinalize}
            disabled={!canFinalizeLeadingDates || finalizing}
            style={({ pressed }) => [
              styles.finalizeButton,
              !canFinalizeLeadingDates || finalizing ? styles.finalizeButtonDisabled : null,
              pressed && canFinalizeLeadingDates && !finalizing
                ? styles.finalizeButtonPressed
                : null,
            ]}
          >
            <Text style={styles.finalizeButtonText}>
              {finalizing ? "Finalizing..." : "Finalize Dates"}
            </Text>
          </Pressable>
          {!canFinalizeLeadingDates ? (
            <Text style={styles.finalizeHelp}>{finalizeDisabledReason}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Date Options</Text>
        {dateResults.length === 0 ? (
          <Text style={styles.muted}>No date options yet.</Text>
        ) : (
          dateResults.map((result) => (
            <View
              key={result.option.id}
              style={[
                styles.resultCard,
                result.isLeading ? styles.resultCardLeading : null,
              ]}
            >
              <View style={styles.resultTopRow}>
                <View style={styles.resultTextBlock}>
                  {result.option.label ? (
                    <Text style={styles.resultOptionLabel}>
                      {result.option.label}
                    </Text>
                  ) : null}
                  <Text
                    style={[
                      styles.resultDateRange,
                      result.isLeading ? styles.resultDateRangeLeading : null,
                    ]}
                  >
                    {formatDateRange(result.option)}
                  </Text>
                  {result.isLeading ? (
                    <Text style={styles.resultHint}>
                      {hasLeadingTie ? "Tied leader" : "Current leader"}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.resultStatBlock}>
                  <Text
                    style={[
                      styles.resultCount,
                      result.isLeading ? styles.resultCountLeading : null,
                    ]}
                  >
                    {result.count} vote{result.count === 1 ? "" : "s"}
                  </Text>
                  <Text style={styles.resultPercent}>
                    {result.percentage}% of voters
                  </Text>
                </View>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${result.percentage}%` },
                  ]}
                />
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>Participation</Text>
        <View style={styles.card}>
          <View style={styles.participationTopRow}>
            <Text style={styles.cardTitle}>
              {voterNames.length} of {voterCount} voted
            </Text>
            <Text style={styles.waitingPill}>
              {waitingCount} waiting
            </Text>
          </View>
          <View style={styles.divider} />
          <Text style={styles.listLabel}>Voted</Text>
          {voterNames.length > 0 ? (
            <View style={styles.memberList}>
              {voterNames.map((name, index) => (
                <View key={`voted-${name}-${index}`} style={styles.memberRow}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>{getInitials(name)}</Text>
                  </View>
                  <Text style={styles.memberName}>{name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>No one has voted yet.</Text>
          )}
          {waitingNames.length > 0 ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.listLabel}>Waiting on</Text>
              <View style={styles.memberList}>
                {waitingNames.map((name, index) => (
                  <View key={`waiting-${name}-${index}`} style={styles.memberRow}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>{getInitials(name)}</Text>
                    </View>
                    <Text style={styles.memberName}>{name}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.muted}>No one pending.</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: colors.danger },
  header: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
  },
  leaderCard: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    backgroundColor: colors.primarySoft,
    gap: spacing.sm,
  },
  leaderEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  leaderTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 28,
  },
  leaderBody: {
    color: colors.inkSoft,
    fontSize: 15,
    fontWeight: "700",
  },
  leaderLabelText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  leaderHelper: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  finalizeBlock: {
    gap: spacing.sm,
  },
  finalizeButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
  },
  finalizeButtonText: {
    color: colors.primaryText,
    fontWeight: "700",
    textAlign: "center",
    fontSize: 15,
  },
  finalizeButtonPressed: { opacity: 0.82 },
  finalizeButtonDisabled: { opacity: 0.45 },
  finalizeHelp: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeading: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  resultCard: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  resultCardLeading: {
    borderColor: colors.primaryMuted,
    backgroundColor: "#fffaf1",
  },
  resultTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  resultTextBlock: {
    flex: 1,
    gap: 4,
  },
  resultOptionLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  resultDateRange: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  resultDateRangeLeading: {
    fontWeight: "700",
  },
  resultHint: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  resultStatBlock: {
    alignItems: "flex-end",
    gap: 2,
  },
  resultCount: {
    color: colors.text,
    textAlign: "right",
    fontSize: 16,
    fontWeight: "700",
  },
  resultCountLeading: {
    color: colors.primary,
  },
  resultPercent: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  participationTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  waitingPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  listLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  memberList: {
    gap: spacing.xs,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  memberAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  memberAvatarText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  memberName: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: "600",
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
