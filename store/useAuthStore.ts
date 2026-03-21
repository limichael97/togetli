// store/useAuthStore.ts
import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import type { StateCreator } from "zustand";
import { getCurrentSession, onAuthStateChange } from "../lib/session";

type AuthState = {
  session: Session | null;
  user: User | null;
  userId: string | null;
  loading: boolean;
  init: () => Promise<() => void>;
};

const authStoreCreator: StateCreator<AuthState> = (set) => ({
  session: null,
  user: null,
  userId: null,
  loading: true,

  init: async () => {
    try {
      set({ loading: true });

      const session = await getCurrentSession();
      set({
        session,
        user: session?.user ?? null,
        userId: session?.user?.id ?? null,
        loading: false,
      });

      const unsub = onAuthStateChange((next) => {
        set({
          session: next,
          user: next?.user ?? null,
          userId: next?.user?.id ?? null,
          loading: false,
        });
      });

      return unsub;
    } catch (e) {
      console.log("[AuthStore] init failed", e);
      set({ session: null, user: null, userId: null, loading: false });
      return () => {};
    }
  },
});

export const useAuthStore = create<AuthState>(authStoreCreator);
