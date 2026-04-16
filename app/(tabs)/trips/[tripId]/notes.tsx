import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Pressable,
  Modal,
} from "react-native";
import * as Linking from "expo-linking";
import { useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../../../../store/useAuthStore";
import { Screen } from "../../../../components/ui/Screen";
import { AppInput } from "../../../../components/ui/AppInput";
import { AppButton } from "../../../../components/ui/AppButton";
import { colors, radius, spacing, typography } from "../../../../lib/theme";
import { getTripOverview } from "../../../../lib/trips";
import {
  createTripNote,
  listTripNotes,
  listTripNoteReactions,
  toggleTripNoteLike,
  updateTripNotePin,
  type TripIdeaCategory,
  type TripNoteRow,
} from "../../../../lib/tripNotes";

type FilterValue = "all" | TripIdeaCategory;

const CATEGORY_OPTIONS: TripIdeaCategory[] = [
  "food",
  "activities",
  "stay",
  "travel",
  "general",
];

const FILTER_OPTIONS: Array<{ value: FilterValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "stay", label: "Stay" },
  { value: "food", label: "Food" },
  { value: "activities", label: "Activities" },
  { value: "travel", label: "Travel" },
  { value: "general", label: "General" },
];

const CATEGORY_LABELS: Record<TripIdeaCategory, string> = {
  food: "Food",
  activities: "Activities",
  stay: "Stay",
  travel: "Travel",
  general: "General",
};

