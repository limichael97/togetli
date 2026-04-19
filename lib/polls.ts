// lib/polls.ts
import { supabase } from "../supabaseClient";
import type { Database } from "../types/database.types";
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

export type StayPollOption = {
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

export type StayPollDefinition = {
  type: "stay";
  title: string;
  subtitle: string;
  finalized_winner_note_id?: string | null;
  options: StayPollOption[];
};

export type StayPollRankings = {
  first_choice_note_id: string | null;
  second_choice_note_id: string | null;
  third_choice_note_id: string | null;
};

export type TripSetupTripRow = TripRow & {
  custom_poll_questions: Database["public"]["Tables"]["trips"]["Row"]["custom_poll_questions"];
};

export function parseStayPollDefinition(value: unknown): StayPollDefinition | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const raw = value as {
    type?: unknown;
    title?: unknown;
    subtitle?: unknown;
    options?: unknown;
  };

  if (raw.type !== "stay" || !Array.isArray(raw.options)) return null;

  const options = raw.options.flatMap((option): StayPollOption[] => {
    if (!option || typeof option !== "object" || Array.isArray(option)) return [];

    const candidate = option as Record<string, unknown>;
    if (
      typeof candidate.source_note_id !== "string" ||
      typeof candidate.title !== "string"
    ) {
      return [];
    }

    return [
      {
        source_note_id: candidate.source_note_id,
        title: candidate.title,
        link: typeof candidate.link === "string" ? candidate.link : null,
        category: "stay",
        total_price:
          typeof candidate.total_price === "string" ? candidate.total_price : null,
        beds: typeof candidate.beds === "string" ? candidate.beds : null,
        bedrooms:
          typeof candidate.bedrooms === "string" ? candidate.bedrooms : null,
        bathrooms:
          typeof candidate.bathrooms === "string" ? candidate.bathrooms : null,
        location:
          typeof candidate.location === "string" ? candidate.location : null,
        note: typeof candidate.note === "string" ? candidate.note : null,
      },
    ];
  });

  if (options.length === 0) return null;

  return {
    type: "stay",
    title: typeof raw.title === "string" ? raw.title : "Stay Poll",
    subtitle:
      typeof raw.subtitle === "string"
        ? raw.subtitle
        : "Rank your top stay options",
    finalized_winner_note_id:
      typeof (raw as Record<string, unknown>).finalized_winner_note_id === "string"
        ? ((raw as Record<string, unknown>).finalized_winner_note_id as string)
        : null,
    options,
  };
}

export function parseStayPollRankings(value: unknown): StayPollRankings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      first_choice_note_id: null,
      second_choice_note_id: null,
      third_choice_note_id: null,
    };
  }

  const raw = value as {
    stay_rankings?: unknown;
  };

  if (
    !raw.stay_rankings ||
    typeof raw.stay_rankings !== "object" ||
    Array.isArray(raw.stay_rankings)
  ) {
    return {
      first_choice_note_id: null,
      second_choice_note_id: null,
      third_choice_note_id: null,
    };
  }

  const rankings = raw.stay_rankings as Record<string, unknown>;
  return {
    first_choice_note_id:
      typeof rankings.first_choice_note_id === "string"
        ? rankings.first_choice_note_id
        : null,
    second_choice_note_id:
      typeof rankings.second_choice_note_id === "string"
        ? rankings.second_choice_note_id
        : null,
    third_choice_note_id:
      typeof rankings.third_choice_note_id === "string"
        ? rankings.third_choice_note_id
        : null,
  };
}

