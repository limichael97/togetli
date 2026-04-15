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

export async function ensureProfileIdentity(
  userId: string,
  email: string | null | undefined
) {
  const normalizedEmail = email?.trim().toLowerCase() ?? null;
  const emailLocalPart = normalizedEmail?.split("@")[0]?.trim() ?? null;

  const { data: profile, error: profileError } = await fetchMyProfile(userId);
  if (profileError && (profileError as any).code !== "PGRST116") {
    throw profileError;
  }

  const hasName =
    !!profile?.full_name?.trim() || !!profile?.display_name?.trim();

  if (hasName) {
    if (!profile) {
      await upsertMyProfile(userId, {});
    }
    return;
  }

  await upsertMyProfile(userId, {
    display_name: emailLocalPart || profile?.display_name || null,
  });
}
