import React, { useEffect, useRef, useState } from "react";
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
  Dimensions,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getTripOverview,
  getTripMemberDisplayName,
  TripOverview,
  TRIP_TYPE_OPTIONS,
  getTripTypeLabel,
  type TripRole,
  type TripType,
  deleteTrip,
  updateTripTitle,
  updateTripType,
} from "../../../lib/trips";
import {
  buildTripInviteLink,
  getOrCreateTripInvite,
  listPendingTripInvites,
  type PendingTripInvite,
} from "../../../lib/invites";
import { useAuthStore } from "../../../store/useAuthStore";
import {
  hasAvailabilityPollResponse,
  hasStayPollResponse,
  listPollResponseDetails,
  parseStayPollDefinition,
  type StayPollDefinition,
} from "../../../lib/polls";
import { leaveTrip } from "../../../lib/members";
import {
  getTripStage,
  isPollTrip,
  isTripReady,
  type TripStage,
} from "../../../lib/tripState";
import { supabase } from "../../../supabaseClient";
import { AppInput } from "../../../components/ui/AppInput";
import { AppButton } from "../../../components/ui/AppButton";
import { getTripAwareCopy } from "../../../lib/tripCopy";

const ROLE_LABELS: Record<TripRole, string> = {
  creator: "Creator",
  planner: "Planner",
  guest: "Guest",
};

