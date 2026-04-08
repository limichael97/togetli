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
import { useLocalSearchParams, useRouter } from "expo-router";
import { getTripOverview, TripOverview, type TripRole, type TripType } from "../../../lib/trips";
import { buildTripInviteLink, createTripInvite } from "../../../lib/invites";
import { useAuthStore } from "../../../store/useAuthStore";
import { checkIfUserResponded } from "../../../lib/polls";
import { leaveTrip } from "../../../lib/members";
import { getTripStage, isTripReady, type TripStage } from "../../../lib/tripState";

const TRIP_TYPE_LABELS: Record<TripType, string> = {
  bachelor: "Bachelor Trip",
  bachelorette: "Bachelorette Trip",
  joint: "Group Trip",
};

const ROLE_LABELS: Record<TripRole, string> = {
  creator: "Creator",
  planner: "Planner",
  guest: "Guest",
};

const STAGE_LABELS: Record<TripStage, string> = {
  draft: "Draft",
  polling: "Poll Sent",
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
      <View style={[styles.progressDot, complete ? styles.progressDotComplete : null]} />
      <Text style={[styles.progressLabel, complete ? styles.progressLabelComplete : null]}>
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

export default function TripDetailScreen() {
  const params = useLocalSearchParams();
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);

  const [data, setData] = useState<TripOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);
  const [checkingResponse, setCheckingResponse] = useState(false);

  useEffect(() => {
    if (!tripId) return;

    let mounted = true;

    (async () => {
      try {
        setErrorMsg(null);
        setLoading(true);
        const res = await getTripOverview(tripId);
        if (mounted) setData(res);
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

    const pollSent = !!data?.trip.poll_sent_at;
    const myMember = data?.members.find((m) => m.user_id === userId);

    if (!pollSent || myMember?.role === "creator") {
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

  const copyInviteLink = async (link: string) => {
    const clipboard = (globalThis as any)?.navigator?.clipboard;
    if (clipboard?.writeText) {
      await clipboard.writeText(link);
      Alert.alert("Copied", "Invite link copied to clipboard.");
      return;
    }
    console.log("[invite] clipboard not available, link:", link);
  };

  const handleInvite = async () => {
    if (!tripId) return;

    try {
      setInviteLoading(true);
      const { token } = await createTripInvite(tripId, "guest");
      const link = buildTripInviteLink(token);

      Alert.alert("Invite link", link, [
        { text: "Copy", onPress: () => copyInviteLink(link) },
        { text: "Share", onPress: () => Share.share({ message: link }) },
        { text: "Close", style: "cancel" },
      ]);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Invite failed", e?.message ?? String(e));
    } finally {
      setInviteLoading(false);
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

  const { trip, members, dateOptions, budgetOptions } = data;
  const myMember = members.find((m) => m.user_id === userId);
  const role = myMember?.role ?? "guest";
  const roleLabel = ROLE_LABELS[role];
  const tripTypeLabel = TRIP_TYPE_LABELS[trip.type];
  const pollSent = !!trip.poll_sent_at;
  const isFinalized = !!trip.final_start_date && !!trip.final_end_date;
  const canInvite = role === "creator";
  const canViewResults = role === "creator" || role === "planner";
  const plannerCount = members.filter((m) => m.role === "planner").length;
  const guestCount = members.filter((m) => m.role === "guest").length;
  const stage = getTripStage(data);
  const draftReady = stage === "draft" && isTripReady(data);

  const pollSummary = `${dateOptions.length} date option${dateOptions.length === 1 ? "" : "s"} • ${budgetOptions.length} budget option${budgetOptions.length === 1 ? "" : "s"}`;
  const finalPlanSummary = isFinalized
    ? `${trip.final_start_date} → ${trip.final_end_date}`
    : "No final plan locked in yet.";

  const statusSentence = (() => {
    if (stage === "draft") {
      if (draftReady) {
        return role === "creator"
          ? "Everything is ready. Review the poll and send it to the group."
          : "The poll is almost ready. The creator can send it once details look good.";
      }
      return role === "creator"
        ? "Add the essentials so the group has a clear poll to respond to."
        : "The trip is being set up before the poll goes live.";
    }
    if (stage === "polling") {
      return canViewResults
        ? "Responses are coming in. Review the signal and move the plan forward."
        : hasResponded
          ? "Your response is in. The group plan will take shape from here."
          : "The poll is live. Add your availability and budget preferences.";
    }
    return "The dates are locked in and the trip plan is ready to review.";
  })();

  const primaryAction = (() => {
    if (role === "guest") {
      if (pollSent && !hasResponded) {
        return {
          label: checkingResponse ? "Checking..." : "Fill Out Poll",
          description: "Share your availability and budget so the group can finalize the trip.",
          onPress: () => router.push(`/(app)/trips/${tripId}/poll`),
          disabled: checkingResponse,
        };
      }
      if (pollSent && hasResponded) {
        return {
          label: "You're All Set",
          description: "You already responded. There’s nothing else you need to do right now.",
          onPress: undefined,
          disabled: true,
        };
      }
      return {
        label: "Awaiting Poll",
        description: "The trip is still being prepared before guests can respond.",
        onPress: undefined,
        disabled: true,
      };
    }

    if (stage === "draft") {
      if (draftReady) {
        return {
          label: "Review & Send Poll",
          description: "Your poll is ready. Give it one last pass and send it to the group.",
          onPress: role === "creator" ? () => router.push(`/(app)/trips/${tripId}/setup`) : undefined,
          disabled: role !== "creator",
        };
      }
      return {
        label: "Add Dates & Budget",
        description: "Set the poll up so your group has something concrete to vote on.",
        onPress: role === "creator" ? () => router.push(`/(app)/trips/${tripId}/setup`) : undefined,
        disabled: role !== "creator",
      };
    }

    if (stage === "polling") {
      return {
        label: "View Responses",
        description: "See how the group is voting so you can decide the next step.",
        onPress: canViewResults ? () => router.push(`/(app)/trips/${tripId}/poll-results`) : undefined,
        disabled: !canViewResults,
      };
    }

    return {
      label: "View Itinerary",
      description: "The dates are finalized. Review the confirmed trip window.",
      onPress: () =>
        Alert.alert(
          "Final itinerary",
          `${trip.final_start_date} → ${trip.final_end_date}`
        ),
      disabled: false,
    };
  })();

  const metaLabel = tripTypeLabel.replace(" Trip", "") + " Trip";
  const peopleSummary = `${members.length} active members • ${plannerCount} planner${plannerCount === 1 ? "" : "s"} • ${guestCount} guest${guestCount === 1 ? "" : "s"}`;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
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
            {trip.final_start_date} → {trip.final_end_date}
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
              pressed && !primaryAction.disabled ? styles.primaryCtaButtonPressed : null,
            ]}
          >
            <Text style={styles.primaryCtaButtonText}>{primaryAction.label}</Text>
          </Pressable>
        ) : (
          <Text style={styles.primaryCardHint}>No action needed right now.</Text>
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
          <View style={styles.divider} />
          <SummaryRow
            label="Poll"
            value={pollSummary}
            actionLabel={role === "creator" ? "Edit" : undefined}
            onPress={role === "creator" ? () => router.push(`/(app)/trips/${tripId}/setup`) : undefined}
          />
        </View>
      </View>

      {canInvite ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Invite</Text>
          <View style={styles.card}>
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
                {inviteLoading ? "Creating..." : "Invite People"}
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
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.3, color: "#111" },
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
  cardBody: {
    color: "#555",
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
