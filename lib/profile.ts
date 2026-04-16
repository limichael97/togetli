// lib/profile.ts
import { supabase } from "../supabaseClient";

export type ProfileRow = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  username: string | null;
  onboarding_completed: boolean | null;
  timezone: string | null;
  home_airport: string | null;
  created_at?: string;
};

export async function fetchMyProfile(userId: string) {
  return supabase
    .from("profiles")
    .select("id, full_name, display_name, username, onboarding_completed, timezone, home_airport")
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
    .select("id, full_name, display_name, username, onboarding_completed, timezone, home_airport")
    .single();
}

function getEmailLocalPart(email: string | null | undefined) {
  return email?.trim().toLowerCase().split("@")[0]?.trim() ?? null;
}

function normalizeUsernameBase(value: string | null | undefined) {
  const firstToken = value?.trim().split(/\s+/)[0] ?? "";
  const normalized = firstToken.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized.slice(0, 16) || "traveler";
}

function isUniqueConstraintError(error: unknown) {
  const code = (error as { code?: string } | null)?.code ?? "";
  const message = (error as { message?: string } | null)?.message ?? "";
  return code === "23505" || message.toLowerCase().includes("duplicate key");
}

async function ensureUsername(
  userId: string,
  profile: ProfileRow | null,
  email: string | null | undefined,
  fullName: string | null | undefined,
  displayName: string | null | undefined
) {
  const existingUsername = profile?.username?.trim().toLowerCase();
  if (existingUsername) return existingUsername;

  const usernameBase = normalizeUsernameBase(
    displayName ||
      fullName ||
      profile?.display_name ||
      profile?.full_name ||
      getEmailLocalPart(email)
  );

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = Math.floor(1000 + Math.random() * 9000).toString();
    const candidate = `${usernameBase}${suffix}`;
    const { data, error } = await upsertMyProfile(userId, {
      username: candidate,
    });

    if (!error) return data.username ?? candidate;
    if (!isUniqueConstraintError(error)) throw error;
  }

  throw new Error("Could not generate a unique username.");
}

export async function ensureProfileIdentity(
  userId: string,
  email: string | null | undefined,
  options?: {
    fullName?: string | null | undefined;
    displayName?: string | null | undefined;
  }
) {
  const { data: profile, error: profileError } = await fetchMyProfile(userId);
  if (profileError && (profileError as any).code !== "PGRST116") {
    throw profileError;
  }

  const fullName =
    profile?.full_name?.trim() || options?.fullName?.trim() || null;
  const displayName =
    profile?.display_name?.trim() ||
    options?.displayName?.trim() ||
    fullName?.split(/\s+/)[0] ||
    getEmailLocalPart(email);

  const patch: Partial<ProfileRow> = {};
  if (!profile?.full_name?.trim() && fullName) {
    patch.full_name = fullName;
  }
  if (!profile?.display_name?.trim() && displayName) {
    patch.display_name = displayName;
  }

  let nextProfile = profile;
  if (!profile || Object.keys(patch).length > 0) {
    const { data, error } = await upsertMyProfile(userId, patch);
    if (error) throw error;
    nextProfile = data;
  }

  await ensureUsername(
    userId,
    nextProfile ?? null,
    email,
    fullName,
    displayName
  );
}
