import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Pressable,
} from "react-native";
import * as Linking from "expo-linking";
import { useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../../../../store/useAuthStore";
import { Screen } from "../../../../components/ui/Screen";
import { AppInput } from "../../../../components/ui/AppInput";
import { AppButton } from "../../../../components/ui/AppButton";
import { colors, radius, spacing, typography } from "../../../../lib/theme";
import { getTripOverview } from "../../../../lib/trips";
import { createTripNote, listTripNotes, type TripNoteRow } from "../../../../lib/tripNotes";

function formatNoteValue(value: string | null, emptyText: string) {
  return value?.trim() ? value : emptyText;
}

function normalizeLink(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
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
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");

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
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load notes board");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tripId, userId]);

  const canSubmit = useMemo(() => {
    return !!title.trim() || !!content.trim() || !!link.trim();
  }, [title, content, link]);

  const handleCreateNote = async () => {
    if (!tripId || !userId) return;
    if (!canSubmit) {
      Alert.alert("Note is empty", "Add a title, content, or link first.");
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
      });
      setTitle("");
      setContent("");
      setLink("");
      await load();
      Alert.alert("Note added", "Your note is now visible to the group.");
    } catch (e: any) {
      Alert.alert("Create failed", e?.message ?? String(e));
    } finally {
      setSaving(false);
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
        <Text style={styles.pageTitle}>Notes Board</Text>
        <Text style={styles.pageDescription}>
          Shared info, links, and planning notes for the trip.
        </Text>

        {canAddNotes ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add a note</Text>
            <AppInput
              label="Title"
              placeholder="Optional"
              value={title}
              onChangeText={setTitle}
            />
            <AppInput
              label="Content"
              placeholder="Optional"
              value={content}
              onChangeText={setContent}
              multiline
            />
            <AppInput
              label="Link"
              placeholder="Optional"
              value={link}
              onChangeText={setLink}
              autoCapitalize="none"
            />
            <AppButton
              label={saving ? "Saving..." : "Add Note"}
              onPress={handleCreateNote}
              disabled={saving}
            />
          </View>
        ) : null}

        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Shared notes</Text>
          {notes.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.emptyText}>
                No shared notes yet. Add links, reminders, or key trip info here.
              </Text>
            </View>
          ) : (
            notes.map((note) => (
              <View key={note.id} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {formatNoteValue(note.title, "Untitled note")}
                </Text>
                <Text style={styles.cardMeta}>
                  {memberNames[note.created_by ?? ""] ?? "Unknown member"}
                </Text>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Content</Text>
                  <Text style={styles.detailValue}>
                    {formatNoteValue(note.content, "No content")}
                  </Text>
                </View>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Link</Text>
                  {note.link?.trim() ? (
                    <Pressable onPress={() => handleOpenLink(note.link)}>
                      <Text style={styles.linkText}>
                        {normalizeLink(note.link)}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.detailValue}>No link</Text>
                  )}
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
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  cardMeta: {
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
  linkText: {
    color: colors.primary,
    fontSize: 15,
    lineHeight: 20,
    textDecorationLine: "underline",
  },
  emptyText: {
    ...typography.bodyMuted,
  },
  error: { color: "tomato" },
});
