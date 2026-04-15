import { supabase } from "../supabaseClient";

export type TripNoteRow = {
  id: string;
  trip_id: string;
  created_by: string | null;
  title: string | null;
  content: string | null;
  link: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function listTripNotes(tripId: string): Promise<TripNoteRow[]> {
  const { data, error } = await supabase
    .from("trip_notes")
    .select("id, trip_id, created_by, title, content, link, created_at, updated_at")
    .eq("trip_id", tripId)
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
}): Promise<TripNoteRow> {
  const { data, error } = await supabase
    .from("trip_notes")
    .insert({
      trip_id: params.tripId,
      created_by: params.createdBy,
      title: params.title?.trim() || null,
      content: params.content?.trim() || null,
      link: params.link?.trim() || null,
    })
    .select("id, trip_id, created_by, title, content, link, created_at, updated_at")
    .single();

  if (error) throw error;
  return data as TripNoteRow;
}
