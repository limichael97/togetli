import React, { useCallback, useMemo, useState } from "react";
import {
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { listMyTrips, TripRow } from "../../../lib/trips";
import { useAuthStore } from "../../../store/useAuthStore";
import {
  hasAvailabilityPollResponse,
  hasStayPollResponse,
  listPollResponseDetailsForTrips,
  parseStayPollDefinition,
} from "../../../lib/polls";
import { supabase } from "../../../supabaseClient";
import { getTripTypeLabel } from "../../../lib/trips";
import { useProfile } from "../../../lib/useProfile";
import { getProfileDisplayName } from "../../../lib/profile";
import { colors, radius } from "../../../lib/theme";

function formatTripSubtitle(t: TripRow) {
  const statusLabel = isTripLifecycleFinalized(t) ? "Finalized" : "Planning";

  return `${statusLabel} • ${getTripTypeLabel(t.type)}`;
}

function isTripLifecycleFinalized(t: TripRow) {
  return t.status === "complete" || t.status === "completed";
}

function formatTripStatusBadge(t: TripRow) {
  return isTripLifecycleFinalized(t) ? "Final" : "Plan";
}

function formatTripDateStatus(t: TripRow) {
  const hasFinalDates = !!t.final_start_date && !!t.final_end_date;
  const formatDate = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, (month ?? 1) - 1, day ?? 1);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  };
  return hasFinalDates
    ? `${formatDate(t.final_start_date!)} → ${formatDate(t.final_end_date!)}`
    : "Dates not finalized yet";
}

function getFirstName(value: string | null | undefined) {
  return value?.trim().split(/\s+/)[0] || null;
}

