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
import { checkIfUserResponded, listPollResponderUserIds } from "../../../lib/polls";
import { leaveTrip } from "../../../lib/members";
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

function getTripDestinationLabel(trip: TripOverview["trip"]) {
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

  return destination?.trim() || "Not set yet";
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
  const [hasResponded, setHasResponded] = useState(false);
  const [checkingResponse, setCheckingResponse] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingTripInvite[]>([]);
  const [responderUserIds, setResponderUserIds] = useState<string[]>([]);
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
        const inviteRows = await listPendingTripInvites(tripId);
        const responderIds =
          getTripStage(res) === "polling"
            ? await listPollResponderUserIds(tripId)
            : [];
        if (!mounted) return;
        setData(res);
        setPendingInvites(inviteRows);
        setResponderUserIds(responderIds);
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

  useEffect(() => {
    if (!userId || !tripId) return;

    const stage = data ? getTripStage(data) : null;
    const myMember = data?.members.find((m) => m.user_id === userId);
    const canManageTrip = myMember?.role === "creator" || myMember?.role === "planner";

    if (stage !== "polling" || canManageTrip) {
      setHasResponded(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        setCheckingResponse(true);
        const responded = await checkIfUserResponded(tripId, userId);
        if (active) setHasResponded(responded);
      } catch {
        if (active) setHasResponded(false);
      } finally {
        if (active) setCheckingResponse(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [data, tripId, userId]);

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
  const canViewResults = canManageTrip;
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

  const finalPlanSummary =
    isFinalized && hasFinalDates
      ? `${trip.final_start_date} → ${trip.final_end_date}`
      : "No final plan locked in yet.";
  const dateDecisionValue = hasFinalDates
    ? `${trip.final_start_date} → ${trip.final_end_date}`
    : isPolling
      ? "Waiting on votes"
      : "Not started";
  const destinationDecisionValue = getTripDestinationLabel(trip);

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
        ? "Awaiting responses. Review the signal as the group weighs in."
        : hasResponded
          ? "Your response is in. The group plan will take shape from here."
          : "The date poll is live. Vote on the dates that work best.";
    }
    return "The plan is locked in. Review the itinerary and coordinate details with your group.";
  })();

  const primaryAction = (() => {
    if (isPlannedMode) {
      if (isFinalized) {
        return {
          label: "Open Travel Board",
          description: "Add your travel details and check the group plan.",
          onPress: () => router.push(`/(app)/trips/${tripId}/travel`),
          disabled: false,
        };
      }

      return {
        label: canManageTrip ? "Finish Trip Details" : "Open Notes Board",
        description: canManageTrip
          ? "Use setup to lock in the basic trip details without sending a poll."
          : "Use the shared notes board while the trip details are being finalized.",
        onPress: () =>
          canManageTrip
            ? router.push(`/(app)/trips/${tripId}/setup`)
            : router.push(`/(app)/trips/${tripId}/notes`),
        disabled: false,
      };
    }

    if (role === "guest") {
      if (isFinalized) {
        return {
          label: "Open Travel Board",
          description: "Add your travel details and check the group plan.",
          onPress: () => router.push(`/(app)/trips/${tripId}/travel`),
          disabled: false,
        };
      }
      if (isPolling && !hasResponded) {
        return {
          label: "Vote on Date Poll",
          ctaLabel: "Vote Now",
          description:
            "Vote on the dates that work best so the group can lock the trip.",
          onPress: () => router.push(`/(app)/trips/${tripId}/poll`),
          disabled: checkingResponse,
        };
      }
      if (isPolling && hasResponded) {
        return {
          label: "You're All Set",
          description:
            "You already responded. There’s nothing else you need to do right now.",
          onPress: undefined,
          disabled: true,
        };
      }
      return {
        label: "Awaiting Poll",
        description:
          "The trip is still being prepared before guests can respond.",
        onPress: undefined,
        disabled: true,
      };
    }

    if (stage === "draft") {
      if (draftReady) {
        return {
          label: "Review Poll",
          description:
            "Your poll is ready. Send it, then invite the group right after.",
          onPress:
            canManageTrip
              ? () => router.push(`/(app)/trips/${tripId}/setup`)
              : undefined,
          disabled: !canManageTrip,
        };
      }
      return {
        label: "Continue Setup",
        description:
          "Add the dates for this trip.",
        onPress:
          canManageTrip
            ? () => router.push(`/(app)/trips/${tripId}/setup`)
            : undefined,
        disabled: !canManageTrip,
      };
    }

    if (stage === "polling") {
      return {
        label: "Awaiting Responses",
        description:
          "The poll is live. Check responses as they come in.",
        onPress: canViewResults
          ? () => router.push(`/(app)/trips/${tripId}/poll-results`)
          : undefined,
        disabled: !canViewResults,
      };
    }

    return {
      label: "Open Travel Board",
      description: "Add your travel details and check the group plan.",
      onPress: () => router.push(`/(app)/trips/${tripId}/travel`),
      disabled: false,
    };
  })();

  const datePollStatus =
    stage === "draft" ? "Setup" : stage === "polling" ? "Live" : "Completed";
  const datePollDescription =
    stage === "draft"
      ? canManageTrip
        ? "Add date options and send the date poll when details are ready."
        : "A planner is still preparing the date poll."
      : stage === "polling"
        ? `${responderUserIds.length} of ${members.length} members responded so far.`
        : `${responderUserIds.length} of ${members.length} members submitted date votes.`;
  const datePollAction = (() => {
    if (stage === "draft") {
      if (!canManageTrip) return null;
      return {
        label: draftReady ? "Review Poll" : "Continue Setup",
        onPress: () => router.push(`/(app)/trips/${tripId}/setup`),
      };
    }

    if (stage === "polling") {
      if (role === "guest" && !hasResponded) {
        return {
          label: "Vote Now",
          onPress: () => router.push(`/(app)/trips/${tripId}/poll`),
        };
      }

      if (hasResponded || canManageTrip) {
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
  const respondedMemberNames = members
    .filter((member) => responderUserIds.includes(member.user_id))
    .map(getTripMemberDisplayName);
  const waitingMemberNames = members
    .filter(
      (member) =>
        member.role !== "creator" && !responderUserIds.includes(member.user_id)
    )
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

            <View style={[styles.pollCard, styles.secondaryPollCard]}>
              <View style={styles.pollCardHeader}>
                <View style={styles.pollCardTextBlock}>
                  <Text style={styles.cardTitle}>Stay Poll</Text>
                  <Text style={styles.cardBody}>
                    Stay decisions can start from the shared ideas board once date voting is moving.
                  </Text>
                </View>
                <View style={styles.secondaryPollStateBadge}>
                  <Text style={styles.secondaryPollStateBadgeText}>Secondary</Text>
                </View>
              </View>
              <Pressable
                onPress={() => router.push(`/(app)/trips/${tripId}/notes`)}
                style={({ pressed }) => [
                  styles.secondaryCardButton,
                  pressed ? styles.cardButtonPressed : null,
                ]}
              >
                <Text style={styles.secondaryCardButtonText}>Open Shared Ideas</Text>
              </Pressable>
            </View>
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
            Keep trip links, reminders, and shared planning notes in one place.
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
              <Text style={styles.groupStatusLabel}>Responded members</Text>
              <GroupStatusList
                items={respondedMemberNames}
                emptyText="No responses yet."
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
    padding: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 16,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: "#666" },
  error: { color: "tomato" },

  heroCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#f8f8f8",
    borderWidth: 1,
    borderColor: "#ececec",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: "#111",
  },
  meta: { marginTop: 6, color: "#666", fontSize: 15 },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#111",
  },
  roleBadgeText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ececec",
  },
  statusBadgeText: { color: "#333", fontWeight: "600", fontSize: 12 },
  statusSentence: {
    marginTop: 14,
    color: "#555",
    fontSize: 15,
    lineHeight: 21,
  },
  leaveBtn: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    alignSelf: "flex-start",
  },
  leaveBtnText: { color: "#333", fontWeight: "600" },
  leaveBtnPressed: { opacity: 0.7 },

  primaryCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#111",
  },
  primaryCardEyebrow: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  primaryCardTitle: {
    marginTop: 8,
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },
  primaryCardBody: {
    marginTop: 10,
    color: "rgba(255,255,255,0.82)",
    fontSize: 15,
    lineHeight: 21,
  },
  primaryCtaButton: {
    marginTop: 18,
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 999,
  },
  primaryCtaButtonText: {
    color: "#111",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 15,
  },
  primaryCtaButtonPressed: { opacity: 0.8 },
  primaryCtaButtonDisabled: { opacity: 0.45 },
  primaryCardHint: {
    marginTop: 18,
    color: "rgba(255,255,255,0.7)",
  },

  sectionBlock: {
    gap: 12,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111",
  },

  card: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ececec",
    backgroundColor: "#fff",
    gap: 12,
  },
  pollCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ececec",
    backgroundColor: "#fff",
    gap: 14,
  },
  secondaryPollCard: {
    backgroundColor: "#fafafa",
  },
  pollCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  pollCardTextBlock: {
    flex: 1,
    gap: 6,
  },
  pollStateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#111",
  },
  pollStateBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  secondaryPollStateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#ececec",
  },
  secondaryPollStateBadgeText: {
    color: "#333",
    fontSize: 12,
    fontWeight: "700",
  },
  cardTitle: {
    color: "#111",
    fontSize: 16,
    fontWeight: "700",
  },
  cardBody: {
    color: "#555",
    fontSize: 14,
    lineHeight: 20,
  },
  cardHintText: {
    color: "#666",
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: "#efefef",
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
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  summaryValue: {
    fontSize: 15,
    lineHeight: 20,
    color: "#111",
  },
  groupStatusLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  groupStatusList: {
    gap: 6,
  },
  groupStatusItem: {
    fontSize: 15,
    lineHeight: 20,
    color: "#111",
  },
  groupStatusEmpty: {
    fontSize: 14,
    color: "#666",
  },
  groupStatusNote: {
    fontSize: 14,
    lineHeight: 20,
    color: "#555",
  },
  inlineAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  inlineActionText: {
    color: "#111",
    fontWeight: "600",
  },
  inlineActionPressed: { opacity: 0.7 },

  inviteRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  inviteRoleLabel: { color: "#666", marginRight: 4 },
  inviteRoleOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  inviteRoleOptionActive: { backgroundColor: "#111", borderColor: "#111" },
  inviteRoleOptionText: { color: "#333", fontWeight: "500" },
  inviteRoleOptionTextActive: { color: "#fff" },
  cardButton: {
    marginTop: 2,
    backgroundColor: "#111",
    paddingVertical: 12,
    borderRadius: 999,
  },
  cardButtonText: {
    color: "#fff",
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
    borderColor: "#e5e5e5",
    backgroundColor: "#fff",
  },
  secondaryCardButtonText: {
    color: "#111",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 15,
  },

  progressCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ececec",
    backgroundColor: "#fff",
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
    backgroundColor: "#d5d5d5",
  },
  progressDotComplete: {
    backgroundColor: "#111",
  },
  progressLabel: {
    color: "#666",
    fontSize: 14,
  },
  progressLabelComplete: {
    color: "#111",
    fontWeight: "600",
  },
  finalPlanText: {
    marginTop: 12,
    color: "#111",
    fontSize: 16,
    fontWeight: "600",
  },
});
