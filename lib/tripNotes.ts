import { supabase } from "../supabaseClient";

export type TripIdeaCategory =
  | "food"
  | "activities"
  | "stay"
  | "travel"
  | "general";

export type TripNoteRow = {
  id: string;
  trip_id: string;
  created_by: string | null;
  title: string | null;
  content: string | null;
  link: string | null;
  category: TripIdeaCategory | null;
  is_pinned: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type TripNoteReactionRow = {
  id: string;
  trip_note_id: string;
  user_id: string;
  reaction_type: "like";
  created_at: string;
};

export async function listTripNotes(tripId: string): Promise<TripNoteRow[]> {
  const { data, error } = await supabase
    .from("trip_notes")
    .select(
      "id, trip_id, created_by, title, content, link, category, is_pinned, created_at, updated_at"
    )
    .eq("trip_id", tripId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as TripNoteRow[];
}

export async function createTripNote(params: {
  tripId: string;
  createdBy: string;
  title?: string | null;
  content?: string | null;
  link?: string | null;
  category?: TripIdeaCategory | null;
}): Promise<TripNoteRow> {
  const { data, error } = await supabase
    .from("trip_notes")
    .insert({
      trip_id: params.tripId,
      created_by: params.createdBy,
      title: params.title?.trim() || null,
      content: params.content?.trim() || null,
      link: params.link?.trim() || null,
      category: params.category ?? "general",
    })
    .select(
      "id, trip_id, created_by, title, content, link, category, is_pinned, created_at, updated_at"
    )
    .single();

  if (error) throw error;
  return data as TripNoteRow;
}

export async function updateTripNotePin(params: {
  tripNoteId: string;
  isPinned: boolean;
}): Promise<TripNoteRow> {
  const { data, error } = await supabase
    .from("trip_notes")
    .update({ is_pinned: params.isPinned })
    .eq("id", params.tripNoteId)
    .select(
      "id, trip_id, created_by, title, content, link, category, is_pinned, created_at, updated_at"
    )
    .single();

  if (error) throw error;
  return data as TripNoteRow;
}

export async function updateTripNoteCategory(params: {
  tripNoteId: string;
  category: TripIdeaCategory;
}): Promise<TripNoteRow> {
  const { data, error } = await supabase
    .from("trip_notes")
    .update({ category: params.category })
    .eq("id", params.tripNoteId)
    .select(
      "id, trip_id, created_by, title, content, link, category, is_pinned, created_at, updated_at"
    )
    .single();

  if (error) throw error;
  return data as TripNoteRow;
}

export async function listTripNoteReactions(
  noteIds: string[]
): Promise<TripNoteReactionRow[]> {
  if (noteIds.length === 0) return [];

  const { data, error } = await supabase
    .from("trip_note_reactions")
    .select("id, trip_note_id, user_id, reaction_type, created_at")
    .in("trip_note_id", noteIds)
    .eq("reaction_type", "like");

  if (error) throw error;
  return (data ?? []) as TripNoteReactionRow[];
}

export async function toggleTripNoteLike(params: {
  tripNoteId: string;
  userId: string;
  liked: boolean;
}): Promise<void> {
  if (params.liked) {
    const { error } = await supabase
      .from("trip_note_reactions")
      .delete()
      .eq("trip_note_id", params.tripNoteId)
      .eq("user_id", params.userId)
      .eq("reaction_type", "like");

    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("trip_note_reactions").insert({
    trip_note_id: params.tripNoteId,
    user_id: params.userId,
    reaction_type: "like",
  });

  if (error) throw error;
}