export async function getTripSetupData(tripId: string): Promise<{
  trip: TripSetupTripRow;
  members: TripMemberRow[];
  dateOptions: TripDateOptionRow[];
  budgetOptions: TripBudgetOptionRow[];
}> {
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select(
      "id, created_by, creator_id, type, title, trip_length_days, mode, custom_poll_questions, final_start_date, final_end_date, poll_sent_at, status, created_at"
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
    trip: trip as TripSetupTripRow,
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

export async function saveStayPollDefinition(
  tripId: string,
  options: StayPollOption[]
) {
  const definition: StayPollDefinition = {
    type: "stay",
    title: "Stay Poll",
    subtitle: "Rank your top 3 stay options",
    options: options.map((option) => ({
      source_note_id: option.source_note_id,
      title: option.title,
      link: option.link ?? null,
      category: "stay",
      total_price: option.total_price?.trim() || null,
      beds: option.beds?.trim() || null,
      bedrooms: option.bedrooms?.trim() || null,
      bathrooms: option.bathrooms?.trim() || null,
      location: option.location?.trim() || null,
      note: option.note?.trim() || null,
    })),
  };

  const { error } = await supabase
    .from("trips")
    .update({ custom_poll_questions: definition })
    .eq("id", tripId);

  if (error) throw error;
}

export async function finalizeStayPollWinner(params: {
  tripId: string;
  winnerNoteId: string;
}) {
  const { data, error: fetchError } = await supabase
    .from("trips")
    .select("custom_poll_questions")
    .eq("id", params.tripId)
    .single();

  if (fetchError) throw fetchError;

  const definition = parseStayPollDefinition(data.custom_poll_questions);
  if (!definition) {
    throw new Error("Stay poll definition not found.");
  }

  const winnerExists = definition.options.some(
    (option) => option.source_note_id === params.winnerNoteId
  );
  if (!winnerExists) {
    throw new Error("Selected winner is not part of this stay poll.");
  }

  const { error } = await supabase
    .from("trips")
    .update({
      custom_poll_questions: {
        ...definition,
        finalized_winner_note_id: params.winnerNoteId,
      },
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

export type PollResponseDetailRow = {
  user_id?: string;
  trip_id?: string;
  available_date_option_ids: string[] | null;
  flight_budget_label: string | null;
  lodging_budget_label: string | null;
  custom_poll_answers: Database["public"]["Tables"]["poll_responses"]["Row"]["custom_poll_answers"];
};

export function hasAvailabilityPollResponse(
  response:
    | Pick<
        PollResponseDetailRow,
        "available_date_option_ids" | "flight_budget_label" | "lodging_budget_label"
      >
    | null
    | undefined
) {
  return (
    !!response &&
    (
      (response.available_date_option_ids?.length ?? 0) > 0 ||
      !!response.flight_budget_label ||
      !!response.lodging_budget_label
    )
  );
}

export function hasStayPollResponse(
  response: Pick<PollResponseDetailRow, "custom_poll_answers"> | null | undefined
) {
  if (!response) return false;
  const rankings = parseStayPollRankings(response.custom_poll_answers);
  return !!rankings.first_choice_note_id;
}

export async function getMyPollResponse(
  tripId: string,
  userId: string
): Promise<PollResponseDetailRow | null> {
  const { data, error } = await supabase
    .from("poll_responses")
    .select(
      "available_date_option_ids, flight_budget_label, lodging_budget_label, custom_poll_answers"
    )
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as PollResponseDetailRow | null;
}

export async function listPollResponseDetails(
  tripId: string
): Promise<PollResponseDetailRow[]> {
  const { data, error } = await supabase
    .from("poll_responses")
    .select(
      "user_id, available_date_option_ids, flight_budget_label, lodging_budget_label, custom_poll_answers"
    )
    .eq("trip_id", tripId);

  if (error) throw error;
  return (data ?? []) as PollResponseDetailRow[];
}

export type TripPollResponseDetailRow = PollResponseDetailRow & {
  trip_id: string;
  user_id: string;
};

export async function listPollResponseDetailsForTrips(
  tripIds: string[]
): Promise<TripPollResponseDetailRow[]> {
  if (tripIds.length === 0) return [];

  const { data, error } = await supabase
    .from("poll_responses")
    .select(
      "trip_id, user_id, available_date_option_ids, flight_budget_label, lodging_budget_label, custom_poll_answers"
    )
    .in("trip_id", tripIds);

  if (error) throw error;
  return (data ?? []) as TripPollResponseDetailRow[];
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
