import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../../../../store/useAuthStore";
import { Screen } from "../../../../components/ui/Screen";
import { AppInput } from "../../../../components/ui/AppInput";
import { AppButton } from "../../../../components/ui/AppButton";
import { colors, radius, spacing, typography } from "../../../../lib/theme";
import { getTripOverview } from "../../../../lib/trips";
import {
  getMyTravelDetail,
  listTravelDetails,
  upsertTravelDetail,
  type TravelDetailRow,
} from "../../../../lib/travel";

function formatValue(value: string | null, emptyText: string) {
  return value?.trim() ? value : emptyText;
}

function formatDateTime(value: string | null) {
  if (!value) return "Not added";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function TripTravelScreen() {
  const params = useLocalSearchParams();
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const userId = useAuthStore((s) => s.userId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [travelDetails, setTravelDetails] = useState<TravelDetailRow[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [arrivalTime, setArrivalTime] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    if (!tripId || !userId) return;

    try {
      setErrorMsg(null);
      setLoading(true);
      const [overview, detailRows, myDetail] = await Promise.all([
        getTripOverview(tripId),
        listTravelDetails(tripId),
        getMyTravelDetail(tripId, userId),
      ]);

      const names = Object.fromEntries(
        overview.members.map((member) => [
          member.user_id,
          member.profiles?.display_name ||
            member.profiles?.full_name ||
            `Member ${member.user_id.slice(0, 6)}`,
        ])
      );

      setMemberNames(names);
      setTravelDetails(detailRows);
      setArrivalTime(myDetail?.arrival_time ?? "");
      setDepartureTime(myDetail?.departure_time ?? "");
      setFlightNumber(myDetail?.flight_number ?? "");
      setNotes(myDetail?.notes ?? "");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load travel board");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tripId, userId]);

  const sortedTravelDetails = useMemo(() => {
    return [...travelDetails].sort((a, b) => {
      if (a.user_id === userId) return -1;
      if (b.user_id === userId) return 1;
      return (a.updated_at ?? "").localeCompare(b.updated_at ?? "") * -1;
    });
  }, [travelDetails, userId]);

  const handleSave = async () => {
    if (!tripId || !userId) return;

    try {
      setSaving(true);
      await upsertTravelDetail({
        tripId,
        userId,
        arrival_time: arrivalTime || null,
        departure_time: departureTime || null,
        flight_number: flightNumber || null,
        notes: notes || null,
      });
      await load();
      Alert.alert("Saved", "Your travel details were updated.");
    } catch (e: any) {
      Alert.alert("Save failed", e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!tripId) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Missing trip id.</Text>
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Sign in to view the travel board.</Text>
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

  return (
    <Screen topInset="sm">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Travel Board</Text>
        <Text style={styles.pageDescription}>
          Add your own travel details and see the group plan in one place.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your travel details</Text>
          <Text style={styles.cardHint}>
            Use local datetime format like `2026-06-12T14:30` or `2026-06-12 14:30`.
          </Text>
          <AppInput
            label="Arrival time"
            placeholder="Example: 2026-06-12T14:30"
            value={arrivalTime}
            onChangeText={setArrivalTime}
          />
          <AppInput
            label="Departure time"
            placeholder="Example: 2026-06-15T09:00"
            value={departureTime}
            onChangeText={setDepartureTime}
          />
          <AppInput
            label="Flight number"
            placeholder="Optional"
            value={flightNumber}
            onChangeText={setFlightNumber}
            autoCapitalize="characters"
          />
          <AppInput
            label="Notes"
            placeholder="Optional"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <AppButton
            label={saving ? "Saving..." : "Save Travel Details"}
            onPress={handleSave}
            disabled={saving}
          />
        </View>

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Group travel details</Text>
          {sortedTravelDetails.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>
                No travel details yet. Add yours so the group can coordinate arrivals and departures.
              </Text>
            </View>
          ) : (
            sortedTravelDetails.map((detail) => (
              <View key={detail.id} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {memberNames[detail.user_id] ?? `Member ${detail.user_id.slice(0, 6)}`}
                </Text>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Arrival</Text>
                  <Text style={styles.detailValue}>
                    {formatDateTime(detail.arrival_time)}
                  </Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Departure</Text>
                  <Text style={styles.detailValue}>
                    {formatDateTime(detail.departure_time)}
                  </Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Flight</Text>
                  <Text style={styles.detailValue}>
                    {formatValue(detail.flight_number, "Not added")}
                  </Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={styles.detailValue}>
                    {formatValue(detail.notes, "No notes")}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingBottom: spacing.xxl, gap: spacing.md },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
  },
  pageDescription: {
    ...typography.bodyMuted,
    marginTop: spacing.xs,
  },
  sectionBlock: {
    gap: spacing.sm,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  cardHint: {
    ...typography.bodyMuted,
  },
  detailBlock: {
    gap: spacing.xs,
  },
  detailLabel: {
    ...typography.label,
    color: colors.textMuted,
  },
  detailValue: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  emptyText: {
    ...typography.bodyMuted,
  },
  error: { color: "tomato" },
});
