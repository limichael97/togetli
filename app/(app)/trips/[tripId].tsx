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
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getTripOverview, TripOverview } from "../../../lib/trips";
import { buildTripInviteLink, createTripInvite } from "../../../lib/invites";
import { useAuthStore } from "../../../store/useAuthStore";
import { createDateOption, deleteDateOption } from "../../../lib/dateOptions";
import { checkIfUserResponded } from "../../../lib/polls";
import { leaveTrip } from "../../../lib/members";


export default function TripDetailScreen() {
  const params = useLocalSearchParams();
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const router = useRouter();

  const [data, setData] = useState<TripOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteRole, setInviteRole] = useState<"guest" | "planner">("guest");
  const [dateOptions, setDateOptions] = useState<TripOverview["dateOptions"]>([]);
  const [showDateForm, setShowDateForm] = useState(false);
  const [dateSaving, setDateSaving] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [hasResponded, setHasResponded] = useState(false);
  const [checkingResponse, setCheckingResponse] = useState(false);
  const userId = useAuthStore((s) => s.userId);

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
      } catch (e) {
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
      const { token } = await createTripInvite(tripId, inviteRole);
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

  const handleAddDateOption = async () => {
    if (!tripId) return;
    if (!startDate.trim() || !endDate.trim()) {
      Alert.alert("Missing dates", "Enter both start and end dates.");
      return;
    }

    try {
      setDateSaving(true);
      const created = await createDateOption({
        tripId,
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        label: dateLabel.trim(),
      });
      setDateOptions((prev) => [...prev, created].sort((a, b) =>
        (a.start_date ?? "").localeCompare(b.start_date ?? "")
      ));
      setShowDateForm(false);
      setStartDate("");
      setEndDate("");
      setDateLabel("");
    } catch (e: any) {
      console.error(e);
      Alert.alert("Add failed", e?.message ?? String(e));
    } finally {
      setDateSaving(false);
    }
  };

  const handleDeleteDateOption = async (id: string) => {
    Alert.alert("Delete date option?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDateOption(id);
            setDateOptions((prev) => prev.filter((d) => d.id !== id));
          } catch (e: any) {
            console.error(e);
            Alert.alert("Delete failed", e?.message ?? String(e));
          }
        },
      },
    ]);
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

  useEffect(() => {
    if (!tripId) return;

    let mounted = true;

    (async () => {
      try {
        setErrorMsg(null);
        setLoading(true);

        const res = await getTripOverview(tripId);

        if (mounted) {
          setData(res);
          setDateOptions(res.dateOptions);
        }
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

  const { trip, members, budgetOptions } = data;
  const myMember = members.find((m) => m.user_id === userId);
  const canInvite = myMember?.role === "creator";
  const canEditDates = myMember?.role === "creator" || myMember?.role === "planner";
  const pollSent = !!trip.poll_sent_at;
  const roleLabel = myMember?.role
    ? `${myMember.role[0].toUpperCase()}${myMember.role.slice(1)}`
    : null;
  const canViewResults = myMember?.role === "creator" || myMember?.role === "planner";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryTopRow}>
          <View style={styles.summaryTextBlock}>
            <Text style={styles.title}>{trip.title ?? "Untitled Trip"}</Text>
            <Text style={styles.meta}>{trip.type}</Text>
          </View>
          {roleLabel ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
          ) : null}
        </View>

        {myMember?.role && myMember.role !== "creator" ? (
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

      {myMember?.role === "creator" && !pollSent ? (
        <Pressable
          onPress={() => router.push(`/(app)/trips/${tripId}/setup`)}
          style={({ pressed }) => [
            styles.ctaButton,
            pressed ? styles.ctaButtonPressed : null,
          ]}
        >
          <Text style={styles.ctaButtonText}>Continue Setup</Text>
        </Pressable>
      ) : null}

      {myMember?.role !== "creator" && pollSent ? (
        hasResponded ? (
          <Text style={styles.ctaInfo}>You’re all set.</Text>
        ) : (
          <Pressable
            onPress={() => router.push(`/(app)/trips/${tripId}/poll`)}
            style={({ pressed }) => [
              styles.ctaButton,
              pressed ? styles.ctaButtonPressed : null,
            ]}
            disabled={checkingResponse}
          >
            <Text style={styles.ctaButtonText}>
              {checkingResponse ? "Checking..." : "Fill out poll"}
            </Text>
          </Pressable>
        )
      ) : null}
      {canViewResults && pollSent ? (
        <Pressable
          onPress={() => router.push(`/(app)/trips/${tripId}/poll-results`)}
          style={({ pressed }) => [
            styles.secondaryCtaButton,
            pressed ? styles.secondaryCtaButtonPressed : null,
          ]}
        >
          <Text style={styles.secondaryCtaButtonText}>View poll results</Text>
        </Pressable>
      ) : null}

      {canInvite ? (
        <>
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
              styles.inviteBtn,
              pressed && !inviteLoading ? styles.inviteBtnPressed : null,
              inviteLoading ? styles.inviteBtnDisabled : null,
            ]}
          >
            <Text style={styles.inviteBtnText}>
              {inviteLoading ? "Creating invite..." : "Invite someone"}
            </Text>
          </Pressable>
        </>
      ) : null}


      <Pressable
        onPress={() => router.push(`/(app)/trips/${tripId}/members`)}
        style={({ pressed }) => [
          styles.section,
          pressed ? styles.sectionPressed : null,
        ]}
      >
        <Text style={styles.sectionTitle}>Members</Text>
        <Text style={styles.sectionBody}>
          {members.length} member{members.length === 1 ? "" : "s"}
        </Text>
      </Pressable>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Date Options</Text>
          {canEditDates ? (
            <Pressable
              onPress={() => setShowDateForm((v) => !v)}
              style={({ pressed }) => [
                styles.textButton,
                pressed ? styles.textButtonPressed : null,
              ]}
            >
              <Text style={styles.textButtonText}>
                {showDateForm ? "Cancel" : "Add date option"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {showDateForm ? (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Start date (YYYY-MM-DD)"
              value={startDate}
              onChangeText={setStartDate}
              editable={!dateSaving}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="End date (YYYY-MM-DD)"
              value={endDate}
              onChangeText={setEndDate}
              editable={!dateSaving}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Label (optional)"
              value={dateLabel}
              onChangeText={setDateLabel}
              editable={!dateSaving}
            />
            <Pressable
              onPress={handleAddDateOption}
              disabled={dateSaving}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && !dateSaving ? styles.primaryBtnPressed : null,
                dateSaving ? styles.primaryBtnDisabled : null,
              ]}
            >
              <Text style={styles.primaryBtnText}>
                {dateSaving ? "Saving..." : "Save date option"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {dateOptions.length === 0 ? (
          <Text style={styles.sectionBody}>None yet.</Text>
        ) : (
          dateOptions.map((d) => (
            <View key={d.id} style={styles.optionRow}>
              <Text style={styles.item}>
                {d.label ? `${d.label}: ` : ""}{d.start_date} → {d.end_date}
              </Text>
              {canEditDates ? (
                <Pressable
                  onPress={() => handleDeleteDateOption(d.id)}
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    pressed ? styles.deleteBtnPressed : null,
                  ]}
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Budget Options</Text>
        {budgetOptions.length === 0 ? (
          <Text style={styles.sectionBody}>None yet.</Text>
        ) : (
          budgetOptions.map((b) => (
            <Text key={b.id} style={styles.item}>
              {b.type.toUpperCase()}: {b.label}{b.is_any ? " (any)" : ""}
            </Text>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  summaryCard: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#f8f8f8",
    borderWidth: 1,
    borderColor: "#ececec",
    marginBottom: 8,
  },
  summaryTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryTextBlock: { flex: 1 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.3 },
  meta: { marginTop: 6, color: "#666", fontSize: 15, textTransform: "capitalize" },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#111",
  },
  roleBadgeText: { color: "white", fontWeight: "600", fontSize: 12 },
  section: { marginTop: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#eee" },
  sectionPressed: { opacity: 0.7 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  sectionBody: { color: "#666" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  item: { paddingVertical: 4, color: "#333" },
  optionRow: {
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  empty: { color: "#666" },
  error: { color: "tomato" },
  inviteBtn: {
    marginTop: 16,
    backgroundColor: "black",
    paddingVertical: 12,
    borderRadius: 999,
  },
  inviteBtnText: { color: "white", textAlign: "center", fontWeight: "600" },
  inviteBtnPressed: { opacity: 0.7 },
  inviteBtnDisabled: { opacity: 0.5 },
  inviteRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  inviteRoleLabel: { color: "#666", marginRight: 4 },
  inviteRoleOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  inviteRoleOptionActive: { backgroundColor: "black", borderColor: "black" },
  inviteRoleOptionText: { color: "#333", fontWeight: "500" },
  inviteRoleOptionTextActive: { color: "white" },
  form: { marginBottom: 12, gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  primaryBtn: {
    marginTop: 4,
    backgroundColor: "black",
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryBtnText: { color: "white", textAlign: "center", fontWeight: "600" },
  primaryBtnPressed: { opacity: 0.7 },
  primaryBtnDisabled: { opacity: 0.5 },
  textButton: { paddingVertical: 4, paddingHorizontal: 6 },
  textButtonText: { color: "#111", fontWeight: "600" },
  textButtonPressed: { opacity: 0.7 },
  deleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
  deleteBtnText: { color: "#333", fontSize: 12 },
  deleteBtnPressed: { opacity: 0.7 },
  ctaButton: {
    marginTop: 16,
    backgroundColor: "black",
    paddingVertical: 12,
    borderRadius: 999,
  },
  ctaButtonText: { color: "white", textAlign: "center", fontWeight: "600" },
  ctaButtonPressed: { opacity: 0.7 },
  ctaInfo: { marginTop: 12, color: "#666" },
  secondaryCtaButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eee",
    alignSelf: "flex-start",
  },
  secondaryCtaButtonText: { color: "#333", fontWeight: "600" },
  secondaryCtaButtonPressed: { opacity: 0.7 },
  leaveBtn: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eee",
    alignSelf: "flex-start",
  },
  leaveBtnText: { color: "#333", fontWeight: "600" },
  leaveBtnPressed: { opacity: 0.7 },
});
