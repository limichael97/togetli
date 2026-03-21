// lib/members.ts
import { supabase } from "../supabaseClient";
import type { TripRole, TripMemberRow } from "./trips";

export async function listTripMembers(tripId: string) {
  const { data, error } = await supabase
    .from("trip_members")
    .select("user_id, role, is_active, created_at")
    .eq("trip_id", tripId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as TripMemberRow[];
}

export async function updateTripMemberRole(params: {
  tripId: string;
  userId: string;
  role: TripRole;
}) {
  const { tripId, userId, role } = params;

  const { error } = await supabase
    .from("trip_members")
    .update({ role })
    .eq("trip_id", tripId)
    .eq("user_id", userId);

  if (error) throw error;
}
