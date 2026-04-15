// lib/invites.ts
import * as Linking from "expo-linking";
import { supabase } from "../supabaseClient";

export type TripRole = "creator" | "planner" | "guest";
export type PendingTripInvite = {
  id: string;
  role: Exclude<TripRole, "creator">;
  created_at: string;
};
export type ActiveTripInvite = PendingTripInvite & {
  token: string;
};

function isInviteActive(invite: {
  expires_at: string | null;
  max_uses: number;
  uses: number;
}) {
  const notExpired =
    !invite.expires_at || new Date(invite.expires_at).getTime() > Date.now();
  const hasUsesRemaining = invite.uses < invite.max_uses;
  return notExpired && hasUsesRemaining;
}

function generateToken(byteLength = 16) {
  const bytes = new Uint8Array(byteLength);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createTripInvite(
  tripId: string,
  role: Exclude<TripRole, "creator"> = "guest"
): Promise<{ token: string }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Must be signed in to create an invite.");

  const token = generateToken();
  const { data, error } = await supabase
    .from("trip_invites")
    .insert({
      trip_id: tripId,
      token,
      created_by: user.id,
      role,
    })
    .select("token")
    .single();

  if (error) throw error;
  return { token: data?.token ?? token };
}

export async function getActiveTripInvite(
  tripId: string,
  role: Exclude<TripRole, "creator"> = "guest"
): Promise<ActiveTripInvite | null> {
  const { data, error } = await supabase
    .from("trip_invites")
    .select("id, token, role, created_at, expires_at, max_uses, uses")
    .eq("trip_id", tripId)
    .eq("role", role)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const activeInvite = (data ?? []).find(isInviteActive);

  if (!activeInvite) return null;

  return {
    id: activeInvite.id,
    token: activeInvite.token,
    role: activeInvite.role as Exclude<TripRole, "creator">,
    created_at: activeInvite.created_at,
  };
}

export async function getOrCreateTripInvite(
  tripId: string,
  role: Exclude<TripRole, "creator"> = "guest"
): Promise<ActiveTripInvite> {
  const existingInvite = await getActiveTripInvite(tripId, role);
  if (existingInvite) return existingInvite;

  const { token } = await createTripInvite(tripId, role);
  const createdInvite = await getActiveTripInvite(tripId, role);

  if (createdInvite) return createdInvite;

  return {
    id: token,
    token,
    role,
    created_at: new Date().toISOString(),
  };
}

export async function countPendingTripInvites(tripId: string): Promise<number> {
  const { data, error } = await supabase
    .from("trip_invites")
    .select("id, role, expires_at, max_uses, uses, created_at")
    .eq("trip_id", tripId);

  if (error) throw error;

  const activeRoles = new Set(
    (data ?? [])
      .filter(isInviteActive)
      .map((invite) => invite.role)
  );
  return activeRoles.size;
}

export async function listPendingTripInvites(
  tripId: string
): Promise<PendingTripInvite[]> {
  const { data, error } = await supabase
    .from("trip_invites")
    .select("id, role, created_at, expires_at, max_uses, uses")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const invitesByRole = new Map<Exclude<TripRole, "creator">, PendingTripInvite>();

  (data ?? []).filter(isInviteActive).forEach((invite) => {
    const role = invite.role as Exclude<TripRole, "creator">;
    if (!invitesByRole.has(role)) {
      invitesByRole.set(role, {
        id: invite.id,
        role,
        created_at: invite.created_at,
      });
    }
  });

  return Array.from(invitesByRole.values());
}

export function buildTripInviteLink(token: string): string {
  return Linking.createURL("invite", { queryParams: { token } });
}

export async function acceptTripInvite(token: string): Promise<void> {
  let { error } = await supabase.rpc("accept_trip_invite", { _token: token });
  if (error) {
    const msg = error.message ?? "";
    const shouldRetry =
      error.code === "PGRST202" ||
      msg.includes("No function matches") ||
      msg.includes("accept_trip_invite");

    if (shouldRetry) {
      const retry = await supabase.rpc("accept_trip_invite", { token });
      if (retry.error) throw retry.error;
      return;
    }
    throw error;
  }
}
