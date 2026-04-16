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
  Modal,
  Linking,
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

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "?";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
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
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [invitePreviewUrl, setInvitePreviewUrl] = useState<string | null>(null);
  const [invitePreviewLoading, setInvitePreviewLoading] = useState(false);

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

  useEffect(() => {
    if (!inviteModalOpen) return;

    let active = true;
    (async () => {
      try {
        setInvitePreviewLoading(true);
        const link = await getInviteLink(inviteRole);
        if (active) setInvitePreviewUrl(link);
      } catch {
        if (active) setInvitePreviewUrl(null);
      } finally {
        if (active) setInvitePreviewLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [inviteModalOpen, inviteRole]);

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

  const handleEmailInvite = async () => {
    try {
      const link = invitePreviewUrl ?? await getInviteLink(inviteRole);
      const subject = encodeURIComponent("Join my trip on Togetli");
      const body = encodeURIComponent(
        `Join my trip on Togetli as a ${inviteRole}:\n\n${link}`
      );
      const url = `mailto:?subject=${subject}&body=${body}`;
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Email unavailable", "No mail app is available on this device.");
        return;
      }
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert("Email invite failed", e?.message ?? String(e));
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
            router.replace("/(tabs)/trips");
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

  const pollSummary = `${dateOptions.length} date option${dateOptions.length === 1 ? "" : "s"} • ${budgetOptions.length} budget option${budgetOptions.length === 1 ? "" : "s"}`;
  const finalPlanSummary =
    isFinalized && hasFinalDates
      ? `${trip.final_start_date} → ${trip.final_end_date}`
      : "No final plan locked in yet.";

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
          : "The poll is live. Add your availability and budget preferences.";
    }
    return "The plan is locked in. Review the itinerary and coordinate details with your group.";
  })();

  const primaryAction = (() => {
    if (isPlannedMode) {
      if (isFinalized) {
        return {
          label: "Open Travel Board",
          description: "Add your travel details and check the group plan.",
          onPress: () => router.push(`/(tabs)/trips/${tripId}/travel`),
          disabled: false,
        };
      }

      return {
        label: canManageTrip ? "Finish Trip Details" : "Open Ideas Board",
        description: canManageTrip
          ? "Use setup to lock in the basic trip details without sending a poll."
          : "Use the shared ideas board while the trip details are being finalized.",
        onPress: () =>
          canManageTrip
            ? router.push(`/(tabs)/trips/${tripId}/setup`)
            : router.push(`/(tabs)/trips/${tripId}/notes`),
        disabled: false,
      };
    }

    if (role === "guest") {
      if (isFinalized) {
        return {
          label: "Open Travel Board",
          description: "Add your travel details and check the group plan.",
          onPress: () => router.push(`/(tabs)/trips/${tripId}/travel`),
          disabled: false,
        };
      }
      if (isPolling && !hasResponded) {
        return {
          label: checkingResponse ? "Checking..." : "Fill Out Poll",
          description:
            "Share your availability and budget so the group can finalize the trip.",
          onPress: () => router.push(`/(tabs)/trips/${tripId}/poll`),
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
              ? () => router.push(`/(tabs)/trips/${tripId}/setup`)
              : undefined,
          disabled: !canManageTrip,
        };
      }
      return {
        label: "Continue Setup",
        description:
          "Add the dates and optional budget guidance for this trip.",
        onPress:
          canManageTrip
            ? () => router.push(`/(tabs)/trips/${tripId}/setup`)
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
          ? () => router.push(`/(tabs)/trips/${tripId}/poll-results`)
          : undefined,
        disabled: !canViewResults,
      };
    }

    return {
      label: "Open Travel Board",
      description: "Add your travel details and check the group plan.",
      onPress: () => router.push(`/(tabs)/trips/${tripId}/travel`),
      disabled: false,
    };
  })();

  const metaLabel = tripTypeLabel.replace(" Trip", "") + " Trip";
  const peopleSummary = `${members.length} active members • ${plannerCount} planner${plannerCount === 1 ? "" : "s"} • ${guestCount} guest${guestCount === 1 ? "" : "s"}`;
  const joinedMemberNames = members.map(getTripMemberDisplayName);
  const memberPreviewNames = joinedMemberNames.slice(0, 3);
  const extraMemberCount = Math.max(joinedMemberNames.length - memberPreviewNames.length, 0);
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
        <View style={styles.collabRow}>
          <Pressable
            onPress={() => router.push(`/(tabs)/trips/${tripId}/members`)}
            style={({ pressed }) => [
              styles.memberPreviewButton,
              pressed ? styles.memberPreviewButtonPressed : null,
            ]}
          >
            <View style={styles.memberPillRow}>
              {memberPreviewNames.map((name) => (
                <View key={name} style={styles.memberPill}>
                  <Text style={styles.memberPillText}>{getInitials(name)}</Text>
                </View>
              ))}
              {extraMemberCount > 0 ? (
                <View style={styles.memberOverflowPill}>
                  <Text style={styles.memberOverflowText}>+{extraMemberCount}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.memberPreviewText}>
              {joinedMemberNames.length === 1
                ? "1 member"
                : `${joinedMemberNames.length} members`}
            </Text>
          </Pressable>
          {canInvite ? (
            <Pressable
              onPress={() => setInviteModalOpen(true)}
              style={({ pressed }) => [
                styles.inviteTrigger,
                pressed ? styles.inviteTriggerPressed : null,
              ]}
            >
              <Text style={styles.inviteTriggerText}>+ Invite</Text>
            </Pressable>
          ) : null}
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
              {primaryAction.label}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.primaryCardHint}>
            No action needed right now.
          </Text>
        )}
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeading}>Trip Snapshot</Text>
        <View style={styles.card}>
          <SummaryRow
            label="People"
            value={peopleSummary}
            actionLabel="Manage"
            onPress={() => router.push(`/(tabs)/trips/${tripId}/members`)}
          />
          {isPollMode ? (
            <>
              <View style={styles.divider} />
              <SummaryRow
                label="Poll"
                value={pollSummary}
                actionLabel={canManageTrip ? "Edit" : undefined}
                onPress={
                  canManageTrip
                    ? () => router.push(`/(tabs)/trips/${tripId}/setup`)
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
                    ? () => router.push(`/(tabs)/trips/${tripId}/setup`)
                    : undefined
                }
              />
            </>
          )}
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeading}>Shared Info</Text>
        <View style={styles.card}>
          <Text style={styles.cardBody}>
            Keep trip links, reminders, and shared planning notes in one place.
          </Text>
          <Pressable
            onPress={() => router.push(`/(tabs)/trips/${tripId}/notes`)}
            style={({ pressed }) => [
              styles.cardButton,
              pressed ? styles.cardButtonPressed : null,
            ]}
          >
            <Text style={styles.cardButtonText}>Open Ideas Board</Text>
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

      <Modal
        visible={inviteModalOpen && showInviteSection}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setInviteModalOpen(false)}
        >
          <Pressable style={styles.inviteSheet} onPress={() => {}}>
            <Text style={styles.inviteSheetTitle}>Invite your group</Text>
            <View style={styles.inviteRoleRow}>
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
            </View>
            <View style={styles.inviteLinkRow}>
              <View style={styles.inviteLinkPreview}>
                <Text style={styles.inviteLinkIcon}>Link</Text>
                <Text
                  style={styles.inviteLinkText}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {invitePreviewLoading
                    ? "Loading invite link..."
                    : invitePreviewUrl ?? "Invite link unavailable"}
                </Text>
              </View>
              <Pressable
                onPress={handleCopyInviteLink}
                disabled={copyInviteLoading || !invitePreviewUrl}
                style={({ pressed }) => [
                  styles.inlineCopyButton,
                  (copyInviteLoading || !invitePreviewUrl)
                    ? styles.cardButtonDisabled
                    : null,
                  pressed && !copyInviteLoading && invitePreviewUrl
                    ? styles.cardButtonPressed
                    : null,
                ]}
              >
                <Text style={styles.inlineCopyButtonText}>
                  {copyInviteLoading ? "..." : "Copy"}
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
                {inviteLoading ? "Opening share..." : "Share link"}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleEmailInvite}
              disabled={!invitePreviewUrl && invitePreviewLoading}
              style={({ pressed }) => [
                styles.secondaryCardButton,
                (!invitePreviewUrl && invitePreviewLoading)
                  ? styles.cardButtonDisabled
                  : null,
                pressed ? styles.cardButtonPressed : null,
              ]}
            >
              <Text style={styles.secondaryCardButtonText}>
                Email invite
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setInviteModalOpen(false);
                router.push(`/(tabs)/trips/${tripId}/members`);
              }}
              style={({ pressed }) => [
                styles.inviteManageButton,
                pressed ? styles.cardButtonPressed : null,
              ]}
            >
              <Text style={styles.inviteManageButtonText}>Manage members</Text>
            </Pressable>
            <Pressable
              onPress={() => setInviteModalOpen(false)}
              style={({ pressed }) => [
                styles.inviteCloseButton,
                pressed ? styles.cardButtonPressed : null,
              ]}
            >
              <Text style={styles.inviteCloseButtonText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  collabRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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
  memberPreviewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  memberPreviewButtonPressed: { opacity: 0.75 },
  memberPillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  memberPill: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  memberPillText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  memberOverflowPill: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#e9e9e9",
    alignItems: "center",
    justifyContent: "center",
  },
  memberOverflowText: {
    color: "#333",
    fontSize: 13,
    fontWeight: "700",
  },
  memberPreviewText: {
    flexShrink: 1,
    color: "#555",
    fontSize: 14,
    fontWeight: "600",
  },
  inviteTrigger: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  inviteTriggerPressed: { opacity: 0.8 },
  inviteTriggerText: {
    color: "#111",
    fontWeight: "700",
    fontSize: 14,
  },
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
    gap: 8,
  },
  inviteRoleOption: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    alignItems: "center",
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
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(17,17,17,0.28)",
    padding: 16,
  },
  inviteSheet: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    gap: 12,
    width: "100%",
    maxWidth: 420,
  },
  inviteSheetTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
  },
  inviteLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inviteLinkPreview: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#ececec",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fafafa",
  },
  inviteLinkIcon: {
    color: "#666",
    fontSize: 14,
  },
  inviteLinkText: {
    flex: 1,
    color: "#444",
    fontSize: 14,
  },
  inlineCopyButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineCopyButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  inviteManageButton: {
    paddingVertical: 10,
    alignItems: "center",
  },
  inviteManageButtonText: {
    color: "#111",
    fontSize: 14,
    fontWeight: "600",
  },
  inviteCloseButton: {
    paddingVertical: 10,
    alignItems: "center",
  },
  inviteCloseButtonText: {
    color: "#666",
    fontSize: 15,
    fontWeight: "600",
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
