import { create } from "zustand";
import type { AuthSessionData, AuthUser } from "@nexora/shared";

// "pending" until the startup refresh (§4.5) has answered.
export type AuthStatus = "pending" | "authenticated" | "anonymous";

interface AuthState {
  status: AuthStatus;
  accessToken: string | null; // memory only, never localStorage (AU-4)
  user: AuthUser | null;
  setSession: (session: AuthSessionData) => void;
  setUser: (user: AuthUser) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: "pending",
  accessToken: null,
  user: null,
  setSession: ({ accessToken, user }) => set({ status: "authenticated", accessToken, user }),
  setUser: (user) => set({ user }),
  clear: () => set({ status: "anonymous", accessToken: null, user: null }),
}));

// For components: the user on routes behind RequireAuth.
export const useCurrentUser = (): AuthUser => {
  const user = useAuthStore((s) => s.user);
  if (!user) throw new Error("useCurrentUser used outside RequireAuth");
  return user;
};
