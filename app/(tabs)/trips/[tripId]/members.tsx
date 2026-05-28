import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Alert,
  Share,
  Linking,
  Modal,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { listTripMembers, removeTripMember, updateTripMemberRole } from "../../../../lib/members";
import { useAuthStore } from "../../../../store/useAuthStore";
import {
  buildTripInviteLink,
  getOrCreateTripInvite,
  listPendingTripInvites,
  type PendingTripInvite,
} from "../../../../lib/invites";
import {
  getTripMemberDisplayName,
  type TripMemberRow,
  type TripRole,
} from "../../../../lib/trips";
import { colors, radius, spacing, typography } from "../../../../lib/theme";

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
  const [pendingInvites, setPendingInvites] = useState<PendingTripInvite[]>([]);
  const [inviteLinks, setInviteLinks] = useState<
    Partial<Record<Exclude<TripRole, "creator">, string>>
  >({});
  const [inviteRole, setInviteRole] = useState<Exclude<TripRole, "creator">>("guest");
  const [invitePreviewUrl, setInvitePreviewUrl] = useState<string | null>(null);
  const [invitePreviewLoading, setInvitePreviewLoading] = useState(false);
  const [sharingInvite, setSharingInvite] = useState(false);
  const [copyingInvite, setCopyingInvite] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const loadMembers = async () => {
    if (!tripId) return;
    try {
      setErrorMsg(null);
      setLoading(true);
      const [rows, inviteRows] = await Promise.all([
        listTripMembers(tripId),
        listPendingTripInvites(tripId),
      ]);
      setMembers(rows);
      setPendingInvites(inviteRows);
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
  const hasPlannerInvite = pendingInvites.some((invite) => invite.role === "planner");
  const hasGuestInvite = pendingInvites.some((invite) => invite.role === "guest");

  useEffect(() => {
    if (!canManage || !tripId || !inviteModalOpen) return;

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
  }, [canManage, inviteModalOpen, inviteRole, tripId]);

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

  const handleCopyInviteLink = async () => {
    try {
      setCopyingInvite(true);
      const link = invitePreviewUrl ?? (await getInviteLink(inviteRole));
      await Clipboard.setStringAsync(link);
      Alert.alert("Link copied");
    } catch (e: any) {
      Alert.alert("Copy failed", e?.message ?? String(e));
    } finally {
      setCopyingInvite(false);
    }
  };

  const handleShareInvite = async () => {
    try {
      setSharingInvite(true);
      const link = invitePreviewUrl ?? (await getInviteLink(inviteRole));
      await Share.share({
        message: `Join my trip on Togetli as a ${inviteRole}: ${link}`,
        url: link,
      });
    } catch (e: any) {
      Alert.alert("Invite failed", e?.message ?? String(e));
    } finally {
      setSharingInvite(false);
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Members</Text>

      {canManage ? (
        <View style={styles.inviteCard}>
          <Text style={styles.inviteCardTitle}>Invite</Text>
          <Text style={styles.inviteCardBody}>
            Share reusable invite links for planners and guests.
          </Text>
          <View style={styles.inviteSummaryRow}>
            {hasPlannerInvite ? (
              <View style={styles.inviteStatusPill}>
                <Text style={styles.inviteStatusPillText}>Planner link ready</Text>
              </View>
            ) : null}
            {hasGuestInvite ? (
              <View style={styles.inviteStatusPill}>
                <Text style={styles.inviteStatusPillText}>Guest link ready</Text>
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={() => setInviteModalOpen(true)}
            style={({ pressed }) => [
              styles.primaryAction,
              pressed ? styles.pressedAction : null,
            ]}
          >
            <Text style={styles.primaryActionText}>Invite</Text>
          </Pressable>
          <Text style={styles.pendingInviteText}>
            {pendingInvites.length === 0
              ? "No invite links shared yet."
              : `${pendingInvites.length} invite link${
                  pendingInvites.length === 1 ? "" : "s"
                } ready to share.`}
          </Text>
        </View>
      ) : null}

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

      <Modal
        visible={inviteModalOpen && canManage}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setInviteModalOpen(false)}
        >
          <Pressable style={styles.inviteModalCard} onPress={() => {}}>
            <Text style={styles.inviteCardTitle}>Invite</Text>
            <Text style={styles.inviteCardBody}>
              Share a reusable invite link for planners or guests.
            </Text>
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
            <View style={styles.inviteLinkPreview}>
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
            <View style={styles.inviteButtonRow}>
              <Pressable
                onPress={handleCopyInviteLink}
                disabled={copyingInvite || !invitePreviewUrl}
                style={[
                  styles.secondaryAction,
                  copyingInvite || !invitePreviewUrl ? styles.disabledAction : null,
                ]}
              >
                <Text style={styles.secondaryActionText}>
                  {copyingInvite ? "Copying..." : "Copy"}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleShareInvite}
                disabled={sharingInvite}
                style={[
                  styles.primaryAction,
                  sharingInvite ? styles.disabledAction : null,
                ]}
              >
                <Text style={styles.primaryActionText}>
                  {sharingInvite ? "Opening..." : "Share"}
                </Text>
              </Pressable>
            </View>
            <Pressable
              onPress={handleEmailInvite}
              style={({ pressed }) => [
                styles.secondaryFullAction,
                pressed ? styles.pressedAction : null,
              ]}
            >
              <Text style={styles.secondaryFullActionText}>Email Invite</Text>
            </Pressable>
            <Pressable
              onPress={() => setInviteModalOpen(false)}
              style={({ pressed }) => [
                styles.modalCloseButton,
                pressed ? styles.pressedAction : null,
              ]}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.xl,
    paddingBottom: 112,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: {
    ...typography.title,
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: spacing.lg,
  },
  empty: { color: colors.textMuted },
  error: { color: colors.danger },
  inviteCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
    shadowColor: colors.accentPrimary,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: -4, height: 4 },
    elevation: 2,
  },
  inviteCardTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  inviteCardBody: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  inviteSummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  inviteStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accentPrimary,
  },
  inviteStatusPillText: {
    color: colors.accentText,
    fontSize: 12,
    fontWeight: "700",
  },
  inviteRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inviteRoleOption: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  inviteRoleOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.border,
  },
  inviteRoleOptionText: { color: colors.text, fontWeight: "700" },
  inviteRoleOptionTextActive: { color: colors.primaryText },
  inviteLinkPreview: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.surfaceMuted,
  },
  inviteLinkText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  inviteButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryAction: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryActionText: {
    color: colors.primaryText,
    fontWeight: "700",
    fontSize: 14,
  },
  pressedAction: { opacity: 0.82 },
  secondaryAction: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 14,
  },
  secondaryFullAction: {
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryFullActionText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 14,
  },
  pendingInviteText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  disabledAction: { opacity: 0.5 },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(7,63,69,0.28)",
    padding: 16,
  },
  inviteModalCard: {
    width: "100%",
    maxWidth: 420,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 12,
  },
  modalCloseButton: {
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseButtonText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 14,
  },
  memberRow: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
    marginBottom: spacing.md,
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
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accentPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  memberPillText: {
    color: colors.accentText,
    fontSize: 14,
    fontWeight: "700",
  },
  memberTextBlock: { gap: 4, flex: 1 },
  memberName: { fontSize: 15, color: colors.text, fontWeight: "700" },
  memberRole: { fontSize: 12, color: colors.textMuted, fontWeight: "700" },
  actionsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  roleButtons: { flexDirection: "row", gap: 8 },
  roleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  roleBtnActive: { backgroundColor: colors.primary, borderColor: colors.border },
  roleBtnText: { color: colors.text, fontWeight: "700", fontSize: 12 },
  roleBtnTextActive: { color: colors.primaryText },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  removeBtnText: { color: colors.danger, fontWeight: "700", fontSize: 12 },
  removeBtnDisabled: { opacity: 0.5 },
});
