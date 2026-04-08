// lib/invites.ts
import * as Linking from "expo-linking";
import { supabase } from "../supabaseClient";

export type TripRole = "creator" | "planner" | "guest";

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

export async function countPendingTripInvites(tripId: string): Promise<number> {
  const { data, error } = await supabase
    .from("trip_invites")
    .select("id, expires_at, max_uses, uses")
    .eq("trip_id", tripId);

  if (error) throw error;

  const now = Date.now();
  return (data ?? []).filter((invite) => {
    const notExpired =
      !invite.expires_at || new Date(invite.expires_at).getTime() > now;
    const hasUsesRemaining = invite.uses < invite.max_uses;
    return notExpired && hasUsesRemaining;
  }).length;
}

export function buildTripInviteLink(token: string): string {
  return Linking.createURL("invite", { queryParams: { token } });
}

export async function acceptTripInvite(token: string): Promise<void> {
  let { error } = await supabase.rpc("accept_trip_invite", { token });
  if (error) {
    const msg = error.message ?? "";
    const shouldRetry =
      error.code === "PGRST202" ||
      msg.includes("No function matches") ||
      msg.includes("accept_trip_invite");

    if (shouldRetry) {
      const retry = await supabase.rpc("accept_trip_invite", { _token: token });
      if (retry.error) throw retry.error;
      return;
    }
    throw error;
  }
}
