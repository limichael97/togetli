// lib/trips.ts
import { supabase } from "../supabaseClient";
import type { Database } from "../types/database.types";
import type { CustomPollQuestion } from "../utils/polls";

export type TripType = Database["public"]["Enums"]["trip_type"];

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  bachelor: "Bachelor",
  bachelorette: "Bachelorette",
  joint: "Joint Bachelor/ette",
  group: "Group Trip",
};

export const TRIP_TYPE_OPTIONS: ReadonlyArray<{
  value: TripType;
  label: string;
}> = [
  { value: "bachelor", label: TRIP_TYPE_LABELS.bachelor },
  { value: "bachelorette", label: TRIP_TYPE_LABELS.bachelorette },
  { value: "joint", label: TRIP_TYPE_LABELS.joint },
  { value: "group", label: TRIP_TYPE_LABELS.group },
] as const;

export function getTripTypeLabel(type: TripType) {
  return TRIP_TYPE_LABELS[type];
}

export type PlanningMode = "planner_decides" | "group_vote" | "creator_decides";

export type TripRole = "creator" | "planner" | "guest";
export type TripMode = "poll" | "planned";
export type TripLifecycleStatus = Database["public"]["Tables"]["trips"]["Row"]["status"];
export interface DateOptionInput {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  label?: string;
}

export interface CreateTripInput {
  type: TripType;
  mode?: TripMode;
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
    mode = "poll",
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
      mode,
      planning_mode: planningMode,
      hide_from_creator: hideFromCreator,
      notes: notes ?? null,
      custom_poll_questions: customQuestions,
    })
    .select(
      "id, created_by, creator_id, type, title, trip_length_days, mode, final_start_date, final_end_date, poll_sent_at, status, created_at"
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
  mode: TripMode | string;
  final_start_date: string | null;
  final_end_date: string | null;
  poll_sent_at: string | null;
  status: TripLifecycleStatus | string;
  custom_poll_questions?: Database["public"]["Tables"]["trips"]["Row"]["custom_poll_questions"];
  current_user_role?: TripRole;
  created_at: string;
};

export async function listTripsByOwner(userId: string) {
  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, created_by, creator_id, type, title, trip_length_days, mode, final_start_date, final_end_date, poll_sent_at, status, created_at"
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
      "id, created_by, creator_id, type, title, trip_length_days, mode, final_start_date, final_end_date, poll_sent_at, status, created_at"
    )

    .eq("id", tripId)
    .single();

  if (error) throw error;
  return data as TripRow;
}

export async function updateTripTitle(params: {
  tripId: string;
  title: string;
}) {
  const { data, error } = await supabase
    .from("trips")
    .update({ title: params.title })
    .eq("id", params.tripId)
    .select(
      "id, created_by, creator_id, type, title, trip_length_days, mode, final_start_date, final_end_date, poll_sent_at, status, created_at"
    )
    .single();

  if (error) throw error;
  return data as TripRow;
}

export async function updateTripType(params: {
  tripId: string;
  type: TripType;
}) {
  const { data, error } = await supabase
    .from("trips")
    .update({ type: params.type })
    .eq("id", params.tripId)
    .select(
      "id, created_by, creator_id, type, title, trip_length_days, mode, final_start_date, final_end_date, poll_sent_at, status, created_at"
    )
    .single();

  if (error) throw error;
  return data as TripRow;
}

export async function deleteTrip(tripId: string) {
  const { error } = await supabase.from("trips").delete().eq("id", tripId);
  if (error) throw error;
}

export type TripMemberRow = {
  user_id: string;
  role: TripRole;
  is_active: boolean;
  created_at: string;
  invited_email?: string | null;
  invited_name?: string | null;
  profiles?: {
    id: string;
    full_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    email?: string | null;
  } | null;
};

type RawTripMemberRow = {
  user_id: string;
  role: TripRole;
  is_active: boolean;
  created_at: string;
  invited_email?: string | null;
  invited_name?: string | null;
};

export function normalizeTripMemberRows(rows: RawTripMemberRow[] | null | undefined): TripMemberRow[] {
  return (rows ?? []).map((row) => {
    return {
      user_id: row.user_id,
      role: row.role,
      is_active: row.is_active,
      created_at: row.created_at,
      invited_email: row.invited_email ?? null,
      invited_name: row.invited_name ?? null,
      profiles: null,
    };
  });
}

async function attachTripMemberProfiles(
  members: TripMemberRow[]
): Promise<TripMemberRow[]> {
  const userIds = Array.from(
    new Set(members.map((member) => member.user_id).filter(Boolean))
  );

  if (userIds.length === 0) return members;

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, avatar_url")
    .in("id", userIds);

  if (profileError) throw profileError;

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile])
  );

  return members.map((member) => ({
    ...member,
    profiles: profileById.get(member.user_id) ?? null,
  }));
}

export function getTripMemberDisplayName(member: TripMemberRow): string {
  const fullName = member.profiles?.full_name?.trim();
  if (fullName) return fullName;

  const displayName = member.profiles?.display_name?.trim();
  if (displayName) return displayName;

  const invitedName = member.invited_name?.trim();
  if (invitedName) return invitedName;

  const email =
   member.invited_email?.trim() || null;
  const emailLocalPart = email?.split("@")[0]?.trim();
  if (emailLocalPart) return emailLocalPart;

  const readableFallback =
    member.role === "creator"
      ? "Trip creator"
      : member.role === "planner"
        ? "Trip planner"
        : "Trip member";

  return `${readableFallback} (${member.user_id.slice(0, 6)})`;
}

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
      "id, created_by, creator_id, type, title, trip_length_days, mode, final_start_date, final_end_date, poll_sent_at, status, created_at"
    )

    .eq("id", tripId)
    .single();

  if (tripError) throw tripError;

  // 2) Members
  const { data: members, error: memError } = await supabase
    .from("trip_members")
    .select(
      "user_id, role, is_active, created_at, invited_email, invited_name"
    )
    .eq("trip_id", tripId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (memError) throw memError;
  const normalizedMembers = normalizeTripMemberRows(
    members as RawTripMemberRow[] | null | undefined
  );
  const membersWithProfiles = await attachTripMemberProfiles(normalizedMembers);

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
    members: membersWithProfiles,
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
        mode,
        final_start_date,
        final_end_date,
        poll_sent_at,
        status,
        custom_poll_questions,
        created_at
      )
    `
    )
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) throw error;

  // unwrap join shape
  const trips = (data ?? [])
    .map((row: any) =>
      row.trips ? { ...row.trips, current_user_role: row.role } : null
    )
    .filter(Boolean);

  // sort client-side (simpler + avoids foreignTable/order typing issues)
  trips.sort((a: any, b: any) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? "")
  );

  return trips as TripRow[];
}
