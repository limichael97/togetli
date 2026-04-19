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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthStore } from "../../../../store/useAuthStore";
import { Screen } from "../../../../components/ui/Screen";
import { AppInput } from "../../../../components/ui/AppInput";
import { AppButton } from "../../../../components/ui/AppButton";
import { colors, radius, spacing, typography } from "../../../../lib/theme";
import { getTripOverview, type TripType } from "../../../../lib/trips";
import { parseStayPollDefinition } from "../../../../lib/polls";
import { supabase } from "../../../../supabaseClient";
import { getTripAwareCopy } from "../../../../lib/tripCopy";
import {
  createTripNote,
  listTripNotes,
  listTripNoteReactions,
  toggleTripNoteLike,
  updateTripNoteCategory,
  updateTripNotePin,
  type TripIdeaCategory,
  type TripNoteRow,
} from "../../../../lib/tripNotes";

type VisibleIdeaCategory = Exclude<TripIdeaCategory, "travel">;
type FilterValue = "all" | VisibleIdeaCategory;
type SelectedStayIdea = {
  source_note_id: string;
  title: string;
  link: string | null;
  category: "stay";
  total_price?: string | null;
  beds?: string | null;
  bedrooms?: string | null;
  bathrooms?: string | null;
  location?: string | null;
  note?: string | null;
};

const CATEGORY_OPTIONS: VisibleIdeaCategory[] = [
  "general",
  "stay",
  "food",
  "activities",
];

const FILTER_OPTIONS: Array<{ value: FilterValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "general", label: "General" },
  { value: "stay", label: "Stay" },
  { value: "food", label: "Food" },
  { value: "activities", label: "Activities" },
];

const CATEGORY_LABELS: Record<TripIdeaCategory, string> = {
  food: "Food",
  activities: "Activities",
  stay: "Stay",
  travel: "General",
  general: "General",
};

function normalizeLink(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getIdeaCategory(note: TripNoteRow): VisibleIdeaCategory {
  if (note.category === "travel") return "general";
  return (note.category ?? "general") as VisibleIdeaCategory;
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

function getDefaultIdeaCategory(filter: FilterValue): VisibleIdeaCategory {
  if (filter === "all" || filter === "general") return "general";
  return filter;
}

function parseStayDraftOptions(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item): SelectedStayIdea[] => {
      if (!item || typeof item !== "object") return [];

      const source_note_id =
        typeof item.source_note_id === "string" ? item.source_note_id : "";
      const title =
        typeof item.title === "string" && item.title.trim()
          ? item.title.trim()
          : "Untitled stay";
      const link = typeof item.link === "string" ? item.link : null;
      const category = item.category === "stay" ? "stay" : null;

      if (!source_note_id || !category) return [];

      return [
        {
          source_note_id,
          title,
          link,
          category,
          total_price:
            typeof item.total_price === "string" ? item.total_price : null,
          beds: typeof item.beds === "string" ? item.beds : null,
          bedrooms:
            typeof item.bedrooms === "string" ? item.bedrooms : null,
          bathrooms:
            typeof item.bathrooms === "string" ? item.bathrooms : null,
          location:
            typeof item.location === "string" ? item.location : null,
          note: typeof item.note === "string" ? item.note : null,
        },
      ];
    });
  } catch {
    return [];
  }
}

