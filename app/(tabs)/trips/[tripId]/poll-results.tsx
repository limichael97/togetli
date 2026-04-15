import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../../../../store/useAuthStore";
import { getTripSetupData, listPollResponses } from "../../../../lib/polls";

export default function TripPollResultsScreen() {
  const params = useLocalSearchParams();
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const userId = useAuthStore((s) => s.userId);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dateOptions, setDateOptions] = useState<
    { id: string; start_date: string; end_date: string; label: string | null }[]
  >([]);
  const [responses, setResponses] = useState<
    { available_date_option_ids: string[] | null; flight_budget_label: string | null; lodging_budget_label: string | null }[]
  >([]);
  const [canManageTrip, setCanManageTrip] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    let mounted = true;

    (async () => {
      try {
        setErrorMsg(null);
        setLoading(true);
        const res = await getTripSetupData(tripId);
        if (!mounted) return;
        const member = res.members.find((m) => m.user_id === userId);
        setCanManageTrip(
          member?.role === "creator" || member?.role === "planner"
        );
        setDateOptions(res.dateOptions);

        const pollRows = await listPollResponses(tripId);
        if (!mounted) return;
        setResponses(pollRows);
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

  const { dateCounts, topDateId, flightCounts, lodgingCounts } = useMemo(() => {
    const dateMap = new Map<string, number>();
    const flightMap = new Map<string, number>();
    const lodgingMap = new Map<string, number>();

    responses.forEach((r) => {
      (r.available_date_option_ids ?? []).forEach((id) => {
        dateMap.set(id, (dateMap.get(id) ?? 0) + 1);
      });
      if (r.flight_budget_label) {
        flightMap.set(
          r.flight_budget_label,
          (flightMap.get(r.flight_budget_label) ?? 0) + 1
        );
      }
      if (r.lodging_budget_label) {
        lodgingMap.set(
          r.lodging_budget_label,
          (lodgingMap.get(r.lodging_budget_label) ?? 0) + 1
        );
      }
    });

    let topId: string | null = null;
    let topCount = 0;
    for (const [id, count] of dateMap.entries()) {
      if (count > topCount) {
        topCount = count;
        topId = id;
      }
    }

    return {
      dateCounts: dateMap,
      topDateId: topId,
      flightCounts: flightMap,
      lodgingCounts: lodgingMap,
    };
  }, [responses]);

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

  if (!canManageTrip) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Only planners and creators can view results.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Poll Results</Text>

      <Text style={styles.sectionTitle}>Date options</Text>
      {dateOptions.length === 0 ? (
        <Text style={styles.muted}>No date options yet.</Text>
      ) : (
        dateOptions.map((d) => {
          const count = dateCounts.get(d.id) ?? 0;
          const isTop = topDateId && d.id === topDateId;
          return (
            <View key={d.id} style={styles.row}>
              <Text style={[styles.rowText, isTop ? styles.rowTextHighlight : null]}>
                {d.label ? `${d.label}: ` : ""}{d.start_date} → {d.end_date}
              </Text>
              <Text style={[styles.countText, isTop ? styles.countTextHighlight : null]}>
                {count}
              </Text>
            </View>
          );
        })
      )}

      <Text style={styles.sectionTitle}>Flight budget</Text>
      {flightCounts.size === 0 ? (
        <Text style={styles.muted}>No selections yet.</Text>
      ) : (
        Array.from(flightCounts.entries()).map(([label, count]) => (
          <View key={`flight-${label}`} style={styles.row}>
            <Text style={styles.rowText}>{label}</Text>
            <Text style={styles.countText}>{count}</Text>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Lodging budget</Text>
      {lodgingCounts.size === 0 ? (
        <Text style={styles.muted}>No selections yet.</Text>
      ) : (
        Array.from(lodgingCounts.entries()).map(([label, count]) => (
          <View key={`lodging-${label}`} style={styles.row}>
            <Text style={styles.rowText}>{label}</Text>
            <Text style={styles.countText}>{count}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4,
  },
  rowText: { color: "#333", flex: 1 },
  rowTextHighlight: { fontWeight: "700" },
  countText: { color: "#666", minWidth: 24, textAlign: "right" },
  countTextHighlight: { color: "#111", fontWeight: "700" },
  muted: { color: "#666" },
  error: { color: "tomato" },
});
