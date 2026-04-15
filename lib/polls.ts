// lib/polls.ts
import { supabase } from "../supabaseClient";
import type { TripBudgetOptionRow, TripDateOptionRow, TripMemberRow, TripRow } from "./trips";

export type TripBudgetOptionInput = {
  type: "flight" | "lodging";
  label: string;
  is_any?: boolean;
};

export type TripDateOptionInput = {
  start_date: string;
  end_date: string;
  label?: string | null;
};

export async function getTripSetupData(tripId: string): Promise<{
  trip: TripRow;
  members: TripMemberRow[];
  dateOptions: TripDateOptionRow[];
  budgetOptions: TripBudgetOptionRow[];
}> {
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select(
      "id, created_by, creator_id, type, title, trip_length_days, mode, final_start_date, final_end_date, poll_sent_at, status, created_at"
    )
    .eq("id", tripId)
    .single();
  if (tripError) throw tripError;

  const { data: members, error: memError } = await supabase
    .from("trip_members")
    .select("user_id, role, is_active, created_at")
    .eq("trip_id", tripId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (memError) throw memError;

  const { data: dateOptions, error: dateError } = await supabase
    .from("trip_date_options")
    .select("id, trip_id, start_date, end_date, label, created_at")
    .eq("trip_id", tripId)
    .order("start_date", { ascending: true });
  if (dateError) throw dateError;

  const { data: budgetOptions, error: budgetError } = await supabase
    .from("trip_budget_options")
    .select("id, trip_id, type, label, is_any, created_at")
    .eq("trip_id", tripId)
    .order("type", { ascending: true });
  if (budgetError) throw budgetError;

  return {
    trip: trip as TripRow,
    members: (members ?? []) as TripMemberRow[],
    dateOptions: (dateOptions ?? []) as TripDateOptionRow[],
    budgetOptions: (budgetOptions ?? []) as TripBudgetOptionRow[],
  };
}

export async function saveTripLength(tripId: string, lengthDays: number) {
  const { error } = await supabase
    .from("trips")
    .update({ trip_length_days: lengthDays })
    .eq("id", tripId);
  if (error) throw error;
}

export async function upsertTripDateOptions(
  tripId: string,
  options: TripDateOptionInput[]
) {
  const { error: deleteError } = await supabase
    .from("trip_date_options")
    .delete()
    .eq("trip_id", tripId);
  if (deleteError) throw deleteError;

  if (options.length === 0) return;

  const { error: insertError } = await supabase
    .from("trip_date_options")
    .insert(
      options.map((o) => ({
        trip_id: tripId,
        start_date: o.start_date,
        end_date: o.end_date,
        label: o.label?.trim() ? o.label.trim() : null,
      }))
    );
  if (insertError) throw insertError;
}

export async function upsertTripBudgetOptions(
  tripId: string,
  options: TripBudgetOptionInput[]
) {
  const { error: deleteError } = await supabase
    .from("trip_budget_options")
    .delete()
    .eq("trip_id", tripId);
  if (deleteError) throw deleteError;

  if (options.length === 0) return;

  const { error: insertError } = await supabase
    .from("trip_budget_options")
    .insert(
      options.map((o) => ({
        trip_id: tripId,
        type: o.type,
        label: o.label,
        is_any: o.is_any ?? false,
      }))
    );
  if (insertError) throw insertError;
}

export async function markPollSent(tripId: string) {
  const { error } = await supabase
    .from("trips")
    .update({
      mode: "poll",
      status: "polling",
      poll_sent_at: new Date().toISOString(),
    })
    .eq("id", tripId);
  if (error) throw error;
}

export async function markTripPlanned(params: {
  tripId: string;
  finalStartDate?: string | null;
  finalEndDate?: string | null;
}) {
  const hasFinalDates = !!params.finalStartDate && !!params.finalEndDate;
  const { error } = await supabase
    .from("trips")
    .update({
      mode: "planned",
      status: hasFinalDates ? "finalized" : "draft",
      final_start_date: params.finalStartDate ?? null,
      final_end_date: params.finalEndDate ?? null,
      poll_sent_at: null,
    })
    .eq("id", params.tripId);

  if (error) throw error;
}

export async function upsertPollResponse(params: {
  tripId: string;
  userId: string;
  availableDateOptionIds: string[];
  flightBudgetLabel?: string | null;
  lodgingBudgetLabel?: string | null;
  notes?: string | null;
  customPollAnswers?: Record<string, unknown>;
}) {
  const {
    tripId,
    userId,
    availableDateOptionIds,
    flightBudgetLabel = null,
    lodgingBudgetLabel = null,
    notes = null,
    customPollAnswers = {},
  } = params;

  const payload = {
    trip_id: tripId,
    user_id: userId,
    available_date_option_ids: availableDateOptionIds,
    flight_budget_label: flightBudgetLabel,
    lodging_budget_label: lodgingBudgetLabel,
    notes,
    custom_poll_answers: customPollAnswers,
  };

  console.log("[polls] upsertPollResponse payload", payload);

  const { error } = await supabase
    .from("poll_responses")
    .upsert(payload, { onConflict: "trip_id,user_id" });

  if (error) throw error;
}
export async function checkIfUserResponded(tripId: string, userId: string) {
  const { data, error } = await supabase
    .from("poll_responses")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function listPollResponderUserIds(tripId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("poll_responses")
    .select("user_id")
    .eq("trip_id", tripId);

  if (error) throw error;

  return Array.from(
    new Set((data ?? []).map((row) => row.user_id).filter(Boolean))
  ) as string[];
}

export type PollResponseRow = {
  available_date_option_ids: string[] | null;
  flight_budget_label: string | null;
  lodging_budget_label: string | null;
};

export async function listPollResponses(tripId: string): Promise<PollResponseRow[]> {
  const { data, error } = await supabase
    .from("poll_responses")
    .select("available_date_option_ids, flight_budget_label, lodging_budget_label")
    .eq("trip_id", tripId);
  if (error) throw error;
  return (data ?? []) as PollResponseRow[];
}
