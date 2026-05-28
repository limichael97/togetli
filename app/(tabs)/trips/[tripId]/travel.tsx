import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../../../../store/useAuthStore";
import { Screen } from "../../../../components/ui/Screen";
import { AppInput } from "../../../../components/ui/AppInput";
import { AppButton } from "../../../../components/ui/AppButton";
import { colors, radius, spacing, typography } from "../../../../lib/theme";
import {
  getTripMemberDisplayName,
  getTripOverview,
} from "../../../../lib/trips";
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

function hasTravelDetails(detail: TravelDetailRow | null) {
  return !!(
    detail?.arrival_time ||
    detail?.departure_time ||
    detail?.flight_number?.trim() ||
    detail?.notes?.trim()
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function TripTravelScreen() {
  const params = useLocalSearchParams();
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const userId = useAuthStore((s) => s.userId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [travelDetails, setTravelDetails] = useState<TravelDetailRow[]>([]);
  const [myTravelDetail, setMyTravelDetail] = useState<TravelDetailRow | null>(
    null
  );
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
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
          getTripMemberDisplayName(member),
        ])
      );

      setMemberNames(names);
      setTravelDetails(detailRows);
      setMyTravelDetail(myDetail);
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

  const userHasTravelDetails = hasTravelDetails(myTravelDetail);

  const openDetailsModal = () => {
    setArrivalTime(myTravelDetail?.arrival_time ?? "");
    setDepartureTime(myTravelDetail?.departure_time ?? "");
    setFlightNumber(myTravelDetail?.flight_number ?? "");
    setNotes(myTravelDetail?.notes ?? "");
    setDetailsModalOpen(true);
  };

  const handleSave = async () => {
    if (!tripId || !userId) return;

    try {
      setSaving(true);
      const savedDetail = await upsertTravelDetail({
        tripId,
        userId,
        arrival_time: arrivalTime || null,
        departure_time: departureTime || null,
        flight_number: flightNumber || null,
        notes: notes || null,
      });
      setMyTravelDetail(savedDetail);
      setTravelDetails((current) => {
        const existingIndex = current.findIndex((row) => row.id === savedDetail.id);
        if (existingIndex === -1) {
          return [savedDetail, ...current];
        }
        return current.map((row) => (row.id === savedDetail.id ? savedDetail : row));
      });
      setDetailsModalOpen(false);
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
          See when everyone arrives and share your own travel plans.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your travel details</Text>
          {userHasTravelDetails ? (
            <View style={styles.summaryBlock}>
              {myTravelDetail?.arrival_time ? (
                <SummaryLine
                  label="Arrival"
                  value={formatDateTime(myTravelDetail.arrival_time)}
                />
              ) : null}
              {myTravelDetail?.departure_time ? (
                <SummaryLine
                  label="Departure"
                  value={formatDateTime(myTravelDetail.departure_time)}
                />
              ) : null}
              {myTravelDetail?.flight_number?.trim() ? (
                <SummaryLine label="Flight" value={myTravelDetail.flight_number} />
              ) : null}
              {myTravelDetail?.notes?.trim() ? (
                <SummaryLine label="Notes" value={myTravelDetail.notes} />
              ) : null}
            </View>
          ) : (
            <>
              <Text style={styles.emptyTitle}>No travel details yet</Text>
              <Text style={styles.cardHint}>
                Add your arrival, departure, flight, or notes when you're ready.
              </Text>
            </>
          )}
          <AppButton
            label={userHasTravelDetails ? "Edit travel details" : "Add travel details"}
            onPress={openDetailsModal}
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

      <Modal
        visible={detailsModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => (!saving ? setDetailsModalOpen(false) : undefined)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => (!saving ? setDetailsModalOpen(false) : undefined)}
        >
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.cardTitle}>Your travel details</Text>
              <Text style={styles.cardHint}>
                Add your arrival and departure time when you know them.
              </Text>
              <AppInput
                label="Arrival time"
                placeholder="June 12, 2:30 PM"
                value={arrivalTime}
                onChangeText={setArrivalTime}
              />
              <AppInput
                label="Departure time"
                placeholder="June 15, 9:00 AM"
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
                label={saving ? "Saving..." : "Save travel details"}
                onPress={handleSave}
                disabled={saving}
              />
              <Pressable
                onPress={() => setDetailsModalOpen(false)}
                disabled={saving}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && !saving ? styles.cancelButtonPressed : null,
                ]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingBottom: 112, gap: spacing.md },
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
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  summaryBlock: {
    gap: spacing.sm,
  },
  summaryLine: {
    gap: spacing.xs,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.28)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    maxHeight: "88%",
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  cancelButton: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonPressed: {
    opacity: 0.75,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  error: { color: "tomato" },
});