function IdeaCard({
  note,
  memberNames,
  onOpenLink,
  canEditCategory,
  onPressCategory,
  selectable,
  selected,
  onSelect,
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
  canEditCategory: boolean;
  onPressCategory: (note: TripNoteRow) => void;
  selectable: boolean;
  selected: boolean;
  onSelect: (note: TripNoteRow) => void;
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
  const Container = selectable ? Pressable : View;

  return (
    <Container
      {...(selectable
        ? {
            onPress: () => onSelect(note),
            style: ({ pressed }: { pressed: boolean }) => [
              styles.ideaCard,
              styles.selectableIdeaCard,
              selected ? styles.ideaCardSelected : null,
              pressed ? styles.selectableIdeaCardPressed : null,
            ],
          }
        : { style: styles.ideaCard })}
    >
      <View style={styles.ideaCardHeader}>
        <View style={styles.ideaHeaderTopRow}>
          <View style={styles.headerBadgeRow}>
            {canEditCategory && !selectable ? (
              <Pressable
                onPress={() => onPressCategory(note)}
                style={({ pressed }) => [
                  styles.categoryBadge,
                  pressed ? styles.categoryBadgePressed : null,
                ]}
              >
                <Text style={styles.categoryBadgeText}>{categoryLabel}</Text>
              </Pressable>
            ) : (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{categoryLabel}</Text>
              </View>
            )}
            {note.is_pinned ? (
              <View style={styles.pinnedBadge}>
                <Text style={styles.pinnedBadgeText}>Pinned</Text>
              </View>
            ) : null}
            {selectable ? (
              <View
                style={[
                  styles.selectionBadge,
                  selected ? styles.selectionBadgeSelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.selectionBadgeText,
                    selected ? styles.selectionBadgeTextSelected : null,
                  ]}
                >
                  {selected ? "Selected" : "Select"}
                </Text>
              </View>
            ) : null}
          </View>
          {canTogglePin && !selectable ? (
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
        <View>
          {selectable ? (
            <View style={styles.linkCard}>
              <View style={styles.linkCardTopRow}>
                <View style={styles.linkLabelBadge}>
                  <Text style={styles.linkLabelBadgeText}>{linkLabel}</Text>
                </View>
                <Text style={styles.linkActionText}>Included</Text>
              </View>
              <Text
                style={styles.linkValue}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {normalizedLink}
              </Text>
            </View>
          ) : (
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
          )}
        </View>
      ) : null}

      {selectable ? (
        <View style={styles.cardFooter}>
          <View style={styles.linkCardTopRow}>
            <Text style={styles.selectionHintText}>
              {selected
                ? "Selected for stay poll"
                : "Tap card to add to stay poll"}
            </Text>
          </View>
        </View>
      ) : null}

      {!selectable ? (
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
      ) : null}
    </Container>
  );
}

export default function TripNotesScreen() {
  const params = useLocalSearchParams();
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const stayDraftOptions = useMemo(
    () => parseStayDraftOptions(params.stayDraft),
    [params.stayDraft]
  );
  const stayDraftById = useMemo(
    () =>
      new Map(
        stayDraftOptions.map((option) => [option.source_note_id, option] as const)
      ),
    [stayDraftOptions]
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState<TripNoteRow[]>([]);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [canAddIdeas, setCanAddIdeas] = useState(false);
  const [canManageStayPoll, setCanManageStayPoll] = useState(false);
  const [hasExistingStayPoll, setHasExistingStayPoll] = useState(false);
  const [stayPollCta, setStayPollCta] = useState<{
    label: string;
    href: string;
  } | null>(null);
  const [showAddIdeaModal, setShowAddIdeaModal] = useState(false);
  const [tripType, setTripType] = useState<TripType | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIdeaIds, setSelectedIdeaIds] = useState<string[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedNoteIds, setLikedNoteIds] = useState<Record<string, boolean>>({});
  const [togglingPinId, setTogglingPinId] = useState<string | null>(null);
  const [togglingReactionId, setTogglingReactionId] = useState<string | null>(null);
  const [categoryPickerNote, setCategoryPickerNote] = useState<TripNoteRow | null>(
    null
  );
  const [updatingCategoryId, setUpdatingCategoryId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");
  const [category, setCategory] = useState<VisibleIdeaCategory>("general");

  const isIdeaFormDirty = useMemo(() => {
    return !!title.trim() || !!content.trim() || !!link.trim() || category !== "general";
  }, [category, content, link, title]);
  const tripCopy = useMemo(() => getTripAwareCopy(tripType), [tripType]);

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
      const [overview, noteRows, tripResult] = await Promise.all([
        getTripOverview(tripId),
        listTripNotes(tripId),
        supabase
          .from("trips")
          .select("custom_poll_questions")
          .eq("id", tripId)
          .single(),
      ]);

      const member = overview.members.find((row) => row.user_id === userId);
      setTripType(overview.trip.type);
      const canManage =
        member?.role === "creator" || member?.role === "planner";
      setCanAddIdeas(!!member);
      setCanManageStayPoll(canManage);
      if (tripResult.error) {
        throw tripResult.error;
      }
      const stayDefinition = parseStayPollDefinition(
        tripResult.data?.custom_poll_questions ?? null
      );
      const hasStayPoll = !!stayDefinition;
      setHasExistingStayPoll(hasStayPoll);
      setStayPollCta(
        hasStayPoll
          ? {
              label: stayDefinition?.finalized_winner_note_id
                ? "View Results"
                : "View Stay Poll",
              href: stayDefinition?.finalized_winner_note_id
                ? `/(tabs)/trips/${tripId}/poll-results`
                : `/(tabs)/trips/${tripId}/poll`,
            }
          : null
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

  const isStayFilterActive = activeFilter === "stay";
  const canUseSelectionMode =
    canManageStayPoll && isStayFilterActive && !hasExistingStayPoll;

  const pinnedIdeas = useMemo(
    () => filteredIdeas.filter((note) => note.is_pinned),
    [filteredIdeas]
  );

  const unpinnedIdeas = useMemo(
    () => filteredIdeas.filter((note) => !note.is_pinned),
    [filteredIdeas]
  );

  const selectedIdeas = useMemo(
    () => notes.filter((note) => selectedIdeaIds.includes(note.id)),
    [notes, selectedIdeaIds]
  );

  const canCreatePoll = selectedIdeaIds.length >= 2;
  const categoryPickerValue = categoryPickerNote
    ? getIdeaCategory(categoryPickerNote)
    : null;

  const canSubmit = useMemo(() => {
    return !!title.trim() || !!content.trim() || !!link.trim();
  }, [title, content, link]);

  useEffect(() => {
    if (canUseSelectionMode) return;
    setSelectionMode(false);
    if (hasExistingStayPoll || !canManageStayPoll) {
      setSelectedIdeaIds([]);
    }
  }, [canManageStayPoll, canUseSelectionMode, hasExistingStayPoll]);

  useEffect(() => {
    setSelectedIdeaIds((currentIds) =>
      currentIds.filter((id) => notes.some((note) => note.id === id))
    );
  }, [notes]);

  useEffect(() => {
    if (!canManageStayPoll || hasExistingStayPoll || stayDraftOptions.length === 0) {
      return;
    }

    setActiveFilter("stay");
    setSelectedIdeaIds(stayDraftOptions.map((option) => option.source_note_id));
    setSelectionMode(true);
  }, [canManageStayPoll, hasExistingStayPoll, stayDraftOptions]);

  const resetIdeaForm = (nextCategory: VisibleIdeaCategory = "general") => {
    setTitle("");
    setContent("");
    setLink("");
    setCategory(nextCategory);
  };

  const handleOpenAddIdeaModal = () => {
    resetIdeaForm(getDefaultIdeaCategory(activeFilter));
    setShowAddIdeaModal(true);
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
    if (!canManageStayPoll || togglingPinId) return;

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

  const canEditIdeaCategory = (note: TripNoteRow) => {
    if (!userId) return false;
    return canManageStayPoll || note.created_by === userId;
  };

  const handleOpenCategoryPicker = (note: TripNoteRow) => {
    if (!canEditIdeaCategory(note) || selectionMode) return;
    setCategoryPickerNote(note);
  };

  const handleDismissCategoryPicker = () => {
    if (updatingCategoryId) return;
    setCategoryPickerNote(null);
  };

  const handleSelectIdeaCategory = async (nextCategory: VisibleIdeaCategory) => {
    if (!categoryPickerNote) return;
    if (getIdeaCategory(categoryPickerNote) === nextCategory) {
      setCategoryPickerNote(null);
      return;
    }

    try {
      setUpdatingCategoryId(categoryPickerNote.id);
      const updatedNote = await updateTripNoteCategory({
        tripNoteId: categoryPickerNote.id,
        category: nextCategory,
      });
      setNotes((currentNotes) =>
        currentNotes.map((note) =>
          note.id === updatedNote.id ? updatedNote : note
        )
      );
      if (nextCategory !== "stay") {
        setSelectedIdeaIds((currentIds) =>
          currentIds.filter((id) => id !== updatedNote.id)
        );
      }
      setCategoryPickerNote(null);
    } catch (e: any) {
      Alert.alert("Couldn't update category", e?.message ?? String(e));
    } finally {
      setUpdatingCategoryId(null);
    }
  };

  const toggleSelectionMode = () => {
    if (!canUseSelectionMode) return;
    setSelectionMode((current) => {
      if (current) {
        setSelectedIdeaIds([]);
        return false;
      }

      return true;
    });
  };

  const handleSelectIdea = (note: TripNoteRow) => {
    if (!selectionMode || getIdeaCategory(note) !== "stay") return;

    setSelectedIdeaIds((currentIds) => {
      if (currentIds.includes(note.id)) {
        return currentIds.filter((id) => id !== note.id);
      }

      if (currentIds.length >= 5) {
        Alert.alert(
          "Selection limit",
          "You can select up to 5 stay ideas."
        );
        return currentIds;
      }

      return [...currentIds, note.id];
    });
  };

  const handleCreatePoll = () => {
    if (!tripId || !canCreatePoll) return;
    if (hasExistingStayPoll) {
      Alert.alert(
        "Stay poll already exists",
        "Only one active stay poll is supported right now."
      );
      return;
    }

    const prefilledOptions: SelectedStayIdea[] = selectedIdeas.map((note) => {
      const draftOption = stayDraftById.get(note.id);

      return {
        source_note_id: note.id,
        title: draftOption?.title?.trim() || formatIdeaTitle(note),
        link: draftOption?.link ?? note.link,
        category: "stay",
        total_price: draftOption?.total_price ?? null,
        beds: draftOption?.beds ?? null,
        bedrooms: draftOption?.bedrooms ?? null,
        bathrooms: draftOption?.bathrooms ?? null,
        location: draftOption?.location ?? null,
        note: draftOption?.note ?? null,
      };
    });

    router.push({
      pathname: "/(tabs)/trips/[tripId]/setup",
      params: {
        tripId,
        pollType: "stay",
        stayDraft: JSON.stringify(prefilledOptions),
      },
    });
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
        contentContainerStyle={[
          styles.scrollContent,
          selectionMode ? styles.scrollContentWithActionBar : null,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderText}>
            <Text style={styles.pageTitle}>Shared Ideas Board</Text>
            <Text style={styles.pageDescription}>
              {tripCopy.sharedIdeasDescription}
            </Text>
          </View>
          {canAddIdeas ? (
            <Pressable
                onPress={handleOpenAddIdeaModal}
                style={({ pressed }) => [
                  styles.addIdeaButton,
                  pressed ? styles.addIdeaButtonPressed : null,
                ]}
            >
              <Text style={styles.addIdeaButtonText}>Add Idea</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.toolbarRow}>
          <View style={styles.filterScrollWrap}>
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
            <View pointerEvents="none" style={styles.filterFade}>
              <Text style={styles.filterFadeText}>›</Text>
            </View>
          </View>
          <View style={styles.toolbarActions}>
            {isStayFilterActive && stayPollCta ? (
              <Pressable
                onPress={() => router.push(stayPollCta.href)}
                style={({ pressed }) => [
                  styles.secondaryToolbarButton,
                  pressed ? styles.secondaryToolbarButtonPressed : null,
                ]}
              >
                <Text style={styles.secondaryToolbarButtonText}>
                  {stayPollCta.label}
                </Text>
              </Pressable>
            ) : null}
            {canUseSelectionMode ? (
              <Pressable
                onPress={toggleSelectionMode}
                style={({ pressed }) => [
                  styles.secondaryToolbarButton,
                  selectionMode ? styles.secondaryToolbarButtonActive : null,
                  pressed ? styles.secondaryToolbarButtonPressed : null,
                ]}
              >
                <Text
                  style={[
                    styles.secondaryToolbarButtonText,
                    selectionMode ? styles.secondaryToolbarButtonTextActive : null,
                  ]}
                >
                  {selectionMode ? "Selecting" : "Select"}
                </Text>
              </Pressable>
            ) : null}
          </View>
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
                  canEditCategory={canEditIdeaCategory(note)}
                  onPressCategory={handleOpenCategoryPicker}
                  selectable={
                    selectionMode && getIdeaCategory(note) === "stay"
                  }
                  selected={selectedIdeaIds.includes(note.id)}
                  onSelect={handleSelectIdea}
                  canTogglePin={canManageStayPoll && !selectionMode}
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
                canEditCategory={canEditIdeaCategory(note)}
                onPressCategory={handleOpenCategoryPicker}
                selectable={
                  selectionMode && getIdeaCategory(note) === "stay"
                }
                selected={selectedIdeaIds.includes(note.id)}
                onSelect={handleSelectIdea}
                canTogglePin={canManageStayPoll && !selectionMode}
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

      <Modal
        visible={!!categoryPickerNote}
        transparent
        animationType="fade"
        onRequestClose={handleDismissCategoryPicker}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={handleDismissCategoryPicker}
        >
          <Pressable style={styles.categoryPickerCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Change category</Text>
            <Text style={styles.modalSubtitle}>
              Move this idea into the category that fits it best.
            </Text>

            <View style={styles.categoryPickerOptions}>
              {CATEGORY_OPTIONS.map((option) => {
                const selected = categoryPickerValue === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => void handleSelectIdeaCategory(option)}
                    disabled={!!updatingCategoryId}
                    style={({ pressed }) => [
                      styles.categoryPickerOption,
                      selected ? styles.categoryPickerOptionSelected : null,
                      pressed && !updatingCategoryId
                        ? styles.categoryPickerOptionPressed
                        : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryPickerOptionText,
                        selected ? styles.categoryPickerOptionTextSelected : null,
                      ]}
                    >
                      {CATEGORY_LABELS[option]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={handleDismissCategoryPicker}
              disabled={!!updatingCategoryId}
              style={({ pressed }) => [
                styles.modalSecondaryAction,
                pressed && !updatingCategoryId
                  ? styles.modalSecondaryActionPressed
                  : null,
              ]}
            >
              <Text style={styles.modalSecondaryActionText}>
                {updatingCategoryId ? "Saving..." : "Cancel"}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {selectionMode ? (
        <View style={styles.selectionActionBar}>
          <View style={styles.selectionSummary}>
            <Text style={styles.selectionSummaryTitle}>
              {selectedIdeaIds.length} selected
            </Text>
            <Text style={styles.selectionSummaryText}>
              {tripCopy.staySelectionHint}
            </Text>
          </View>
          <View style={styles.selectionActionRow}>
            <Pressable
              onPress={toggleSelectionMode}
              style={({ pressed }) => [
                styles.selectionCancelButton,
                pressed ? styles.selectionCancelButtonPressed : null,
              ]}
            >
              <Text style={styles.selectionCancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleCreatePoll}
              disabled={!canCreatePoll}
              style={({ pressed }) => [
                styles.selectionCreateButton,
                !canCreatePoll ? styles.selectionCreateButtonDisabled : null,
                pressed && canCreatePoll ? styles.selectionCreateButtonPressed : null,
              ]}
            >
              <Text style={styles.selectionCreateButtonText}>Create Poll</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingBottom: spacing.xxl, gap: spacing.md },
  pageHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  pageHeaderText: {
    flex: 1,
  },
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
  toolbarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  filterScrollWrap: {
    position: "relative",
  },
  filterRow: {
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  filterFade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 32,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.68)",
  },
  filterFadeText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textMuted,
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
    marginTop: spacing.xs,
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
  secondaryToolbarButton: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryToolbarButtonActive: {
    borderColor: colors.primary,
    backgroundColor: "#f5f5f5",
  },
  secondaryToolbarButtonPressed: {
    opacity: 0.82,
  },
  secondaryToolbarButtonText: {
    ...typography.button,
    color: colors.text,
  },
  secondaryToolbarButtonTextActive: {
    color: colors.primary,
  },
  sectionBlock: {
    gap: spacing.sm,
  },
  scrollContentWithActionBar: {
    paddingBottom: spacing.xxl * 2 + 96,
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
  selectableIdeaCard: {
    borderColor: "#d9dee5",
  },
  selectableIdeaCardPressed: {
    opacity: 0.92,
  },
  ideaCardSelected: {
    borderColor: colors.primary,
    backgroundColor: "#f8fbff",
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
  categoryBadgePressed: {
    opacity: 0.82,
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
  selectionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "#f3f4f6",
  },
  selectionBadgeSelected: {
    backgroundColor: "#e8f1ff",
  },
  selectionBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  selectionBadgeTextSelected: {
    color: colors.primary,
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
  selectionHintText: {
    ...typography.bodyMuted,
    fontSize: 13,
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
  categoryPickerCard: {
    padding: spacing.lg,
    borderRadius: 20,
    backgroundColor: colors.surface,
    gap: spacing.md,
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
  categoryPickerOptions: {
    gap: spacing.sm,
  },
  categoryPickerOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryPickerOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: "#f8fbff",
  },
  categoryPickerOptionPressed: {
    opacity: 0.82,
  },
  categoryPickerOptionText: {
    ...typography.label,
    color: colors.text,
  },
  categoryPickerOptionTextSelected: {
    color: colors.primary,
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
  selectionActionBar: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    gap: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  selectionSummary: {
    gap: spacing.xs,
  },
  selectionSummaryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  selectionSummaryText: {
    ...typography.bodyMuted,
  },
  selectionActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  selectionCancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectionCancelButtonPressed: {
    opacity: 0.82,
  },
  selectionCancelButtonText: {
    ...typography.button,
    color: colors.text,
  },
  selectionCreateButton: {
    flex: 1.2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  selectionCreateButtonDisabled: {
    opacity: 0.45,
  },
  selectionCreateButtonPressed: {
    opacity: 0.82,
  },
  selectionCreateButtonText: {
    ...typography.button,
    color: colors.onPrimary,
  },
  error: { color: "tomato" },
});
