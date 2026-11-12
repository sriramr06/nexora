import { useMutation } from "@tanstack/react-query";
import type {
  AuthSessionData,
  AuthUser,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "@nexora/shared";
import { api, clearSession } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

interface Envelope<T> {
  data: T;
}

// Thin wrappers over /api/v1/auth (API design §8.1).
export const authApi = {
  register: async (input: RegisterInput) =>
    (await api.post<Envelope<{ user: AuthUser }>>("/auth/register", input)).data.data.user,
  login: async (input: LoginInput) =>
    (await api.post<Envelope<AuthSessionData>>("/auth/login", input)).data.data,
  logout: async () => {
    await api.post("/auth/logout");
  },
  verifyEmail: async (token: string) => {
    await api.post("/auth/verify-email", { token });
  },
  resendVerification: async () => {
    await api.post("/auth/resend-verification");
  },
  forgotPassword: async (email: string) => {
    await api.post("/auth/forgot-password", { email });
  },
  resetPassword: async (input: ResetPasswordInput) => {
    await api.post("/auth/reset-password", input);
  },
  changePassword: async (input: ChangePasswordInput) =>
    (await api.post<Envelope<AuthSessionData>>("/auth/change-password", input)).data.data,
};

// Mutations that change the session also update the auth store.

export const useLogin = () =>
  useMutation({
    mutationFn: authApi.login,
    onSuccess: (session) => useAuthStore.getState().setSession(session),
  });

export const useLogout = () =>
  useMutation({
    mutationFn: authApi.logout,
    // Log out locally even if the request fails; the cookie expires on its own.
    onSettled: clearSession,
  });

export const useChangePassword = () =>
  useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: (session) => useAuthStore.getState().setSession(session),
  });

export const useResendVerification = () => useMutation({ mutationFn: authApi.resendVerification });
