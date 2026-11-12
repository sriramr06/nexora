import axios, { type InternalAxiosRequestConfig } from "axios";
import { API_PREFIX, type AuthSessionData } from "@nexora/shared";
import { useAuthStore } from "./auth-store";
import { ApiError, toApiError } from "./api-error";
import { queryClient } from "./query-client";

// Same-origin API through the Vite / Vercel proxy (AU-12), so the refresh cookie is first-party.
export const api = axios.create({ baseURL: API_PREFIX });

// Separate instance without interceptors, so refreshing can never trigger another refresh.
export const refreshClient = axios.create({ baseURL: API_PREFIX });

const GRACE_RETRY_DELAY_MS = 300;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const requestRefresh = async (): Promise<AuthSessionData> => {
  const res = await refreshClient.post<{ data: AuthSessionData }>("/auth/refresh");
  return res.data.data;
};

let inFlight: Promise<AuthSessionData> | null = null;

// Single-flight (§4.4 client rule): parallel callers share one refresh request.
export const refreshSession = (): Promise<AuthSessionData> => {
  inFlight ??= (async () => {
    try {
      let session: AuthSessionData;
      try {
        session = await requestRefresh();
      } catch (error) {
        // Another tab may have rotated the cookie a moment ago (10 s grace period):
        // the browser now holds the new cookie, so one retry succeeds.
        if (toApiError(error).status !== 401) throw error;
        await wait(GRACE_RETRY_DELAY_MS);
        session = await requestRefresh();
      }
      useAuthStore.getState().setSession(session);
      return session;
    } catch (error) {
      throw toApiError(error);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
};

// Ends the local session; RequireAuth then redirects to /login.
export const clearSession = (): void => {
  useAuthStore.getState().clear();
  queryClient.clear(); // never show the previous user's cached data
};

// Startup (§4.5): restore the session from the refresh cookie, if any.
export const restoreSession = async (): Promise<void> => {
  try {
    await refreshSession();
  } catch {
    clearSession();
  }
};

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(undefined, async (error: unknown) => {
  const apiError = toApiError(error);
  const config = axios.isAxiosError(error) ? (error.config as RetriableConfig) : undefined;
  const hadToken = Boolean(config?.headers?.Authorization);

  if (apiError.code === "TOKEN_EXPIRED" && config && !config._retried) {
    config._retried = true;
    try {
      await refreshSession();
    } catch {
      clearSession();
      throw apiError;
    }
    return api(config); // the request interceptor attaches the new token
  }

  // Our token was rejected for another reason (e.g. password changed elsewhere).
  if (apiError.status === 401 && hadToken) clearSession();

  throw apiError;
});

export { ApiError };
