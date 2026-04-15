import { supabase } from "../supabaseClient";

export type TravelDetailRow = {
  id: string;
  trip_id: string;
  user_id: string;
  arrival_time: string | null;
  departure_time: string | null;
  flight_number: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type TravelDetailInput = {
  tripId: string;
  userId: string;
  arrival_time?: string | null;
  departure_time?: string | null;
  flight_number?: string | null;
  notes?: string | null;
};

export async function listTravelDetails(tripId: string): Promise<TravelDetailRow[]> {
  const { data, error } = await supabase
    .from("travel_details")
    .select(
      "id, trip_id, user_id, arrival_time, departure_time, flight_number, notes, created_at, updated_at"
    )
    .eq("trip_id", tripId)
    .order("arrival_time", { ascending: true });

  if (error) throw error;
  return (data ?? []) as TravelDetailRow[];
}

export async function getMyTravelDetail(
  tripId: string,
  userId: string
): Promise<TravelDetailRow | null> {
  const { data, error } = await supabase
    .from("travel_details")
    .select(
      "id, trip_id, user_id, arrival_time, departure_time, flight_number, notes, created_at, updated_at"
    )
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data as TravelDetailRow | null) ?? null;
}

export async function upsertTravelDetail(
  input: TravelDetailInput
): Promise<TravelDetailRow> {
  const { data, error } = await supabase
    .from("travel_details")
    .upsert(
      {
        trip_id: input.tripId,
        user_id: input.userId,
        arrival_time: input.arrival_time ?? null,
        departure_time: input.departure_time ?? null,
        flight_number: input.flight_number?.trim() || null,
        notes: input.notes?.trim() || null,
      },
      { onConflict: "trip_id,user_id" }
    )
    .select(
      "id, trip_id, user_id, arrival_time, departure_time, flight_number, notes, created_at, updated_at"
    )
    .single();

  if (error) throw error;
  return data as TravelDetailRow;
}
