import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { fetchMyProfile, type ProfileRow } from "./profile";

export function useProfile() {
  const userId = useAuthStore((s) => s.userId);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await fetchMyProfile(userId);

    // PGRST116 = no rows found (expected for new users)
    if (error && (error as any).code !== "PGRST116") {
      console.warn("[useProfile] fetch failed:", error);
      setProfile(null);
    } else {
      setProfile(data ?? null);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, loading, refresh };
}