function PollSummaryRow({
  label,
  count,
  total,
  needsVote,
}: {
  label: string;
  count: number;
  total: number;
  needsVote?: boolean;
}) {
  return (
    <View style={styles.pollSummaryRow}>
      <View style={styles.pollSummaryLabelRow}>
        <Text style={styles.pollSummaryLabel}>{label}</Text>
        {needsVote ? (
          <View style={styles.needsVoteBadge}>
            <Text style={styles.needsVoteBadgeText}>Needs your vote</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.pollSummaryValue}>{count}/{total} voted</Text>
    </View>
  );
}

export default function TripsListScreen() {
  const userId = useAuthStore((s) => s.userId);
  const authLoading = useAuthStore((s) => s.loading);
  const { profile } = useProfile();

  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [memberCountByTrip, setMemberCountByTrip] = useState<Record<string, number>>(
    {}
  );
  const [availabilityResponseCountByTrip, setAvailabilityResponseCountByTrip] =
    useState<Record<string, number>>({});
  const [stayResponseCountByTrip, setStayResponseCountByTrip] = useState<
    Record<string, number>
  >({});
  const [hasAvailabilityResponseByTrip, setHasAvailabilityResponseByTrip] =
    useState<Record<string, boolean>>({});
  const [hasStayResponseByTrip, setHasStayResponseByTrip] = useState<
    Record<string, boolean>
  >({});

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    if (!userId) return;

    try {
      setErrorMsg(null);
      if (opts?.refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const rows = await listMyTrips(userId);
      setTrips(rows);
      const tripIds = rows.map((row) => row.id);

      if (tripIds.length === 0) {
        setMemberCountByTrip({});
        setAvailabilityResponseCountByTrip({});
        setStayResponseCountByTrip({});
        setHasAvailabilityResponseByTrip({});
        setHasStayResponseByTrip({});
        return;
      }

      const [memberRowsResult, responseDetails] = await Promise.all([
        supabase
          .from("trip_members")
          .select("trip_id, role, user_id")
          .in("trip_id", tripIds)
          .eq("is_active", true),
        listPollResponseDetailsForTrips(tripIds),
      ]);

      if (memberRowsResult.error) throw memberRowsResult.error;

      const nextMemberCountByTrip: Record<string, number> = {};
      const eligibleVotingUserIdsByTrip: Record<string, Set<string>> = {};
      for (const row of memberRowsResult.data ?? []) {
        if (row.role === "creator") continue;
        nextMemberCountByTrip[row.trip_id] =
          (nextMemberCountByTrip[row.trip_id] ?? 0) + 1;
      }
      for (const row of memberRowsResult.data ?? []) {
        if (row.role === "creator") continue;
        if (!eligibleVotingUserIdsByTrip[row.trip_id]) {
          eligibleVotingUserIdsByTrip[row.trip_id] = new Set();
        }
        eligibleVotingUserIdsByTrip[row.trip_id].add(row.user_id);
      }

      const nextAvailabilityCounts: Record<string, number> = {};
      const nextStayCounts: Record<string, number> = {};
      const nextHasAvailabilityResponseByTrip: Record<string, boolean> = {};
      const nextHasStayResponseByTrip: Record<string, boolean> = {};
      for (const response of responseDetails) {
        const eligibleVotingUserIds =
          eligibleVotingUserIdsByTrip[response.trip_id] ?? new Set<string>();
        if (
          hasAvailabilityPollResponse(response) &&
          eligibleVotingUserIds.has(response.user_id)
        ) {
          nextAvailabilityCounts[response.trip_id] =
            (nextAvailabilityCounts[response.trip_id] ?? 0) + 1;
          if (response.user_id === userId) {
            nextHasAvailabilityResponseByTrip[response.trip_id] = true;
          }
        }
        if (hasStayPollResponse(response)) {
          nextStayCounts[response.trip_id] =
            (nextStayCounts[response.trip_id] ?? 0) + 1;
          if (response.user_id === userId) {
            nextHasStayResponseByTrip[response.trip_id] = true;
          }
        }
      }

      setMemberCountByTrip(nextMemberCountByTrip);
      setAvailabilityResponseCountByTrip(nextAvailabilityCounts);
      setStayResponseCountByTrip(nextStayCounts);
      setHasAvailabilityResponseByTrip(nextHasAvailabilityResponseByTrip);
      setHasStayResponseByTrip(nextHasStayResponseByTrip);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load trips");
    } finally {
      if (opts?.refresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (!authLoading) load();
    }, [authLoading, load])
  );

  const profileName = profile ? getProfileDisplayName(profile) : null;
  const firstName = useMemo(() => getFirstName(profileName), [profileName]);

  // If auth is still initializing, show spinner
  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  // If not signed in, stop pretending
  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Please sign in to view trips.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={trips}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>
              {firstName ? `Hello, ${firstName} 👋` : "Hello 👋"}
            </Text>
            <Text style={styles.subtitle}>Ready to plan the next trip?</Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : errorMsg ? (
          <View style={styles.center}>
            <Text style={styles.error}>{errorMsg}</Text>
            <Pressable onPress={() => load()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No trips yet</Text>
            <Text style={styles.emptySubtitle}>
              Start planning your first trip with friends.
            </Text>
            <Pressable
              onPress={() => router.push("/new-trip")}
              style={styles.emptyButton}
            >
              <Text style={styles.emptyButtonText}>Create Trip</Text>
            </Pressable>
          </View>
        )
      }
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [
            styles.tripCard,
            pressed ? styles.tripCardPressed : null,
          ]}
          onPress={() => router.push(`/(tabs)/trips/${item.id}`)}
        >
          <View style={styles.tripAccentStrip} />
          <View style={styles.tripHeaderRow}>
            <View style={styles.tripTitleBlock}>
              <Text style={styles.tripName}>{item.title ?? "Untitled Trip"}</Text>
              <Text style={styles.tripDates}>{formatTripSubtitle(item)}</Text>
            </View>
            <View style={styles.tripStatusPill}>
              <Text style={styles.tripStatusPillText}>
                {formatTripStatusBadge(item)}
              </Text>
            </View>
          </View>
          <Text style={styles.tripDateStatus}>{formatTripDateStatus(item)}</Text>

          {(() => {
            const memberCount = memberCountByTrip[item.id] ?? 0;
            const availabilityCount = availabilityResponseCountByTrip[item.id] ?? 0;
            const stayCount = stayResponseCountByTrip[item.id] ?? 0;
            const hasAvailabilityResponse = !!hasAvailabilityResponseByTrip[item.id];
            const hasStayResponse = !!hasStayResponseByTrip[item.id];
            const stayDefinition = parseStayPollDefinition(item.custom_poll_questions);
            const hasStayPoll = !!stayDefinition;
            const showAvailabilityPoll = item.status === "polling";
            const showStayPoll = hasStayPoll && !stayDefinition?.finalized_winner_note_id;
            const needsAvailabilityVote =
              showAvailabilityPoll &&
              item.current_user_role !== "creator" &&
              !hasAvailabilityResponse;
            const needsStayVote = showStayPoll && !hasStayResponse;

            if (!memberCount || (!showAvailabilityPoll && !showStayPoll)) {
              return null;
            }

            return (
              <View style={styles.pollSummaryCard}>
                <Text style={styles.pollSummaryTitle}>Active Polls</Text>
                {showAvailabilityPoll ? (
                  <PollSummaryRow
                    label="Date Poll"
                    count={availabilityCount}
                    total={memberCount}
                    needsVote={needsAvailabilityVote}
                  />
                ) : null}
                {showStayPoll ? (
                  <PollSummaryRow
                    label="Stay Poll"
                    count={stayCount}
                    total={memberCount}
                    needsVote={needsStayVote}
                  />
                ) : null}
              </View>
            );
          })()}
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      refreshing={refreshing}
      onRefresh={() => load({ refresh: true })}
      contentContainerStyle={[
        styles.contentContainer,
        trips.length === 0 ? { flexGrow: 1 } : null,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 112,
  },
  header: {
    marginBottom: 20,
  },
  headerTextBlock: {
    gap: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
  tripCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    padding: 18,
    backgroundColor: colors.surface,
    gap: 11,
    shadowColor: colors.accentPrimary,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: -4, height: 4 },
    elevation: 3,
    overflow: "hidden",
  },
  tripCardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.995 }],
  },
  tripAccentStrip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 7,
    backgroundColor: colors.primary,
  },
  tripHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 2,
  },
  tripTitleBlock: {
    flex: 1,
    gap: 5,
  },
  tripName: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.2,
  },
  tripDates: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: "600",
  },
  tripStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  tripStatusPillText: {
    color: colors.accentText,
    fontSize: 12,
    fontWeight: "800",
  },
  tripDateStatus: {
    fontSize: 13,
    color: colors.accentText,
    fontWeight: "600",
  },
  pollSummaryCard: {
    marginTop: 4,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    gap: 8,
  },
  pollSummaryTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  pollSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pollSummaryLabelRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  pollSummaryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  pollSummaryValue: {
    fontSize: 13,
    color: colors.textMuted,
  },
  needsVoteBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.accentPrimary,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  needsVoteBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.accentText,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 280,
  },
  empty: { color: colors.textMuted },
  emptyButton: {
    marginTop: 22,
    minHeight: 48,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  emptyButtonText: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: "700",
  },
  error: { color: colors.danger, marginBottom: 10 },
  retryBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    shadowColor: colors.primary,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  retryText: { fontWeight: "600" },
});
