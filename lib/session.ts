// lib/session.ts
import { supabase } from "../supabaseClient";
import type { Session } from "@supabase/supabase-js";

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session ?? null;
}

export function onAuthStateChange(
  cb: (session: Session | null) => void
) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session);
  });

  return () => data.subscription.unsubscribe();
}