const STAGE_LABELS: Record<TripStage, string> = {
  draft: "Planning",
  polling: "Live",
  finalized: "Finalized",
};

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
  const [pendingInvites, setPendingInvites] = useState<PendingTripInvite[]>([]);
  const [responderUserIds, setResponderUserIds] = useState<string[]>([]);
  const [stayResponderUserIds, setStayResponderUserIds] = useState<string[]>([]);
  const [inviteLinks, setInviteLinks] = useState<
    Partial<Record<Exclude<TripRole, "creator">, string>>
  >({});
  const [inviteRole, setInviteRole] = useState<Exclude<TripRole, "creator">>("guest");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [invitePreviewUrl, setInvitePreviewUrl] = useState<string | null>(null);
  const [invitePreviewLoading, setInvitePreviewLoading] = useState(false);
  const [stayPollDefinition, setStayPollDefinition] =
    useState<StayPollDefinition | null>(null);
  const [editTitleModalOpen, setEditTitleModalOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({
    top: 72,
    left: 16,
  });
  const [changeTypeModalOpen, setChangeTypeModalOpen] = useState(false);
  const [savingTripType, setSavingTripType] = useState(false);
  const menuButtonRef = useRef<View | null>(null);

  useEffect(() => {
    if (!tripId) return;

    let mounted = true;

    (async () => {
      try {
        setErrorMsg(null);
        setLoading(true);
        const res = await getTripOverview(tripId);
        const inviteRows = await listPendingTripInvites(tripId);
        const responseDetails = await listPollResponseDetails(tripId);
        const stayPollRow = await supabase
          .from("trips")
          .select("custom_poll_questions")
          .eq("id", tripId)
          .single();

        if (!mounted) return;
        if (stayPollRow.error) throw stayPollRow.error;

        const eligibleVotingUserIds = new Set(
          res.members
            .filter((member) => member.role !== "creator")
            .map((member) => member.user_id)
        );
        setData(res);
        setPendingInvites(inviteRows);
        setResponderUserIds(
          Array.from(
            new Set(
              responseDetails
                .filter(hasAvailabilityPollResponse)
                .map((row) => row.user_id)
                .filter(
                  (id): id is string =>
                    !!id && eligibleVotingUserIds.has(id)
                )
            )
          )
        );
        setStayResponderUserIds(
          Array.from(
            new Set(
              responseDetails
                .filter(hasStayPollResponse)
                .map((row) => row.user_id)
                .filter(Boolean)
            )
          ) as string[]
        );
        setStayPollDefinition(
          parseStayPollDefinition(stayPollRow.data?.custom_poll_questions ?? null)
        );
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
      return [
        ...prev,
        {
          id: invite.id,
          role: invite.role,
          created_at: invite.created_at,
        },
      ];
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
      Alert.alert("Copy failed", e?.message ?? String(e));
    } finally {
      setCopyInviteLoading(false);
    }
  };

  const handleEmailInvite = async () => {
    try {
      const link = invitePreviewUrl ?? (await getInviteLink(inviteRole));
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

  const handleDeleteTrip = () => {
    if (!tripId) return;

    Alert.alert(
      "Delete trip?",
      "This will permanently delete the trip and its related planning data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTrip(tripId);
              router.replace("/(tabs)/trips");
            } catch (e: any) {
              Alert.alert("Delete failed", e?.message ?? String(e));
            }
          },
        },
      ]
    );
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

  const { trip, members } = data;
  const myMember = members.find((m) => m.user_id === userId);
  const role = myMember?.role ?? "guest";
  const roleLabel = ROLE_LABELS[role];
  const tripTypeLabel = getTripTypeLabel(trip.type);
  const tripCopy = getTripAwareCopy(trip.type);
  const canManageTrip = role === "creator" || role === "planner";
  const canInvite = canManageTrip;
  const showInviteSection = canInvite;
  const stage = getTripStage(data);
  const isPollMode = isPollTrip(trip.mode);
  const isPlannedMode = !isPollMode;
  const isFinalized = stage === "finalized";
  const draftReady = stage === "draft" && isTripReady(data);
  const plannerCount = members.filter((m) => m.role === "planner").length;
  const guestCount = members.filter((m) => m.role === "guest").length;
  const eligibleVotingMemberCount = plannerCount + guestCount;
  const hasResponded = !!userId && responderUserIds.includes(userId);
  const hasRespondedToStayPoll = !!userId && stayResponderUserIds.includes(userId);
  const canVoteAvailabilityPoll = role !== "creator";
  const stayPollExists = !!stayPollDefinition;
  const finalizedStayOption = stayPollDefinition?.finalized_winner_note_id
    ? stayPollDefinition.options.find(
        (option) =>
          option.source_note_id === stayPollDefinition.finalized_winner_note_id
      ) ?? null
    : null;
  const stayPollIsFinalized = !!finalizedStayOption;
  const availabilityPollIsLive = stage === "polling";
  const stayPollIsLive = stayPollExists && !stayPollIsFinalized;
  const availabilityNeedsUserVote =
    availabilityPollIsLive && canVoteAvailabilityPoll && !hasResponded;
  const stayNeedsUserVote = stayPollIsLive && !hasRespondedToStayPoll;
  const hasInviteLinks = pendingInvites.length > 0;
  const shouldFocusInvite =
    canInvite && !isFinalized && (members.length < 2 || !hasInviteLinks);

  const primaryAction = (() => {
    if (shouldFocusInvite) {
      return {
        label: tripCopy.inviteActionLabel,
        description:
          "Bring people into the trip first so setup and poll decisions reach the right group.",
        onPress: () => setInviteModalOpen(true),
        disabled: false,
      };
    }

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
        label: canManageTrip ? "Finish Trip Details" : "Open Ideas",
        description: canManageTrip
          ? "Lock in the trip basics so everyone has a clear plan to coordinate around."
          : "Use the shared ideas board while the trip details are being finalized.",
        onPress: () =>
          canManageTrip
            ? router.push(`/(tabs)/trips/${tripId}/setup`)
            : router.push(`/(tabs)/trips/${tripId}/notes`),
        disabled: false,
      };
    }

    if (stage === "draft") {
      return {
        label: draftReady ? "Review Date Poll" : "Set Up Date Poll",
        description: draftReady
          ? "The date poll is ready for review before it goes live."
          : "Add the dates so the group can start voting.",
        onPress:
          canManageTrip
            ? () => router.push(`/(tabs)/trips/${tripId}/setup`)
            : undefined,
        disabled: !canManageTrip,
      };
    }

    if (availabilityNeedsUserVote) {
      return {
        label: "Vote on Date Poll",
        description:
          "Vote on the dates that work best so the group can lock the trip.",
        onPress: () =>
          router.push(`/(tabs)/trips/${tripId}/poll?pollKind=availability`),
        disabled: false,
      };
    }

    if (stayNeedsUserVote) {
      return {
        label: "Vote on Stay Poll",
        description: tripCopy.stayVoteDescription,
        onPress: () => router.push(`/(tabs)/trips/${tripId}/poll?pollKind=stay`),
        disabled: false,
      };
    }

    if (canManageTrip && (availabilityPollIsLive || stayPollIsLive)) {
      return {
        label: stayPollIsLive
          ? "Review Stay Poll Results"
          : "Review Date Poll Results",
        description: stayPollIsLive
          ? "Track the stay rankings and see where the group is landing."
          : "Review incoming date votes and see where consensus is forming.",
        onPress: () =>
          router.push(
            stayPollIsLive
              ? `/(tabs)/trips/${tripId}/poll-results?pollKind=stay`
              : `/(tabs)/trips/${tripId}/poll-results?pollKind=availability`
          ),
        disabled: false,
      };
    }

    if (isFinalized) {
      return {
        label: "Open Travel Board",
        description: "Add your travel details and check the group plan.",
        onPress: () => router.push(`/(tabs)/trips/${tripId}/travel`),
        disabled: false,
      };
    }

    if (role === "guest") {
      return {
        label: "Awaiting Votes",
        description:
          "You’re up to date. Check back as the rest of the group votes.",
        onPress: undefined,
        disabled: true,
      };
    }

    return {
      label: "Awaiting Votes",
      description:
        "You’re up to date. Check back as the rest of the group votes.",
      onPress: undefined,
      disabled: true,
    };
  })();

  const availabilityWaitingCount = Math.max(
    eligibleVotingMemberCount - responderUserIds.length,
    0
  );
  const allEligibleAvailabilityVotersVoted =
    eligibleVotingMemberCount > 0 && availabilityWaitingCount === 0;
  const datePollExists =
    isFinalized || stage !== "draft" || data.dateOptions.length > 0;
  const availabilityPollStatus =
    isFinalized
      ? "Dates locked"
      : stage === "draft"
        ? "Setup required"
        : stage === "polling" && responderUserIds.length === 0
          ? "No votes yet"
          : stage === "polling" && !allEligibleAvailabilityVotersVoted
            ? `Waiting on ${availabilityWaitingCount}`
            : stage === "polling"
              ? "Ready to finalize"
              : "Dates locked";
  const availabilityPollDescription =
    stage === "draft"
      ? canManageTrip
        ? "Finish setup and send the date poll when details are ready."
        : "A planner is still preparing the date poll."
      : stage === "polling"
        ? `${responderUserIds.length} of ${eligibleVotingMemberCount} voted.`
        : `${responderUserIds.length} of ${eligibleVotingMemberCount} voted.`;
  const availabilityPollAction = (() => {
    if (stage === "draft") {
      if (!canManageTrip) return null;
      return {
        label: "Continue Setup",
        onPress: () => router.push(`/(tabs)/trips/${tripId}/setup`),
      };
    }

    if (stage === "polling") {
      if (availabilityNeedsUserVote) {
        return {
          label: "Vote Now",
          onPress: () =>
            router.push(`/(tabs)/trips/${tripId}/poll?pollKind=availability`),
        };
      }

      if (hasResponded || canManageTrip) {
        return {
          label: "View Results",
          onPress: () =>
            router.push(`/(tabs)/trips/${tripId}/poll-results?pollKind=availability`),
        };
      }

      return null;
    }

    return {
      label: "View Results",
      onPress: () =>
        router.push(`/(tabs)/trips/${tripId}/poll-results?pollKind=availability`),
    };
  })();

  const stayPollStatus = !stayPollExists
    ? "Not created"
    : stayPollIsFinalized
      ? "Finalized"
      : "Live";
  const stayPollDescription = !stayPollExists
    ? canManageTrip
      ? tripCopy.stayPollLaunchDescription
      : tripCopy.stayPollBrowseDescription
    : stayPollIsFinalized
      ? finalizedStayOption?.title ?? "A stay has been finalized."
      : `${stayResponderUserIds.length} of ${members.length} members voted so far.`;
  const stayPollAction = (() => {
    if (!stayPollExists) {
      return {
        label: "Start with Ideas",
        onPress: () => router.push(`/(tabs)/trips/${tripId}/notes`),
      };
    }

    if (stayPollIsFinalized) {
      return {
        label: "View Results",
        onPress: () =>
          router.push(`/(tabs)/trips/${tripId}/poll-results?pollKind=stay`),
      };
    }

    if (stayNeedsUserVote) {
      return {
        label: "Vote Now",
        onPress: () => router.push(`/(tabs)/trips/${tripId}/poll?pollKind=stay`),
      };
    }

    return {
      label: "View Results",
      onPress: () =>
        router.push(`/(tabs)/trips/${tripId}/poll-results?pollKind=stay`),
    };
  })();

  const metaLabel = tripTypeLabel;
  const memberPreviewNames = members
    .map(getTripMemberDisplayName)
    .slice(0, 3);
  const extraMemberCount = Math.max(members.length - memberPreviewNames.length, 0);
  const memberCountText = `${members.length} active member${members.length === 1 ? "" : "s"}`;
  const memberMixText = `${plannerCount} planner${plannerCount === 1 ? "" : "s"} • ${guestCount} guest${guestCount === 1 ? "" : "s"}`;
  const openEditTitle = () => {
    setTitleDraft(trip.title ?? "");
    setEditTitleModalOpen(true);
    setMenuOpen(false);
  };

  const handleOpenMenu = () => {
    const fallbackPosition = {
      top: 72,
      left: Dimensions.get("window").width - 236,
    };

    if (!menuButtonRef.current?.measureInWindow) {
      setMenuPosition(fallbackPosition);
      setMenuOpen(true);
      return;
    }

    menuButtonRef.current.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get("window").width;
      const menuWidth = 220;
      const horizontalMargin = 16;

      setMenuPosition({
        top: y + height + 8,
        left: Math.min(
          Math.max(horizontalMargin, x + width - menuWidth),
          screenWidth - menuWidth - horizontalMargin
        ),
      });
      setMenuOpen(true);
    });
  };

  const handleSaveTripTitle = async () => {
    const trimmedTitle = titleDraft.trim();
    if (!trimmedTitle || !tripId) {
      Alert.alert("Trip name required", "Enter a trip name before saving.");
      return;
    }

    try {
      setSavingTitle(true);
      const updatedTrip = await updateTripTitle({
        tripId,
        title: trimmedTitle,
      });
      setData((current) =>
        current
          ? {
              ...current,
              trip: {
                ...current.trip,
                title: updatedTrip.title,
              },
            }
          : current
      );
      setEditTitleModalOpen(false);
    } catch (e: any) {
      Alert.alert("Couldn't update trip name", e?.message ?? String(e));
    } finally {
      setSavingTitle(false);
    }
  };

  const handleChangeTripType = async (nextType: TripType) => {
    if (!tripId || nextType === trip.type) {
      setChangeTypeModalOpen(false);
      return;
    }

    try {
      setSavingTripType(true);
      const updatedTrip = await updateTripType({
        tripId,
        type: nextType,
      });
      setData((current) =>
        current
          ? {
              ...current,
              trip: {
                ...current.trip,
                type: updatedTrip.type,
              },
            }
          : current
      );
      setChangeTypeModalOpen(false);
    } catch (e: any) {
      Alert.alert("Couldn't update trip type", e?.message ?? String(e));
    } finally {
      setSavingTripType(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <View style={styles.titleRow}>
          <View style={styles.titleTextBlock}>
            <Text style={styles.title}>{trip.title ?? "Untitled Trip"}</Text>
            <Text style={styles.meta}>{metaLabel}</Text>
          </View>
          <Pressable
            ref={menuButtonRef}
            onPress={handleOpenMenu}
            style={({ pressed }) => [
              styles.menuButton,
              pressed ? styles.inlineActionPressed : null,
            ]}
          >
            <Text style={styles.menuButtonText}>⋯</Text>
          </Pressable>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleLabel}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{STAGE_LABELS[stage]}</Text>
          </View>
        </View>

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
          <View style={styles.memberPreviewTextBlock}>
            <Text style={styles.memberPreviewText}>{memberCountText}</Text>
            <Text style={styles.memberPreviewSubtext}>{memberMixText}</Text>
          </View>
          <Text style={styles.memberChevron}>›</Text>
        </Pressable>
        {canInvite ? (
          <Pressable
            onPress={() => setInviteModalOpen(true)}
            style={({ pressed }) => [
              styles.compactInviteButton,
              pressed ? styles.inlineActionPressed : null,
            ]}
          >
            <Text style={styles.compactInviteButtonText}>+ Invite</Text>
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
            <Text style={styles.primaryCtaButtonText}>{primaryAction.label}</Text>
          </Pressable>
        ) : (
          <Text style={styles.primaryCardHint}>No action needed right now.</Text>
        )}
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeading}>Polls</Text>

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
                onPress={() => router.push(`/(tabs)/trips/${tripId}/setup`)}
                style={({ pressed }) => [
                  styles.cardButton,
                  styles.fullWidthButton,
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
                <Text style={styles.cardBody}>{availabilityPollDescription}</Text>
              </View>
              <View style={styles.pollStateBadge}>
                <Text style={styles.pollStateBadgeText}>{availabilityPollStatus}</Text>
              </View>
            </View>
            {availabilityPollAction ? (
              <Pressable
                onPress={availabilityPollAction.onPress}
                style={({ pressed }) => [
                  styles.cardButton,
                  styles.fullWidthButton,
                  pressed ? styles.cardButtonPressed : null,
                ]}
              >
                <Text style={styles.cardButtonText}>{availabilityPollAction.label}</Text>
              </Pressable>
            ) : (
              <Text style={styles.cardHintText}>No action needed right now.</Text>
            )}
          </View>
        )}

        {stayPollExists ? (
          <View style={styles.pollCard}>
            <View style={styles.pollCardHeader}>
              <View style={styles.pollCardTextBlock}>
                <Text style={styles.cardTitle}>Stay Poll</Text>
                <Text style={styles.cardBody}>{stayPollDescription}</Text>
                {stayPollIsFinalized ? (
                  <Text style={styles.cardHintText}>
                    The group has completed the stay poll and locked in its stay choice.
                  </Text>
                ) : null}
              </View>
              <View style={styles.pollStateBadge}>
                <Text style={styles.pollStateBadgeText}>{stayPollStatus}</Text>
              </View>
            </View>
            {stayPollAction ? (
              <View style={styles.cardActionStack}>
                <Pressable
                  onPress={stayPollAction.onPress}
                  style={({ pressed }) => [
                    styles.cardButton,
                    styles.fullWidthButton,
                    pressed ? styles.cardButtonPressed : null,
                  ]}
                >
                  <Text style={styles.cardButtonText}>{stayPollAction.label}</Text>
                </Pressable>
                {stayPollIsFinalized && finalizedStayOption?.link ? (
                  <Pressable
                    onPress={() => Linking.openURL(finalizedStayOption.link!)}
                    style={({ pressed }) => [
                      styles.secondaryCardButton,
                      styles.fullWidthButton,
                      pressed ? styles.cardButtonPressed : null,
                    ]}
                  >
                    <Text style={styles.secondaryCardButtonText}>View Listing</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Text style={styles.cardHintText}>No action needed right now.</Text>
            )}
          </View>
        ) : null}
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeading}>Shared Ideas</Text>
        <View style={styles.card}>
          <Text style={styles.cardBody}>
            Save stays, restaurants, activities, and links for the trip.
          </Text>
          <Pressable
            onPress={() => router.push(`/(tabs)/trips/${tripId}/notes`)}
            style={({ pressed }) => [
              styles.cardButton,
              styles.fullWidthButton,
              pressed ? styles.cardButtonPressed : null,
            ]}
          >
            <Text style={styles.cardButtonText}>Open Ideas</Text>
          </Pressable>
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
            <Text style={styles.inviteSheetTitle}>{tripCopy.inviteModalTitle}</Text>
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
                    inviteRole === "planner"
                      ? styles.inviteRoleOptionTextActive
                      : null,
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
                    inviteRole === "guest"
                      ? styles.inviteRoleOptionTextActive
                      : null,
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
                  copyInviteLoading || !invitePreviewUrl
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
                styles.fullWidthButton,
                inviteLoading ? styles.cardButtonDisabled : null,
                pressed && !inviteLoading ? styles.cardButtonPressed : null,
              ]}
            >
              <Text style={styles.cardButtonText}>
                {inviteLoading ? "Opening share..." : "Share Link"}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleEmailInvite}
              disabled={!invitePreviewUrl && invitePreviewLoading}
              style={({ pressed }) => [
                styles.secondaryCardButton,
                styles.fullWidthButton,
                !invitePreviewUrl && invitePreviewLoading
                  ? styles.cardButtonDisabled
                  : null,
                pressed ? styles.cardButtonPressed : null,
              ]}
            >
              <Text style={styles.secondaryCardButtonText}>Email Invite</Text>
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

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable
            style={[
              styles.menuSheet,
              {
                top: menuPosition.top,
                left: menuPosition.left,
              },
            ]}
            onPress={() => {}}
          >
            {canManageTrip ? (
              <>
                <Pressable
                  onPress={openEditTitle}
                  style={({ pressed }) => [
                    styles.menuItem,
                    pressed ? styles.cardButtonPressed : null,
                  ]}
                >
                  <Text style={styles.menuItemText}>Edit Trip Name</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setMenuOpen(false);
                    setChangeTypeModalOpen(true);
                  }}
                  style={({ pressed }) => [
                    styles.menuItem,
                    pressed ? styles.cardButtonPressed : null,
                  ]}
                >
                  <Text style={styles.menuItemText}>Change Trip Type</Text>
                </Pressable>
              </>
            ) : null}
            {role !== "creator" ? (
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  handleLeaveTrip();
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed ? styles.cardButtonPressed : null,
                ]}
              >
                <Text style={styles.menuItemText}>Leave Trip</Text>
              </Pressable>
            ) : null}
            {canManageTrip ? (
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  handleDeleteTrip();
                }}
                style={({ pressed }) => [
                  styles.menuItem,
                  pressed ? styles.cardButtonPressed : null,
                ]}
              >
                <Text style={styles.menuItemDestructive}>Delete Trip</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setMenuOpen(false)}
              style={({ pressed }) => [
                styles.menuCloseButton,
                pressed ? styles.cardButtonPressed : null,
              ]}
            >
              <Text style={styles.menuCloseButtonText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={editTitleModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditTitleModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => (!savingTitle ? setEditTitleModalOpen(false) : undefined)}
        >
          <Pressable style={styles.editSheet} onPress={() => {}}>
            <Text style={styles.inviteSheetTitle}>Edit Trip Name</Text>
            <AppInput
              label="Trip Name"
              value={titleDraft}
              onChangeText={setTitleDraft}
              editable={!savingTitle}
              autoFocus
            />
            <AppButton
              label={savingTitle ? "Saving..." : "Save"}
              onPress={handleSaveTripTitle}
              disabled={savingTitle || !titleDraft.trim()}
            />
            <Pressable
              onPress={() => setEditTitleModalOpen(false)}
              disabled={savingTitle}
              style={({ pressed }) => [
                styles.inviteCloseButton,
                pressed && !savingTitle ? styles.cardButtonPressed : null,
              ]}
            >
              <Text style={styles.inviteCloseButtonText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={changeTypeModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setChangeTypeModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => (!savingTripType ? setChangeTypeModalOpen(false) : undefined)}
        >
          <Pressable style={styles.editSheet} onPress={() => {}}>
            <Text style={styles.inviteSheetTitle}>Change Trip Type</Text>
            <Text style={styles.modalHelperText}>
              Choose the trip type that fits this trip best.
            </Text>
            <View style={styles.typeOptionsList}>
              {TRIP_TYPE_OPTIONS.map((option) => {
                const selected = trip.type === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => void handleChangeTripType(option.value)}
                    disabled={savingTripType}
                    style={({ pressed }) => [
                      styles.typeOption,
                      selected ? styles.typeOptionSelected : null,
                      pressed && !savingTripType ? styles.cardButtonPressed : null,
                    ]}
                  >
                    <View style={styles.typeOptionRow}>
                      <Text
                        style={[
                          styles.typeOptionText,
                          selected ? styles.typeOptionTextSelected : null,
                        ]}
                      >
                        {option.label}
                      </Text>
                      {selected ? (
                        <View style={styles.typeOptionBadge}>
                          <Text style={styles.typeOptionBadgeText}>Selected</Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => setChangeTypeModalOpen(false)}
              disabled={savingTripType}
              style={({ pressed }) => [
                styles.modalSecondaryButton,
                pressed && !savingTripType ? styles.cardButtonPressed : null,
              ]}
            >
              <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 18,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 14,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: "#666" },
  error: { color: "tomato" },

  heroCard: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#f8f8f8",
    borderWidth: 1,
    borderColor: "#ececec",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  titleTextBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: "#111",
  },
  meta: { color: "#666", fontSize: 14 },
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
    backgroundColor: "#111",
  },
  roleBadgeText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#ececec",
  },
  statusBadgeText: { color: "#333", fontWeight: "600", fontSize: 12 },
  memberPreviewButton: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    borderWidth: 1,
    borderColor: "#ededed",
    borderRadius: 16,
    padding: 11,
    backgroundColor: "#fff",
  },
  memberPreviewButtonPressed: { opacity: 0.75 },
  memberPillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  memberPill: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  memberPillText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  memberOverflowPill: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "#e9e9e9",
    alignItems: "center",
    justifyContent: "center",
  },
  memberOverflowText: {
    color: "#333",
    fontSize: 12,
    fontWeight: "700",
  },
  memberPreviewTextBlock: {
    flex: 1,
    gap: 3,
  },
  memberPreviewText: {
    color: "#111",
    fontSize: 14,
    fontWeight: "700",
  },
  memberPreviewSubtext: {
    color: "#555",
    fontSize: 13,
  },
  memberChevron: {
    color: "#9ca3af",
    fontSize: 22,
    fontWeight: "600",
  },
  compactInviteButton: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    backgroundColor: "#fff",
  },
  compactInviteButtonText: {
    color: "#111",
    fontWeight: "600",
    fontSize: 13,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  menuButtonText: {
    color: "#111",
    fontSize: 22,
    fontWeight: "700",
  },

  primaryCard: {
    padding: 16,
    borderRadius: 18,
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
    marginTop: 6,
    color: "#fff",
    fontSize: 21,
    fontWeight: "700",
  },
  primaryCardBody: {
    marginTop: 8,
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
    lineHeight: 20,
  },
  primaryCtaButton: {
    marginTop: 14,
    backgroundColor: "#fff",
    paddingVertical: 12,
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
    marginTop: 14,
    color: "rgba(255,255,255,0.7)",
  },

  sectionBlock: {
    gap: 9,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111",
  },
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ececec",
    backgroundColor: "#fff",
    gap: 10,
  },
  pollCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ececec",
    backgroundColor: "#fff",
    gap: 10,
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
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
  },
  pollStateBadgeText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111",
  },
  cardBody: {
    color: "#555",
    fontSize: 14,
    lineHeight: 19,
  },
  cardHintText: {
    color: "#666",
    fontSize: 13,
    lineHeight: 18,
  },
  cardActionStack: {
    gap: 10,
  },
  inlineAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    backgroundColor: "#fff",
  },
  inlineActionText: {
    color: "#111",
    fontWeight: "600",
  },
  inlineActionPressed: { opacity: 0.7 },

  cardButton: {
    marginTop: 2,
    backgroundColor: "#111",
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
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
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryCardButtonText: {
    color: "#111",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 15,
  },
  rowButton: {
    flex: 1,
  },
  fullWidthButton: {
    width: "100%",
  },

  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,17,17,0.1)",
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
  editSheet: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    width: "100%",
    maxWidth: 420,
  },
  menuSheet: {
    position: "absolute",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 12,
    width: 220,
    gap: 4,
    borderWidth: 1,
    borderColor: "#ececec",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  inviteSheetTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
  },
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
  modalHelperText: {
    marginTop: 8,
    marginBottom: 16,
    color: "#666",
    fontSize: 14,
    lineHeight: 20,
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 14,
  },
  menuItemText: {
    color: "#111",
    fontSize: 15,
    fontWeight: "600",
  },
  menuItemDestructive: {
    color: "#b91c1c",
    fontSize: 15,
    fontWeight: "600",
  },
  menuCloseButton: {
    marginTop: 4,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  menuCloseButtonText: {
    color: "#444",
    fontSize: 14,
    fontWeight: "600",
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
  typeOption: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  typeOptionSelected: {
    borderColor: "#111",
    backgroundColor: "#f7f7f7",
  },
  typeOptionsList: {
    gap: 10,
    marginBottom: 16,
  },
  typeOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  typeOptionText: {
    color: "#111",
    fontSize: 15,
    fontWeight: "600",
  },
  typeOptionTextSelected: {
    color: "#111",
  },
  typeOptionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#111",
  },
  typeOptionBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  modalSecondaryButton: {
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryButtonText: {
    color: "#444",
    fontSize: 15,
    fontWeight: "600",
  },
});
