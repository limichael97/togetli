import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { listTripMembers, removeTripMember, updateTripMemberRole } from "../../../../lib/members";
import { useAuthStore } from "../../../../store/useAuthStore";
import {
  getTripMemberDisplayName,
  type TripMemberRow,
  type TripRole,
} from "../../../../lib/trips";

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "?";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export default function TripMembersScreen() {
  const params = useLocalSearchParams();
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const userId = useAuthStore((s) => s.userId);

  const [members, setMembers] = useState<TripMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const loadMembers = async () => {
    if (!tripId) return;
    try {
      setErrorMsg(null);
      setLoading(true);
      const rows = await listTripMembers(tripId);
      setMembers(rows);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [tripId]);

  const myMember = members.find((m) => m.user_id === userId);
  const canManage = myMember?.role === "creator" || myMember?.role === "planner";

  const setRole = async (member: TripMemberRow, role: Exclude<TripRole, "creator">) => {
    if (!tripId) return;
    if (member.role === "creator") return;
    if (member.role === role) return;

    try {
      setUpdatingUserId(member.user_id);
      await updateTripMemberRole({ tripId, userId: member.user_id, role });
      setMembers((prev) =>
        prev.map((m) => (m.user_id === member.user_id ? { ...m, role } : m))
      );
    } catch (e: any) {
      console.error(e);
      Alert.alert("Update failed", e?.message ?? String(e));
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleRemove = async (member: TripMemberRow) => {
    if (!tripId || !userId) return;
    if (member.role === "creator") return;

    Alert.alert("Remove member?", "They will lose access to this trip.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            setRemovingUserId(member.user_id);
            await removeTripMember({
              tripId,
              actorUserId: userId,
              targetUserId: member.user_id,
            });
            await loadMembers();
          } catch (e: any) {
            console.error(e);
            Alert.alert("Remove failed", e?.message ?? String(e));
          } finally {
            setRemovingUserId(null);
          }
        },
      },
    ]);
  };

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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Members</Text>

      {members.length === 0 ? (
        <Text style={styles.empty}>No members found.</Text>
      ) : (
        members.map((m) => {
          const isCreator = m.role === "creator";
          const isUpdating = updatingUserId === m.user_id;
          const displayName = getTripMemberDisplayName(m);
          return (
            <View key={m.user_id} style={styles.memberRow}>
              <View style={styles.memberInfo}>
                <View style={styles.memberIdentityRow}>
                  <View style={styles.memberPill}>
                    <Text style={styles.memberPillText}>{getInitials(displayName)}</Text>
                  </View>
                  <View style={styles.memberTextBlock}>
                    <Text style={styles.memberName}>{displayName}</Text>
                    <Text style={styles.memberRole}>{m.role}</Text>
                  </View>
                </View>
              </View>

              {canManage && !isCreator ? (
                <View style={styles.actionsRow}>
                  <View style={styles.roleButtons}>
                    <Pressable
                      onPress={() => setRole(m, "guest")}
                      disabled={isUpdating || removingUserId === m.user_id}
                      style={[
                        styles.roleBtn,
                        m.role === "guest" ? styles.roleBtnActive : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleBtnText,
                          m.role === "guest" ? styles.roleBtnTextActive : null,
                        ]}
                      >
                        Guest
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setRole(m, "planner")}
                      disabled={isUpdating || removingUserId === m.user_id}
                      style={[
                        styles.roleBtn,
                        m.role === "planner" ? styles.roleBtnActive : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleBtnText,
                          m.role === "planner" ? styles.roleBtnTextActive : null,
                        ]}
                      >
                        Planner
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => handleRemove(m)}
                    disabled={removingUserId === m.user_id}
                    style={[
                      styles.removeBtn,
                      removingUserId === m.user_id ? styles.removeBtnDisabled : null,
                    ]}
                  >
                    <Text style={styles.removeBtnText}>Remove</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  empty: { color: "#666" },
  error: { color: "tomato" },
  memberRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    gap: 10,
  },
  memberInfo: { gap: 4 },
  memberIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  memberPill: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  memberPillText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  memberTextBlock: { gap: 4, flex: 1 },
  memberName: { fontSize: 14, color: "#333" },
  memberRole: { fontSize: 12, color: "#666" },
  actionsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  roleButtons: { flexDirection: "row", gap: 8 },
  roleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  roleBtnActive: { backgroundColor: "black", borderColor: "black" },
  roleBtnText: { color: "#333", fontWeight: "500", fontSize: 12 },
  roleBtnTextActive: { color: "white" },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eee",
  },
  removeBtnText: { color: "#333", fontWeight: "600", fontSize: 12 },
  removeBtnDisabled: { opacity: 0.5 },
});
