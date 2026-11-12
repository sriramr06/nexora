import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from "axios";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthSessionData } from "@nexora/shared";
import { api, refreshClient, refreshSession, restoreSession } from "./api";
import { useAuthStore } from "./auth-store";

const user: AuthSessionData["user"] = {
  id: "u1",
  name: "Priya",
  email: "priya@acme.com",
  emailVerified: true,
  createdAt: "",
  updatedAt: "",
};

const reply = (config: InternalAxiosRequestConfig, status: number, data: unknown) => {
  const response = { status, data, statusText: "", headers: {}, config };
  if (status < 400) return Promise.resolve(response);
  return Promise.reject(
    new AxiosError("failed", undefined, config, undefined, {
      ...response,
      headers: new AxiosHeaders(),
    }),
  );
};

const expired = { error: { code: "TOKEN_EXPIRED", message: "Access token expired." } };
const unauthenticated = { error: { code: "UNAUTHENTICATED", message: "Session expired." } };

let refreshCalls: number;
let refreshResponses: Array<() => [number, unknown]>;

// Fake API: /projects accepts only "fresh-token"; /auth/refresh plays the queued responses.
const apiAdapter: AxiosAdapter = (config) => {
  const ok = config.headers.Authorization === "Bearer fresh-token";
  return ok ? reply(config, 200, { data: "projects" }) : reply(config, 401, expired);
};
const refreshAdapter: AxiosAdapter = (config) => {
  refreshCalls++;
  const next = refreshResponses.shift() ?? (() => [401, unauthenticated] as [number, unknown]);
  const [status, body] = next();
  return reply(config, status, body);
};

const session = (): [number, unknown] => [200, { data: { accessToken: "fresh-token", user } }];

beforeEach(() => {
  api.defaults.adapter = apiAdapter;
  refreshClient.defaults.adapter = refreshAdapter;
  refreshCalls = 0;
  refreshResponses = [];
  useAuthStore.setState({ status: "authenticated", accessToken: "old-token", user });
});

describe("api client", () => {
  it("refreshes once for parallel expired requests, then retries them all", async () => {
    refreshResponses = [session];

    const results = await Promise.all([api.get("/a"), api.get("/b"), api.get("/c")]);

    expect(refreshCalls).toBe(1);
    expect(results.map((r) => r.data.data)).toEqual(["projects", "projects", "projects"]);
    expect(useAuthStore.getState().accessToken).toBe("fresh-token");
  });

  it("retries a refresh once after a 401 (another tab rotated the cookie)", async () => {
    refreshResponses = [() => [401, unauthenticated], session];

    await expect(refreshSession()).resolves.toMatchObject({ accessToken: "fresh-token" });
    expect(refreshCalls).toBe(2);
  });

  it("clears the session when refresh fails, and rejects with the API error", async () => {
    const promise = api.get("/a");

    await expect(promise).rejects.toMatchObject({ status: 401, code: "TOKEN_EXPIRED" });
    expect(useAuthStore.getState()).toMatchObject({ status: "anonymous", accessToken: null });
  });

  it("restoreSession: no valid cookie → anonymous", async () => {
    useAuthStore.setState({ status: "pending", accessToken: null, user: null });

    await restoreSession();

    expect(useAuthStore.getState().status).toBe("anonymous");
  });

  it("normalizes network errors", async () => {
    api.defaults.adapter = (config) =>
      Promise.reject(new AxiosError("Network Error", "ERR_NETWORK", config));

    await expect(api.get("/a")).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" });
  });
});
