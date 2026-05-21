import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Alert,
  Share,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getTripOverview,
  getTripMemberDisplayName,
  TripOverview,
  type TripRole,
  type TripType,
} from "../../../lib/trips";
import {
  buildTripInviteLink,
  getOrCreateTripInvite,
  listPendingTripInvites,
  type PendingTripInvite,
} from "../../../lib/invites";
import { useAuthStore } from "../../../store/useAuthStore";
import {
  listPollResponseDetails,
  type PollResponseDetailRow,
} from "../../../lib/polls";
import { leaveTrip } from "../../../lib/members";
import { colors } from "../../../lib/theme";
import {
  getTripStage,
  isPollTrip,
  isTripReady,
  type TripStage,
} from "../../../lib/tripState";

const TRIP_TYPE_LABELS: Record<TripType, string> = {
  bachelor: "Bachelor",
  bachelorette: "Bachelorette",
  joint: "Joint Bachelor/ette",
  group: "Group Trip",
};

const ROLE_LABELS: Record<TripRole, string> = {
  creator: "Creator",
  planner: "Planner",
  guest: "Guest",
};

const STAGE_LABELS: Record<TripStage, string> = {
  draft: "Draft",
  polling: "Polling",
  finalized: "Finalized",
};

function ProgressStep({
  label,
  complete,
}: {
  label: string;
  complete: boolean;
}) {
  return (
    <View style={styles.progressRow}>
      <View
        style={[
          styles.progressDot,
          complete ? styles.progressDotComplete : null,
        ]}
      />
      <Text
        style={[
          styles.progressLabel,
          complete ? styles.progressLabelComplete : null,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  actionLabel,
  onPress,
}: {
  label: string;
  value: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryTextBlock}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
      </View>
      {actionLabel && onPress ? (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.inlineAction,
            pressed ? styles.inlineActionPressed : null,
          ]}
        >
          <Text style={styles.inlineActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function GroupStatusList({
  items,
  emptyText,
}: {
  items: string[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return <Text style={styles.groupStatusEmpty}>{emptyText}</Text>;
  }

  return (
    <View style={styles.groupStatusList}>
      {items.map((item, index) => (
        <Text key={`${item}-${index}`} style={styles.groupStatusItem}>
          {item}
        </Text>
      ))}
    </View>
  );
}

function getTripDestination(trip: TripOverview["trip"]) {
  const tripWithDestination = trip as TripOverview["trip"] & {
    destination?: string | null;
    destination_name?: string | null;
    final_destination?: string | null;
    final_destination_name?: string | null;
  };
  const destination =
    tripWithDestination.final_destination_name ??
    tripWithDestination.final_destination ??
    tripWithDestination.destination_name ??
    tripWithDestination.destination;

  return destination?.trim() || null;
}

function formatDateOptionLabel(option: TripOverview["dateOptions"][number]) {
  const range = `${option.start_date} → ${option.end_date}`;
  return option.label ? `${option.label}: ${range}` : range;
}

type PrimaryAction = {
  label: string;
  ctaLabel?: string;
  description: string;
  onPress?: () => void;
  disabled: boolean;
};

function getPrimaryAction({
  canFinalizeDates,
  canManageTrip,
  canViewResults,
  dateOptionCount,
  draftReady,
  hasCurrentUserVoted,
  isFinalized,
  isDestinationMissing,
  isPlannedMode,
  isPolling,
  leadingDateLabel,
  leadingVoteCount,
  role,
  stage,
  waitingCount,
  onOpenNotes,
  onOpenPoll,
  onOpenResults,
  onOpenSetup,
  onOpenTravel,
}: {
  canFinalizeDates: boolean;
  canManageTrip: boolean;
  canViewResults: boolean;
  dateOptionCount: number;
  draftReady: boolean;
  hasCurrentUserVoted: boolean;
  isFinalized: boolean;
  isDestinationMissing: boolean;
  isPlannedMode: boolean;
  isPolling: boolean;
  leadingDateLabel: string | null;
  leadingVoteCount: number;
  role: TripRole;
  stage: TripStage;
  waitingCount: number;
  onOpenNotes: () => void;
  onOpenPoll: () => void;
  onOpenResults: () => void;
  onOpenSetup: () => void;
  onOpenTravel: () => void;
}): PrimaryAction {
  if (isFinalized) {
    if (isDestinationMissing) {
      return {
        label: "Choose destination",
        ctaLabel: "Continue Planning",
        description: "Now that dates are locked, pick where the group is going.",
        onPress: onOpenTravel,
        disabled: false,
      };
    }

    return {
      label: "Dates finalized",
      ctaLabel: "Continue Planning",
      description: "The group has locked the trip dates.",
      onPress: onOpenTravel,
      disabled: false,
    };
  }

  if (dateOptionCount === 0) {
    return {
      label: "Start Date Poll",
      ctaLabel: "Continue Setup",
      description: "Add a few date options so the group can vote.",
      onPress: canManageTrip ? onOpenSetup : undefined,
      disabled: !canManageTrip,
    };
  }

  if (isPlannedMode) {
    return {
      label: canManageTrip ? "Finish Trip Details" : "Open Notes Board",
      description: canManageTrip
        ? "Use setup to lock in the basic trip details without sending a poll."
        : "Use the shared notes board while the trip details are being finalized.",
      onPress: canManageTrip ? onOpenSetup : onOpenNotes,
      disabled: false,
    };
  }

  if (isPolling) {
    if (leadingVoteCount === 0) {
      const canVote = role === "planner" || role === "guest";
      return {
        label: "Get the first vote",
        ctaLabel: canVote ? "Vote Now" : "View Results",
        description: "No one has voted yet. Start the date decision.",
        onPress: canVote ? onOpenPoll : onOpenResults,
        disabled: false,
      };
    }

    if (canFinalizeDates && leadingDateLabel) {
      return {
        label: "Ready to finalize dates",
        ctaLabel: "View Results",
        description: `${leadingDateLabel} is leading with ${leadingVoteCount} vote${leadingVoteCount === 1 ? "" : "s"}.`,
        onPress: onOpenResults,
        disabled: false,
      };
    }

    if (waitingCount > 0 && leadingDateLabel) {
      return {
        label: `Waiting on ${waitingCount} ${waitingCount === 1 ? "person" : "people"}`,
        ctaLabel: "View Results",
        description: `Leading: ${leadingDateLabel}. Keep the group moving.`,
        onPress: onOpenResults,
        disabled: false,
      };
    }

    if ((role === "planner" || role === "guest") && !hasCurrentUserVoted) {
      return {
        label: "Vote on Date Poll",
        ctaLabel: "Vote Now",
        description: "Vote on the dates that work best so the group can lock the trip.",
        onPress: onOpenPoll,
        disabled: false,
      };
    }

    return {
      label: "View Date Poll Results",
      ctaLabel: "View Results",
      description: leadingDateLabel
        ? `Leading: ${leadingDateLabel}.`
        : "Check the latest date votes.",
      onPress: canViewResults ? onOpenResults : undefined,
      disabled: !canViewResults,
    };
  }

  if (stage === "draft") {
    if (draftReady) {
      return {
        label: "Review Poll",
        description:
          "Your poll is ready. Send it, then invite the group right after.",
        onPress: canManageTrip ? onOpenSetup : undefined,
        disabled: !canManageTrip,
      };
    }
    return {
      label: "Continue Setup",
      description: "Add the dates for this trip.",
      onPress: canManageTrip ? onOpenSetup : undefined,
      disabled: !canManageTrip,
    };
  }

  return {
    label: "Open Travel Board",
    description: "Add your travel details and check the group plan.",
    onPress: onOpenTravel,
    disabled: false,
  };
}

export default function TripDetailScreen() {
  const params = useLocalSearchParams();
  const tripId = Array.isArray(params.tripId)
    ? params.tripId[0]
    : params.tripId;
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);

  const [data, setData] = useState<TripOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copyInviteLoading, setCopyInviteLoading] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingTripInvite[]>([]);
  const [pollResponses, setPollResponses] = useState<PollResponseDetailRow[]>([]);
  const [inviteLinks, setInviteLinks] = useState<
    Partial<Record<Exclude<TripRole, "creator">, string>>
  >({});
  const [inviteRole, setInviteRole] = useState<Exclude<TripRole, "creator">>("guest");

  useEffect(() => {
    if (!tripId) return;

    let mounted = true;

    (async () => {
      try {
        setErrorMsg(null);
        setLoading(true);
        const res = await getTripOverview(tripId);
        const [inviteRows, responseRows] = await Promise.all([
          listPendingTripInvites(tripId),
          getTripStage(res) === "polling"
            ? listPollResponseDetails(tripId)
            : Promise.resolve([]),
        ]);
        if (!mounted) return;
        setData(res);
        setPendingInvites(inviteRows);
        setPollResponses(responseRows);
      } catch (e: any) {
        if (mounted) setErrorMsg(e?.message ?? "Failed to load trip");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tripId]);

  const getInviteLink = async (role: Exclude<TripRole, "creator">) => {
    if (!tripId) throw new Error("Missing trip id.");
    const existingLink = inviteLinks[role];
    if (existingLink) return existingLink;

    const invite = await getOrCreateTripInvite(tripId, role);
    const link = buildTripInviteLink(invite.token);
    setInviteLinks((prev) => ({ ...prev, [role]: link }));
    setPendingInvites((prev) => {
      if (prev.some((pendingInvite) => pendingInvite.id === invite.id)) {
        return prev;
      }
      return [...prev, {
        id: invite.id,
        role: invite.role,
        created_at: invite.created_at,
      }];
    });
    return link;
  };

  const copyInviteLink = async (link: string) => {
    await Clipboard.setStringAsync(link);
    Alert.alert("Link copied");
  };

  const handleInvite = async () => {
    try {
      setInviteLoading(true);
      const link = await getInviteLink(inviteRole);
      await Share.share({
        message: `Join my trip on Togetli as a ${inviteRole}: ${link}`,
        url: link,
      });
    } catch (e: any) {
      console.error(e);
      Alert.alert("Invite failed", e?.message ?? String(e));
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      setCopyInviteLoading(true);
      const link = await getInviteLink(inviteRole);
      await copyInviteLink(link);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Copy failed", e?.message ?? String(e));
    } finally {
      setCopyInviteLoading(false);
    }
  };

  const handleLeaveTrip = async () => {
    if (!tripId || !userId) return;

    Alert.alert("Leave trip?", "You will lose access to this trip.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          try {
            await leaveTrip({ tripId, userId });
            router.replace("/(app)/trips");
          } catch (e: any) {
            Alert.alert("Leave failed", e?.message ?? String(e));
          }
        },
      },
    ]);
  };

  if (!tripId) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Missing trip id.</Text>
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

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Trip not found.</Text>
      </View>
    );
  }

  const { trip, members, dateOptions } = data;

  const myMember = members.find((m) => m.user_id === userId);
  const role = myMember?.role ?? "guest";
  const roleLabel = ROLE_LABELS[role];
  const tripTypeLabel = TRIP_TYPE_LABELS[trip.type];
  const canManageTrip = role === "creator" || role === "planner";
  const canInvite = canManageTrip;
  const isPollMode = isPollTrip(trip.mode);
  const isPlannedMode = !isPollMode;
  const plannerCount = members.filter((m) => m.role === "planner").length;
  const guestCount = members.filter((m) => m.role === "guest").length;
  const stage = getTripStage(data);
  const showInviteSection = canInvite;
  const isPolling = stage === "polling";
  const isFinalized = stage === "finalized";
  const draftReady = stage === "draft" && isTripReady(data);
  const hasFinalDates = !!trip.final_start_date && !!trip.final_end_date;
  const eligibleVotingMembers = members.filter((member) => member.role !== "creator");
  const eligibleVotingUserIds = new Set(
    eligibleVotingMembers.map((member) => member.user_id)
  );
  const totalMemberCount = eligibleVotingMembers.length;
  const votedUserIds = Array.from(
    new Set(
      pollResponses
        .filter(
          (response) =>
            !!response.user_id &&
            eligibleVotingUserIds.has(response.user_id) &&
            (response.available_date_option_ids?.length ?? 0) > 0
        )
        .map((response) => response.user_id)
        .filter((id): id is string => !!id)
    )
  );
  const votedCount = votedUserIds.length;
  const waitingCount = Math.max(totalMemberCount - votedCount, 0);
  const hasCurrentUserVoted = !!userId && votedUserIds.includes(userId);
  const dateVoteCounts = new Map<string, number>();

  dateOptions.forEach((option) => {
    dateVoteCounts.set(option.id, 0);
  });
  pollResponses.forEach((response) => {
    if (!response.user_id || !eligibleVotingUserIds.has(response.user_id)) return;
    (response.available_date_option_ids ?? []).forEach((optionId) => {
      dateVoteCounts.set(optionId, (dateVoteCounts.get(optionId) ?? 0) + 1);
    });
  });

  const leadingVoteCount = Math.max(0, ...Array.from(dateVoteCounts.values()));
  const leadingDateOptions =
    leadingVoteCount > 0
      ? dateOptions.filter(
          (option) => (dateVoteCounts.get(option.id) ?? 0) === leadingVoteCount
        )
      : [];
  const leadingDateOption = leadingDateOptions[0] ?? null;
  const leadingDateLabel = leadingDateOption
    ? formatDateOptionLabel(leadingDateOption)
    : null;
  const hasDatePollTie = leadingDateOptions.length > 1;
  const canFinalizeDates =
    canManageTrip && !!leadingDateOption && !hasDatePollTie && leadingVoteCount > 0;
  const canViewResults = canManageTrip || hasCurrentUserVoted;

  const finalPlanSummary =
    isFinalized && hasFinalDates
      ? `${trip.final_start_date} → ${trip.final_end_date}`
      : "No final plan locked in yet.";
  const dateDecisionValue = (() => {
    if (hasFinalDates) return `${trip.final_start_date} → ${trip.final_end_date}`;
    if (leadingDateLabel) return `Leading: ${leadingDateLabel}`;
    if (isPolling && dateOptions.length > 0) return "Waiting on votes";
    return "Not started";
  })();
  const destination = getTripDestination(trip);
  const destinationDecisionValue = destination
    ? destination
    : hasFinalDates
      ? "Not decided yet."
      : "Decide after dates.";

  const statusSentence = (() => {
    if (isPlannedMode) {
      if (isFinalized) {
        return "This trip is already planned. Use the board to coordinate logistics with the group.";
      }
      return canManageTrip
        ? "This trip is already planned. Add the final details you want the group to coordinate around."
        : "This trip is already planned. Coordination details will show up here as the group fills them in.";
    }

    if (stage === "draft") {
      if (draftReady) {
        return canManageTrip
          ? "Everything is ready. Review the poll and send it to the group."
          : "The poll is almost ready. A planner can send it once details look good.";
      }
      return canManageTrip
        ? "Finish the poll setup so you can send it and invite the group."
        : "The trip is being set up before the poll goes live.";
    }
    if (stage === "polling") {
      return canViewResults
        ? "Awaiting votes. Review the signal as the group weighs in."
        : "The date poll is live. Vote on the dates that work best.";
    }
    return "The plan is locked in. Review the itinerary and coordinate details with your group.";
  })();

  const primaryAction = getPrimaryAction({
    canFinalizeDates,
    canManageTrip,
    canViewResults,
    dateOptionCount: dateOptions.length,
    draftReady,
    hasCurrentUserVoted,
    isFinalized,
    isDestinationMissing: !destination,
    isPlannedMode,
    isPolling,
    leadingDateLabel,
    leadingVoteCount,
    role,
    stage,
    waitingCount,
    onOpenNotes: () => router.push(`/(app)/trips/${tripId}/notes`),
    onOpenPoll: () => router.push(`/(app)/trips/${tripId}/poll`),
    onOpenResults: () => router.push(`/(app)/trips/${tripId}/poll-results`),
    onOpenSetup: () => router.push(`/(app)/trips/${tripId}/setup`),
    onOpenTravel: () => router.push(`/(app)/trips/${tripId}/travel`),
  });

  const allEligibleVotersVoted = totalMemberCount > 0 && waitingCount === 0;
  const datePollExists = hasFinalDates || dateOptions.length > 0 || stage !== "draft";
  const datePollStatus =
    hasFinalDates || isFinalized
      ? "Dates locked"
      : stage === "draft"
        ? "Setup required"
        : stage === "polling" && votedCount === 0
          ? "No votes yet"
          : stage === "polling" && !allEligibleVotersVoted
            ? `Waiting on ${waitingCount}`
            : stage === "polling"
              ? "Ready to finalize"
              : "Dates locked";
  const datePollDescription =
    stage === "draft"
      ? canManageTrip
        ? "Add date options and send the date poll when details are ready."
        : "A planner is still preparing the date poll."
      : stage === "polling"
        ? `${leadingDateLabel ? `${hasDatePollTie ? "Tie" : `Leading: ${leadingDateLabel}`} · ` : ""}${votedCount} of ${totalMemberCount} voted`
        : `${votedCount} of ${totalMemberCount} voted`;
  const datePollAction = (() => {
    if (stage === "draft") {
      if (!canManageTrip) return null;
      return {
        label: "Continue Setup",
        onPress: () => router.push(`/(app)/trips/${tripId}/setup`),
      };
    }

    if (stage === "polling") {
      if ((role === "planner" || role === "guest") && !hasCurrentUserVoted) {
        return {
          label: "Vote Now",
          onPress: () => router.push(`/(app)/trips/${tripId}/poll`),
        };
      }

      if (canViewResults) {
        return {
          label: "View Results",
          onPress: () => router.push(`/(app)/trips/${tripId}/poll-results`),
        };
      }

      return null;
    }

    return {
      label: "View Results",
      onPress: () => router.push(`/(app)/trips/${tripId}/poll-results`),
    };
  })();

  const metaLabel = tripTypeLabel.replace(" Trip", "") + " Trip";
  const peopleSummary = `${members.length} active members • ${plannerCount} planner${plannerCount === 1 ? "" : "s"} • ${guestCount} guest${guestCount === 1 ? "" : "s"}`;
  const joinedMemberNames = members.map(getTripMemberDisplayName);
  const hasActiveGuestInviteLink = pendingInvites.some((invite) => invite.role === "guest");
  const hasActivePlannerInviteLink = pendingInvites.some((invite) => invite.role === "planner");
  const votedMemberNames = eligibleVotingMembers
    .filter((member) => votedUserIds.includes(member.user_id))
    .map(getTripMemberDisplayName);
  const waitingMemberNames = eligibleVotingMembers
    .filter((member) => !votedUserIds.includes(member.user_id))
    .map(getTripMemberDisplayName);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <Text style={styles.title}>{trip.title ?? "Untitled Trip"}</Text>
        <Text style={styles.meta}>{metaLabel}</Text>
        <View style={styles.badgeRow}>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleLabel}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{STAGE_LABELS[stage]}</Text>
          </View>
        </View>
        <Text style={styles.statusSentence}>{statusSentence}</Text>
        {isFinalized ? (
          <Text style={styles.finalPlanText}>
            {hasFinalDates
              ? `${trip.final_start_date} → ${trip.final_end_date}`
              : "Dates have not been added yet."}
          </Text>
        ) : null}
        {role !== "creator" ? (
          <Pressable
            onPress={handleLeaveTrip}
            style={({ pressed }) => [
              styles.leaveBtn,
              pressed ? styles.leaveBtnPressed : null,
            ]}
          >
            <Text style={styles.leaveBtnText}>Leave trip</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.primaryCard}>
        <Text style={styles.primaryCardEyebrow}>Next Action</Text>
        <Text style={styles.primaryCardTitle}>{primaryAction.label}</Text>
        <Text style={styles.primaryCardBody}>{primaryAction.description}</Text>
        {primaryAction.onPress ? (
          <Pressable
            onPress={primaryAction.onPress}
            disabled={primaryAction.disabled}
            style={({ pressed }) => [
              styles.primaryCtaButton,
              primaryAction.disabled ? styles.primaryCtaButtonDisabled : null,
              pressed && !primaryAction.disabled
                ? styles.primaryCtaButtonPressed
                : null,
            ]}
          >
            <Text style={styles.primaryCtaButtonText}>
              {"ctaLabel" in primaryAction
                ? primaryAction.ctaLabel
                : primaryAction.label}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.primaryCardHint}>
            No action needed right now.
          </Text>
        )}
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeading}>Decisions</Text>
        <View style={styles.card}>
          <SummaryRow
            label="Dates"
            value={dateDecisionValue}
          />
          <View style={styles.divider} />
          <SummaryRow label="Destination" value={destinationDecisionValue} />
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeading}>Polls</Text>
        {isPollMode ? (
          <>
            {!datePollExists ? (
              <View style={styles.pollCard}>
                <View style={styles.pollCardTextBlock}>
                  <Text style={styles.cardTitle}>Date Poll</Text>
                  <Text style={styles.cardBody}>
                    Decide when the trip should happen.
                  </Text>
                </View>
                {canManageTrip ? (
                  <Pressable
                    onPress={() => router.push(`/(app)/trips/${tripId}/setup`)}
                    style={({ pressed }) => [
                      styles.cardButton,
                      pressed ? styles.cardButtonPressed : null,
                    ]}
                  >
                    <Text style={styles.cardButtonText}>Create Date Poll</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.cardHintText}>
                    A planner can create the date poll.
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.pollCard}>
                <View style={styles.pollCardHeader}>
                  <View style={styles.pollCardTextBlock}>
                    <Text style={styles.cardTitle}>Date Poll</Text>
                    <Text style={styles.cardBody}>{datePollDescription}</Text>
                  </View>
                  <View style={styles.pollStateBadge}>
                    <Text style={styles.pollStateBadgeText}>{datePollStatus}</Text>
                  </View>
                </View>
                {datePollAction ? (
                  <Pressable
                    onPress={datePollAction.onPress}
                    style={({ pressed }) => [
                      styles.cardButton,
                      pressed ? styles.cardButtonPressed : null,
                    ]}
                  >
                    <Text style={styles.cardButtonText}>{datePollAction.label}</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.cardHintText}>No action needed right now.</Text>
                )}
              </View>
            )}
          </>
        ) : (
          <View style={styles.card}>
            <SummaryRow
              label="Plan"
              value={finalPlanSummary}
              actionLabel={canManageTrip ? "Edit" : undefined}
              onPress={
                canManageTrip
                  ? () => router.push(`/(app)/trips/${tripId}/setup`)
                  : undefined
              }
            />
          </View>
        )}
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeading}>Trip Snapshot</Text>
        <View style={styles.card}>
          <SummaryRow
            label="People"
            value={peopleSummary}
            actionLabel="Manage"
            onPress={() => router.push(`/(app)/trips/${tripId}/members`)}
          />
          {isPollMode ? (
            <>
              <View style={styles.divider} />
              <SummaryRow
                label="Date Options"
                value={`${dateOptions.length} option${dateOptions.length === 1 ? "" : "s"}`}
                actionLabel={canManageTrip ? "Edit" : undefined}
                onPress={
                  canManageTrip
                    ? () => router.push(`/(app)/trips/${tripId}/setup`)
                    : undefined
                }
              />
            </>
          ) : (
            <>
              <View style={styles.divider} />
              <SummaryRow
                label="Plan"
                value={finalPlanSummary}
                actionLabel={canManageTrip ? "Edit" : undefined}
                onPress={
                  canManageTrip
                    ? () => router.push(`/(app)/trips/${tripId}/setup`)
                    : undefined
                }
              />
            </>
          )}
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeading}>Shared Ideas</Text>
        <View style={styles.card}>
          <Text style={styles.cardBody}>
            Save stays, restaurants, activities, and links for the trip.
          </Text>
          <Pressable
            onPress={() => router.push(`/(app)/trips/${tripId}/notes`)}
            style={({ pressed }) => [
              styles.cardButton,
              pressed ? styles.cardButtonPressed : null,
            ]}
          >
            <Text style={styles.cardButtonText}>Open Notes Board</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeading}>Group Status</Text>
        <View style={styles.card}>
          <Text style={styles.groupStatusLabel}>Joined members</Text>
          <GroupStatusList
            items={joinedMemberNames}
            emptyText="No joined members yet."
          />
          {hasActiveGuestInviteLink || hasActivePlannerInviteLink ? (
            <>
              <View style={styles.divider} />
              {hasActiveGuestInviteLink ? (
                <Text style={styles.groupStatusNote}>Guest invite link active.</Text>
              ) : null}
              {hasActivePlannerInviteLink ? (
                <Text style={styles.groupStatusNote}>Planner invite link active.</Text>
              ) : null}
            </>
          ) : null}
          {isPollMode && isPolling ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.groupStatusLabel}>Voted members</Text>
              <GroupStatusList
                items={votedMemberNames}
                emptyText="No votes yet."
              />
              <View style={styles.divider} />
              <Text style={styles.groupStatusLabel}>Waiting on members</Text>
              <GroupStatusList
                items={waitingMemberNames}
                emptyText="No one pending."
              />
            </>
          ) : null}
        </View>
      </View>

      {showInviteSection ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Invite</Text>
          <View style={styles.card}>
            <Text style={styles.cardBody}>
              Send an invite link to bring more people into this trip.
            </Text>
            <View style={styles.inviteRoleRow}>
              <Text style={styles.inviteRoleLabel}>Invite as</Text>
              <Pressable
                onPress={() => setInviteRole("guest")}
                style={[
                  styles.inviteRoleOption,
                  inviteRole === "guest" ? styles.inviteRoleOptionActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.inviteRoleOptionText,
                    inviteRole === "guest" ? styles.inviteRoleOptionTextActive : null,
                  ]}
                >
                  Guest
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setInviteRole("planner")}
                style={[
                  styles.inviteRoleOption,
                  inviteRole === "planner" ? styles.inviteRoleOptionActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.inviteRoleOptionText,
                    inviteRole === "planner" ? styles.inviteRoleOptionTextActive : null,
                  ]}
                >
                  Planner
                </Text>
              </Pressable>
            </View>
            <Pressable
              onPress={handleInvite}
              disabled={inviteLoading}
              style={({ pressed }) => [
                styles.cardButton,
                inviteLoading ? styles.cardButtonDisabled : null,
                pressed && !inviteLoading ? styles.cardButtonPressed : null,
              ]}
            >
              <Text style={styles.cardButtonText}>
                {inviteLoading ? "Opening share..." : "Invite People"}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleCopyInviteLink}
              disabled={copyInviteLoading}
              style={({ pressed }) => [
                styles.secondaryCardButton,
                copyInviteLoading ? styles.cardButtonDisabled : null,
                pressed && !copyInviteLoading ? styles.cardButtonPressed : null,
              ]}
            >
              <Text style={styles.secondaryCardButtonText}>
                {copyInviteLoading ? "Copying..." : "Copy Link"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    padding: 18,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 14,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: colors.textMuted },
  error: { color: colors.danger },

  heroCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: colors.text,
  },
  meta: { marginTop: 4, color: colors.textMuted, fontSize: 14 },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  roleBadgeText: { color: colors.primaryText, fontWeight: "600", fontSize: 12 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  statusBadgeText: { color: colors.text, fontWeight: "600", fontSize: 12 },
  statusSentence: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  leaveBtn: {
    marginTop: 12,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: "flex-start",
  },
  leaveBtnText: { color: colors.text, fontWeight: "600" },
  leaveBtnPressed: { opacity: 0.7 },

  primaryCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    backgroundColor: colors.primarySoft,
  },
  primaryCardEyebrow: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  primaryCardTitle: {
    marginTop: 6,
    color: colors.ink,
    fontSize: 21,
    fontWeight: "700",
  },
  primaryCardBody: {
    marginTop: 8,
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryCtaButton: {
    marginTop: 14,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryCtaButtonText: {
    color: colors.primaryText,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 15,
  },
  primaryCtaButtonPressed: { opacity: 0.8 },
  primaryCtaButtonDisabled: { opacity: 0.45 },
  primaryCardHint: {
    marginTop: 14,
    color: colors.textMuted,
  },

  sectionBlock: {
    gap: 9,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },

  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 10,
  },
  pollCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 10,
  },
  secondaryPollCard: {
    backgroundColor: colors.surfaceMuted,
  },
  pollCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  pollCardTextBlock: {
    flex: 1,
    gap: 4,
  },
  pollStateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  pollStateBadgeText: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: "700",
  },
  secondaryPollStateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  secondaryPollStateBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  cardBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19,
  },
  cardHintText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryTextBlock: {
    flex: 1,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  summaryValue: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  groupStatusLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  groupStatusList: {
    gap: 6,
  },
  groupStatusItem: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
  },
  groupStatusEmpty: {
    fontSize: 14,
    color: colors.textMuted,
  },
  groupStatusNote: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  inlineAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inlineActionText: {
    color: colors.text,
    fontWeight: "600",
  },
  inlineActionPressed: { opacity: 0.7 },

  inviteRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  inviteRoleLabel: { color: colors.textMuted, marginRight: 4 },
  inviteRoleOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inviteRoleOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  inviteRoleOptionText: { color: colors.text, fontWeight: "500" },
  inviteRoleOptionTextActive: { color: colors.primaryText },
  cardButton: {
    marginTop: 2,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 999,
  },
  cardButtonText: {
    color: colors.primaryText,
    textAlign: "center",
    fontWeight: "600",
    fontSize: 15,
  },
  cardButtonPressed: { opacity: 0.8 },
  cardButtonDisabled: { opacity: 0.5 },
  secondaryCardButton: {
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryCardButtonText: {
    color: colors.text,
    textAlign: "center",
    fontWeight: "600",
    fontSize: 15,
  },

  progressCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 12,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  progressDotComplete: {
    backgroundColor: colors.primary,
  },
  progressLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  progressLabelComplete: {
    color: colors.text,
    fontWeight: "600",
  },
  finalPlanText: {
    marginTop: 12,
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
});
