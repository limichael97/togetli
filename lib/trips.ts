// lib/trips.ts
import { supabase } from "../supabaseClient";
import type { CustomPollQuestion } from "../utils/polls";

export type TripType = "bachelor" | "bachelorette" | "joint";

export type PlanningMode = "planner_decides" | "group_vote" | "creator_decides";

export type TripRole = "creator" | "planner" | "guest";
export interface DateOptionInput {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  label?: string;
}

export interface CreateTripInput {
  type: TripType;
  title?: string;
  tripLengthDays: number;
  planningMode: PlanningMode;
  hideFromCreator: boolean;
  notes?: string;

  dateOptions: DateOptionInput[];
  flightBudgetLabels: string[];
  lodgingBudgetLabels: string[];

  customQuestions?: CustomPollQuestion[];
}

export async function createTrip(input: CreateTripInput) {
  // 0) Auth: never trust caller for creatorId
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;

  const creatorId = authData.user?.id;
  if (!creatorId) throw new Error("Not authenticated");

  const {
    type,
    title,
    tripLengthDays,
    planningMode,
    hideFromCreator,
    notes,
    dateOptions,
    flightBudgetLabels,
    lodgingBudgetLabels,
    customQuestions = [],
  } = input;

  const { data } = await supabase.auth.getUser();
  console.log("CREATE TRIP auth.uid =", data.user?.id);

  // ---------- 1) Insert trip ----------
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      created_by: creatorId, // ✅ REQUIRED for your new RLS
      creator_id: creatorId, // ✅ keep for now because column is NOT NULL in your schema
      type,
      title: title ?? null,
      trip_length_days: tripLengthDays,
      planning_mode: planningMode,
      hide_from_creator: hideFromCreator,
      notes: notes ?? null,
      custom_poll_questions: customQuestions,
    })
    .select(
      "id, created_by, creator_id, type, title, trip_length_days, final_start_date, final_end_date, poll_sent_at, created_at"
    )
    .single();
  if (tripError) {
    console.error("createTrip: trips insert failed", tripError);
    throw tripError;
  }

  const tripId: string = trip.id;

  // ---------- 2) Insert date options ----------
  if (dateOptions.length > 0) {
    const { error: dateError } = await supabase
      .from("trip_date_options")
      .insert(
        dateOptions.map((d) => ({
          trip_id: tripId,
          start_date: d.startDate,
          end_date: d.endDate,
          label: d.label ?? null,
        }))
      );

    if (dateError) {
      console.error("createTrip: date options insert failed", dateError);
      throw dateError;
    }
  }

  // ---------- 3) Insert budget options ----------
  const budgetRows: any[] = [];

  for (const label of flightBudgetLabels) {
    budgetRows.push({
      trip_id: tripId,
      type: "flight",
      label,
    });
  }

  for (const label of lodgingBudgetLabels) {
    budgetRows.push({
      trip_id: tripId,
      type: "lodging",
      label,
    });
  }

  if (budgetRows.length > 0) {
    const { error: budgetError } = await supabase
      .from("trip_budget_options")
      .insert(budgetRows);

    if (budgetError) {
      console.error("createTrip: budget options insert failed", budgetError);
      throw budgetError;
    }
  }

  // ---------- 4) DO NOT insert trip_members here ----------
  // Your DB trigger should add the creator as a member automatically.
  // If the trigger isn't installed, you can re-enable this later.

  return trip;
}

export type TripRow = {
  id: string;
  created_by: string | null; // ✅ new source of truth (should be user id)
  creator_id: string; // keep for now
  type: TripType;
  title: string | null;
  trip_length_days: number | null;
  final_start_date: string | null;
  final_end_date: string | null;
  poll_sent_at: string | null;
  created_at: string;
};

export async function listTripsByOwner(userId: string) {
  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, created_by, creator_id, type, title, trip_length_days, final_start_date, final_end_date, poll_sent_at, created_at"
    )
    .eq("created_by", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as TripRow[];
}


export async function getTripById(tripId: string) {
  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, created_by, creator_id, type, title, trip_length_days, final_start_date, final_end_date, poll_sent_at, created_at"
    )

    .eq("id", tripId)
    .single();

  if (error) throw error;
  return data as TripRow;
}

export type TripMemberRow = {
  user_id: string;
  role: TripRole;
  is_active: boolean;
  created_at: string;
  // if you have a profiles join later, we’ll extend this
};

export type TripDateOptionRow = {
  id: string;
  trip_id: string;
  start_date: string;
  end_date: string;
  label: string | null;
  created_at: string;
};

export type TripBudgetOptionRow = {
  id: string;
  trip_id: string;
  type: "flight" | "lodging";
  label: string;
  is_any: boolean;
  created_at: string;
};

export type TripOverview = {
  trip: TripRow;
  members: TripMemberRow[];
  dateOptions: TripDateOptionRow[];
  budgetOptions: TripBudgetOptionRow[];
};

export async function getTripOverview(tripId: string): Promise<TripOverview> {
  // 1) Trip
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select(
      "id, created_by, creator_id, type, title, trip_length_days, final_start_date, final_end_date, poll_sent_at, created_at"
    )

    .eq("id", tripId)
    .single();

  if (tripError) throw tripError;

  // 2) Members
  const { data: members, error: memError } = await supabase
    .from("trip_members")
    .select("user_id, role, is_active, created_at")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  if (memError) throw memError;

  // 3) Date options
  const { data: dateOptions, error: dateError } = await supabase
    .from("trip_date_options")
    .select("id, trip_id, start_date, end_date, label, created_at")
    .eq("trip_id", tripId)
    .order("start_date", { ascending: true });

  if (dateError) throw dateError;

  // 4) Budget options
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

export async function listMyTrips(userId: string) {
  const { data, error } = await supabase
    .from("trip_members")
    .select(
      `
      trip_id,
      trips:trip_id (
        id,
        created_by,
        creator_id,
        type,
        title,
        trip_length_days,
        final_start_date,
        final_end_date,
        poll_sent_at,
        created_at
      )
    `
    )
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) throw error;

  // unwrap join shape
  const trips = (data ?? []).map((row: any) => row.trips).filter(Boolean);

  // sort client-side (simpler + avoids foreignTable/order typing issues)
  trips.sort((a: any, b: any) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? "")
  );

  return trips as TripRow[];
}