function normalizeLink(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getIdeaCategory(note: TripNoteRow): TripIdeaCategory {
  return note.category ?? "general";
}

function formatIdeaTitle(note: TripNoteRow) {
  if (note.title?.trim()) return note.title.trim();

  const label = getLinkTypeLabel(note.link);
  if (label !== "Link") return `${label} idea`;
  return "Untitled idea";
}

function getLinkTypeLabel(link: string | null) {
  const normalized = normalizeLink(link)?.toLowerCase() ?? "";
  if (!normalized) return "Link";
  if (normalized.includes("tiktok.com")) return "TikTok";
  if (normalized.includes("instagram.com")) return "Instagram";
  if (normalized.includes("airbnb.")) return "Airbnb";
  return "Link";
}

function formatContentPreview(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed;
}

function IdeaCard({
  note,
  memberNames,
  onOpenLink,
  canTogglePin,
  onTogglePin,
  pinDisabled,
  likeCount,
  likedByViewer,
  onToggleLike,
  reactionDisabled,
}: {
  note: TripNoteRow;
  memberNames: Record<string, string>;
  onOpenLink: (value: string | null) => void;
  canTogglePin: boolean;
  onTogglePin: (note: TripNoteRow) => void;
  pinDisabled: boolean;
  likeCount: number;
  likedByViewer: boolean;
  onToggleLike: (note: TripNoteRow) => void;
  reactionDisabled: boolean;
}) {
  const normalizedLink = normalizeLink(note.link);
  const linkLabel = getLinkTypeLabel(note.link);
  const contentPreview = formatContentPreview(note.content);
  const categoryLabel = CATEGORY_LABELS[getIdeaCategory(note)];
  const shouldShowReactionCount = likeCount > 0;

  return (
    <View style={styles.ideaCard}>
      <View style={styles.ideaCardHeader}>
        <View style={styles.ideaHeaderTopRow}>
          <View style={styles.headerBadgeRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{categoryLabel}</Text>
            </View>
            {note.is_pinned ? (
              <View style={styles.pinnedBadge}>
                <Text style={styles.pinnedBadgeText}>Pinned</Text>
              </View>
            ) : null}
          </View>
          {canTogglePin ? (
            <Pressable
              onPress={() => onTogglePin(note)}
              disabled={pinDisabled}
              style={({ pressed }) => [
                styles.pinAction,
                note.is_pinned ? styles.pinActionActive : null,
                pressed && !pinDisabled ? styles.pinActionPressed : null,
                pinDisabled ? styles.pinActionDisabled : null,
              ]}
            >
              <Text
                style={[
                  styles.pinActionText,
                  note.is_pinned ? styles.pinActionTextActive : null,
                ]}
              >
                {note.is_pinned ? "Unpin" : "Pin"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.ideaHeaderText}>
          <Text style={styles.ideaTitle}>{formatIdeaTitle(note)}</Text>
          <Text style={styles.ideaCreator}>
            {memberNames[note.created_by ?? ""] ?? "Unknown member"}
          </Text>
        </View>
      </View>

      {contentPreview ? (
        <Text style={styles.ideaContent} numberOfLines={4}>
          {contentPreview}
        </Text>
      ) : null}

      {normalizedLink ? (
        <Pressable
          onPress={() => onOpenLink(note.link)}
          style={({ pressed }) => [
            styles.linkCard,
            pressed ? styles.linkCardPressed : null,
          ]}
        >
          <View style={styles.linkCardTopRow}>
            <View style={styles.linkLabelBadge}>
              <Text style={styles.linkLabelBadgeText}>{linkLabel}</Text>
            </View>
            <Text style={styles.linkActionText}>Open</Text>
          </View>
          <Text
            style={styles.linkValue}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {normalizedLink}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.cardFooter}>
        <Pressable
          onPress={() => onToggleLike(note)}
          disabled={reactionDisabled}
          style={({ pressed }) => [
            styles.reactionButton,
            likedByViewer ? styles.reactionButtonLiked : null,
            pressed && !reactionDisabled ? styles.reactionButtonPressed : null,
            reactionDisabled ? styles.reactionButtonDisabled : null,
          ]}
        >
          <Text
            style={[
              styles.reactionIcon,
              likedByViewer ? styles.reactionIconLiked : null,
            ]}
          >
            {likedByViewer ? "♥" : "♡"}
          </Text>
          <Text
            style={[
              styles.reactionLabel,
              likedByViewer ? styles.reactionLabelLiked : null,
            ]}
          >
            {likedByViewer ? "Liked" : "Like"}
          </Text>
        </Pressable>

        {shouldShowReactionCount ? (
          <Text
            style={[
              styles.reactionCount,
              likedByViewer ? styles.reactionCountLiked : null,
            ]}
          >
            {likeCount}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function TripNotesScreen() {
  const params = useLocalSearchParams();
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const userId = useAuthStore((s) => s.userId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState<TripNoteRow[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [canAddNotes, setCanAddNotes] = useState(false);
  const [showAddIdeaModal, setShowAddIdeaModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all");
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedNoteIds, setLikedNoteIds] = useState<Record<string, boolean>>({});
  const [togglingPinId, setTogglingPinId] = useState<string | null>(null);
  const [togglingReactionId, setTogglingReactionId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");
  const [category, setCategory] = useState<TripIdeaCategory>("general");

  const isIdeaFormDirty = useMemo(() => {
    return !!title.trim() || !!content.trim() || !!link.trim() || category !== "general";
  }, [category, content, link, title]);

  const loadReactions = async (noteRows: TripNoteRow[]) => {
    if (!userId) {
      setLikeCounts({});
      setLikedNoteIds({});
      return;
    }

    const reactions = await listTripNoteReactions(noteRows.map((row) => row.id));
    const nextLikeCounts: Record<string, number> = {};
    const nextLikedNoteIds: Record<string, boolean> = {};

    for (const reaction of reactions) {
      nextLikeCounts[reaction.trip_note_id] =
        (nextLikeCounts[reaction.trip_note_id] ?? 0) + 1;
      if (reaction.user_id === userId) {
        nextLikedNoteIds[reaction.trip_note_id] = true;
      }
    }

    setLikeCounts(nextLikeCounts);
    setLikedNoteIds(nextLikedNoteIds);
  };

  const load = async () => {
    if (!tripId) return;

    try {
      setErrorMsg(null);
      setLoading(true);
      const [overview, noteRows] = await Promise.all([
        getTripOverview(tripId),
        listTripNotes(tripId),
      ]);

      const member = overview.members.find((row) => row.user_id === userId);
      setCanAddNotes(
        member?.role === "creator" || member?.role === "planner"
      );
      setMemberNames(
        Object.fromEntries(
          overview.members.map((row) => [
            row.user_id,
            row.profiles?.display_name ||
              row.profiles?.full_name ||
              `Member ${row.user_id.slice(0, 6)}`,
          ])
        )
      );
      setNotes(noteRows);
      await loadReactions(noteRows);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load ideas board");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [tripId, userId]);

  const filteredIdeas = useMemo(() => {
    if (activeFilter === "all") return notes;
    return notes.filter((note) => getIdeaCategory(note) === activeFilter);
  }, [activeFilter, notes]);

  const pinnedIdeas = useMemo(
    () => notes.filter((note) => note.is_pinned),
    [notes]
  );

  const unpinnedIdeas = useMemo(
    () => filteredIdeas.filter((note) => !note.is_pinned),
    [filteredIdeas]
  );

  const canSubmit = useMemo(() => {
    return !!title.trim() || !!content.trim() || !!link.trim();
  }, [title, content, link]);

  const resetIdeaForm = () => {
    setTitle("");
    setContent("");
    setLink("");
    setCategory("general");
  };

  const dismissAddIdeaModal = () => {
    if (!isIdeaFormDirty) {
      setShowAddIdeaModal(false);
      return;
    }

    Alert.alert(
      "Discard idea?",
      "You have unsaved input. Discard it and close?",
      [
        { text: "Keep Editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            resetIdeaForm();
            setShowAddIdeaModal(false);
          },
        },
      ]
    );
  };

  const handleCreateNote = async () => {
    if (!tripId || !userId) return;
    if (!canSubmit) {
      Alert.alert("Idea is empty", "Add a title, note, or link first.");
      return;
    }

    try {
      setSaving(true);
      await createTripNote({
        tripId,
        createdBy: userId,
        title,
        content,
        link,
        category,
      });
      resetIdeaForm();
      setShowAddIdeaModal(false);
      await load();
      Alert.alert("Idea added", "Your idea is now visible to the group.");
    } catch (e: any) {
      Alert.alert("Create failed", e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLike = async (note: TripNoteRow) => {
    if (!userId || togglingReactionId) return;

    try {
      setTogglingReactionId(note.id);
      await toggleTripNoteLike({
        tripNoteId: note.id,
        userId,
        liked: !!likedNoteIds[note.id],
      });
      await loadReactions(notes);
    } catch (e: any) {
      Alert.alert("Reaction failed", e?.message ?? String(e));
    } finally {
      setTogglingReactionId(null);
    }
  };

  const handleTogglePin = async (note: TripNoteRow) => {
    if (!canAddNotes || togglingPinId) return;

    try {
      setTogglingPinId(note.id);
      const updatedNote = await updateTripNotePin({
        tripNoteId: note.id,
        isPinned: !note.is_pinned,
      });
      setNotes((currentNotes) =>
        currentNotes
          .map((currentNote) =>
            currentNote.id === updatedNote.id ? updatedNote : currentNote
          )
          .sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) {
              return a.is_pinned ? -1 : 1;
            }

            const aTime = a.created_at ? Date.parse(a.created_at) : 0;
            const bTime = b.created_at ? Date.parse(b.created_at) : 0;
            return bTime - aTime;
          })
      );
    } catch (e: any) {
      Alert.alert("Couldn't update pin", e?.message ?? String(e));
    } finally {
      setTogglingPinId(null);
    }
  };

  const handleOpenLink = async (value: string | null) => {
    const normalized = normalizeLink(value);
    if (!normalized) return;

    try {
      await Linking.openURL(normalized);
    } catch (e: any) {
      Alert.alert("Couldn't open link", e?.message ?? String(e));
    }
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
    <Screen topInset="sm">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Shared Ideas Board</Text>
        <Text style={styles.pageDescription}>
          Keep links, places, and trip ideas in one shared board for the group.
        </Text>

        <View style={styles.toolbarRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTER_OPTIONS.map((option) => {
              const selected = activeFilter === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setActiveFilter(option.value)}
                  style={[
                    styles.filterChip,
                    selected ? styles.filterChipSelected : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selected ? styles.filterChipTextSelected : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {canAddNotes ? (
            <Pressable
              onPress={() => setShowAddIdeaModal(true)}
              style={({ pressed }) => [
                styles.addIdeaButton,
                pressed ? styles.addIdeaButtonPressed : null,
              ]}
            >
              <Text style={styles.addIdeaButtonText}>Add Idea</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.sectionBlock}>
          {pinnedIdeas.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Pinned</Text>
              {pinnedIdeas.map((note) => (
                <IdeaCard
                  key={note.id}
                  note={note}
                  memberNames={memberNames}
                  onOpenLink={handleOpenLink}
                  canTogglePin={canAddNotes}
                  onTogglePin={handleTogglePin}
                  pinDisabled={togglingPinId === note.id}
                  likeCount={likeCounts[note.id] ?? 0}
                  likedByViewer={!!likedNoteIds[note.id]}
                  onToggleLike={handleToggleLike}
                  reactionDisabled={togglingReactionId === note.id}
                />
              ))}
            </View>
          ) : null}

          {unpinnedIdeas.length > 0 ? (
            <Text style={styles.sectionHeading}>Shared ideas</Text>
          ) : null}
          {filteredIdeas.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyTitle}>
                {notes.length === 0 ? "Nothing saved yet" : "No ideas in this filter"}
              </Text>
              <Text style={styles.emptyText}>
                {notes.length === 0
                  ? "Add restaurant links, TikToks, stays, activities, or quick planning notes here."
                  : "Try another category to browse the rest of the board."}
              </Text>
            </View>
          ) : unpinnedIdeas.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>
                All matching ideas are pinned above.
              </Text>
            </View>
          ) : (
            unpinnedIdeas.map((note) => (
              <IdeaCard
                key={note.id}
                note={note}
                memberNames={memberNames}
                onOpenLink={handleOpenLink}
                canTogglePin={canAddNotes}
                onTogglePin={handleTogglePin}
                pinDisabled={togglingPinId === note.id}
                likeCount={likeCounts[note.id] ?? 0}
                likedByViewer={!!likedNoteIds[note.id]}
                onToggleLike={handleToggleLike}
                reactionDisabled={togglingReactionId === note.id}
              />
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showAddIdeaModal}
        transparent
        animationType="fade"
        onRequestClose={dismissAddIdeaModal}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={dismissAddIdeaModal}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Add Idea</Text>
            <Text style={styles.modalSubtitle}>
              Save a link, place, or quick planning note for the group.
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              {CATEGORY_OPTIONS.map((option) => {
                const selected = category === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setCategory(option)}
                    style={[
                      styles.categoryChip,
                      selected ? styles.categoryChipSelected : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        selected ? styles.categoryChipTextSelected : null,
                      ]}
                    >
                      {CATEGORY_LABELS[option]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <AppInput
              label="Title"
              placeholder="Optional"
              value={title}
              onChangeText={setTitle}
            />
            <AppInput
              label="Note"
              placeholder="Optional"
              value={content}
              onChangeText={setContent}
              multiline
              style={styles.multilineInput}
            />
            <AppInput
              label="Link"
              placeholder="Optional"
              value={link}
              onChangeText={setLink}
              autoCapitalize="none"
            />

            <AppButton
              label={saving ? "Saving..." : "Add Idea"}
              onPress={handleCreateNote}
              disabled={saving}
            />
            <Pressable
              onPress={dismissAddIdeaModal}
              style={({ pressed }) => [
                styles.modalSecondaryAction,
                pressed ? styles.modalSecondaryActionPressed : null,
              ]}
            >
              <Text style={styles.modalSecondaryActionText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  toolbarRow: {
    gap: spacing.md,
  },
  filterRow: {
    paddingRight: spacing.sm,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.label,
    color: colors.text,
  },
  filterChipTextSelected: {
    color: colors.onPrimary,
  },
  addIdeaButton: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  addIdeaButtonPressed: {
    opacity: 0.82,
  },
  addIdeaButtonText: {
    ...typography.button,
    color: colors.onPrimary,
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
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  emptyText: {
    ...typography.bodyMuted,
  },
  ideaCard: {
    padding: spacing.xl,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    gap: spacing.lg,
  },
  ideaCardHeader: {
    gap: spacing.sm,
  },
  ideaHeaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
  },
  pinAction: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "#fafafa",
  },
  pinActionActive: {
    borderColor: "#d7d7d7",
    backgroundColor: "#f3f4f6",
  },
  pinActionPressed: {
    opacity: 0.82,
  },
  pinActionDisabled: {
    opacity: 0.55,
  },
  pinActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  pinActionTextActive: {
    color: colors.text,
  },
  ideaHeaderText: {
    gap: spacing.xs,
  },
  ideaTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.3,
  },
  ideaCreator: {
    ...typography.bodyMuted,
    fontSize: 14,
  },
  categoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "#f5f3ef",
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#75685a",
  },
  pinnedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "#eef2f6",
  },
  pinnedBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4d6076",
  },
  ideaContent: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
  },
  linkCard: {
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: "#fbfaf8",
    borderWidth: 1,
    borderColor: "#ece7df",
    gap: spacing.sm,
  },
  linkCardPressed: {
    opacity: 0.84,
  },
  linkCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  linkLabelBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "#efe8dd",
  },
  linkLabelBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#725f47",
  },
  linkActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  linkValue: {
    color: "#1d4ed8",
    fontSize: 14,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.xs,
  },
  reactionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "#fbfbfb",
  },
  reactionButtonLiked: {
    borderColor: "#f3b4bf",
    backgroundColor: "#fff4f6",
  },
  reactionButtonPressed: {
    opacity: 0.82,
  },
  reactionButtonDisabled: {
    opacity: 0.55,
  },
  reactionIcon: {
    fontSize: 14,
    color: colors.textMuted,
  },
  reactionIconLiked: {
    color: "#d11a2a",
  },
  reactionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  reactionLabelLiked: {
    color: "#d11a2a",
  },
  reactionCount: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  reactionCountLiked: {
    color: "#d11a2a",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(17, 17, 17, 0.24)",
    padding: spacing.lg,
  },
  modalCard: {
    padding: spacing.lg,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    ...typography.bodyMuted,
    marginBottom: spacing.lg,
  },
  categoryRow: {
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    ...typography.label,
    color: colors.text,
  },
  categoryChipTextSelected: {
    color: colors.onPrimary,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  modalSecondaryAction: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  modalSecondaryActionPressed: {
    opacity: 0.8,
  },
  modalSecondaryActionText: {
    ...typography.label,
    color: colors.textMuted,
  },
  error: { color: "tomato" },
});
