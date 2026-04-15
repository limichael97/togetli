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

function formatTripSubtitle(t: TripRow) {
  const statusLabel =
    t.status === "polling"
      ? "Polling"
      : t.status === "finalized"
        ? "Finalized"
        : "Draft";
  const modeLabel = t.mode === "planned" ? "Planned" : "Poll";

  if (t.status === "finalized" && t.final_start_date && t.final_end_date) {
    return `${modeLabel} • ${statusLabel} • ${t.final_start_date} → ${t.final_end_date}`;
  }

  return `${modeLabel} • ${statusLabel} • ${t.type}`;
}

export default function TripsListScreen() {
  const userId = useAuthStore((s) => s.userId);
  const authLoading = useAuthStore((s) => s.loading);

  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;

    try {
      setErrorMsg(null);
      setLoading(true);
      const rows = await listMyTrips(userId);
      setTrips(rows);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load trips");
    } finally {
      setLoading(false);
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
            <Pressable onPress={load} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.empty}>No trips yet.</Text>
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
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      refreshing={loading}
      onRefresh={load}
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
    borderColor: "#eee",
    padding: 14,
    backgroundColor: "white",
  },
  tripName: { fontSize: 16, fontWeight: "600" },
  tripDates: { marginTop: 4, fontSize: 14, color: "#666" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: "#666" },
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
