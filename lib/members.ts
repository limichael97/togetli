// lib/members.ts
import { supabase } from "../supabaseClient";
import { normalizeTripMemberRows } from "./trips";
import type { TripRole, TripMemberRow } from "./trips";

export async function listTripMembers(tripId: string) {
  const { data, error } = await supabase
    .from("trip_members")
    .select(
      "user_id, role, is_active, created_at, profiles:profiles!trip_members_user_id_fkey(id, full_name, display_name, avatar_url)"
    )
    .eq("trip_id", tripId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return normalizeTripMemberRows(data);
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

export async function leaveTrip(params: {
  tripId: string;
  userId: string;
}): Promise<void> {
  const { tripId, userId } = params;
  const { data, error } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (error) throw error;
  if (data?.role === "creator") {
    throw new Error("Creators cannot leave their own trip.");
  }

  const { error: updateError } = await supabase
    .from("trip_members")
    .update({ is_active: false })
    .eq("trip_id", tripId)
    .eq("user_id", userId);

  if (updateError) throw updateError;
}



export async function removeTripMember(params: {
  tripId: string;
  actorUserId: string;
  targetUserId: string;
}): Promise<void> {
  const { tripId, actorUserId, targetUserId } = params;
  if (actorUserId === targetUserId) {
    throw new Error("Creators cannot remove themselves.");
  }

  const { data: actor, error: actorError } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", actorUserId)
    .eq("is_active", true)
    .single();
  if (actorError) throw actorError;
  if (actor?.role !== "creator") {
    throw new Error("Only creators can remove members.");
  }

  const { data: target, error: targetError } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", targetUserId)
    .eq("is_active", true)
    .single();
  if (targetError) throw targetError;
  if (target?.role === "creator") {
    throw new Error("Creators cannot be removed.");
  }

  const { error: updateError } = await supabase
    .from("trip_members")
    .update({ is_active: false })
    .eq("trip_id", tripId)
    .eq("user_id", targetUserId);

  if (updateError) throw updateError;
}
