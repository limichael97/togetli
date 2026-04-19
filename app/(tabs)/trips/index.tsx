import React, { useCallback, useState } from "react";
import {
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  View,
} from "react-native";
import { Link, router, useFocusEffect } from "expo-router";
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

function formatTripSubtitle(t: TripRow) {
  const statusLabel =
    t.status === "polling"
      ? "Planning"
      : t.status === "finalized"
        ? "Finalized"
        : "Planning";

  return `${statusLabel} • ${getTripTypeLabel(t.type)}`;
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
      <Text style={styles.pollSummaryValue}>{count}/{total} responded</Text>
    </View>
  );
}

export default function TripsListScreen() {
  const userId = useAuthStore((s) => s.userId);
  const authLoading = useAuthStore((s) => s.loading);

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
          .select("trip_id")
          .in("trip_id", tripIds)
          .eq("is_active", true),
        listPollResponseDetailsForTrips(tripIds),
      ]);

      if (memberRowsResult.error) throw memberRowsResult.error;

      const nextMemberCountByTrip: Record<string, number> = {};
      for (const row of memberRowsResult.data ?? []) {
        nextMemberCountByTrip[row.trip_id] =
          (nextMemberCountByTrip[row.trip_id] ?? 0) + 1;
      }

      const nextAvailabilityCounts: Record<string, number> = {};
      const nextStayCounts: Record<string, number> = {};
      const nextHasAvailabilityResponseByTrip: Record<string, boolean> = {};
      const nextHasStayResponseByTrip: Record<string, boolean> = {};
      for (const response of responseDetails) {
        if (hasAvailabilityPollResponse(response)) {
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
          <Text style={styles.title}>Your Trips</Text>
          <Link href="/(tabs)/trips/new" asChild>
            <Pressable>
              <Text style={styles.newTrip}>+ New Trip</Text>
            </Pressable>
          </Link>
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
              onPress={() => router.push("/(tabs)/trips/new")}
              style={styles.emptyButton}
            >
              <Text style={styles.emptyButtonText}>Create Trip</Text>
            </Pressable>
          </View>
        )
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.tripCard}
          onPress={() => router.push(`/(tabs)/trips/${item.id}`)}
        >
          <Text style={styles.tripName}>{item.title ?? "Untitled Trip"}</Text>
          <Text style={styles.tripDates}>{formatTripSubtitle(item)}</Text>
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
                    label="Availability Poll"
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
    backgroundColor: "#f7f7f7",
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 22, fontWeight: "700" },
  newTrip: { fontSize: 16, color: "#555", fontWeight: "500" },
  tripCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e9e9e9",
    padding: 16,
    backgroundColor: "white",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tripName: { fontSize: 16, fontWeight: "600" },
  tripDates: { marginTop: 4, fontSize: 14, color: "#666" },
  tripDateStatus: {
    fontSize: 13,
    color: "#7a7a7a",
    marginTop: -2,
  },
  pollSummaryCard: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f1f1",
    gap: 6,
  },
  pollSummaryTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
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
    color: "#111",
  },
  pollSummaryValue: {
    fontSize: 13,
    color: "#666",
  },
  needsVoteBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#fef3c7",
  },
  needsVoteBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400e",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: "#666",
    textAlign: "center",
    maxWidth: 280,
  },
  empty: { color: "#666" },
  emptyButton: {
    marginTop: 20,
    backgroundColor: "#111",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  emptyButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },
  error: { color: "tomato", marginBottom: 10 },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },
  retryText: { fontWeight: "600" },
});
