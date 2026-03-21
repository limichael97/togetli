// lib/profile.ts
import { supabase } from "../supabaseClient";

export type ProfileRow = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  timezone: string | null;
  home_airport: string | null;
  created_at?: string;
};

export async function fetchMyProfile(userId: string) {
  return supabase
    .from("profiles")
    .select("id, full_name, display_name, timezone, home_airport")
    .eq("id", userId)
    .maybeSingle();
}

export async function upsertMyProfile(userId: string, patch: Partial<ProfileRow>) {
  return supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        ...patch,
      },
      { onConflict: "id" }
    )
    .select("id, full_name, display_name, timezone, home_airport")
    .single();
}
