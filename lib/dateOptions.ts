// lib/dateOptions.ts
import { supabase } from "../supabaseClient";
import type { TripDateOptionRow } from "./trips";

export async function listDateOptions(tripId: string): Promise<TripDateOptionRow[]> {
  const { data, error } = await supabase
    .from("trip_date_options")
    .select("id, trip_id, start_date, end_date, label, created_at")
    .eq("trip_id", tripId)
    .order("start_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as TripDateOptionRow[];
}

export async function createDateOption(params: {
  tripId: string;
  startDate: string;
  endDate: string;
  label?: string;
}): Promise<TripDateOptionRow> {
  const { tripId, startDate, endDate, label } = params;

  const { data, error } = await supabase
    .from("trip_date_options")
    .insert({
      trip_id: tripId,
      start_date: startDate,
      end_date: endDate,
      label: label?.trim() ? label.trim() : null,
    })
    .select("id, trip_id, start_date, end_date, label, created_at")
    .single();

  if (error) throw error;
  return data as TripDateOptionRow;
}

export async function deleteDateOption(id: string): Promise<void> {
  const { error } = await supabase.from("trip_date_options").delete().eq("id", id);
  if (error) throw error;
}
