import type { CookieOptions, Request, Response } from "express";
import { API_PREFIX } from "@nexora/shared";
import { isProduction } from "../../config/env";

// Refresh token cookie (AU-3): httpOnly, Secure (production), SameSite=Lax,
// and only sent to /api/v1/auth so no other route ever receives it.
export const REFRESH_COOKIE = "nexora_refresh";

const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: `${API_PREFIX}/auth`,
};

export const setRefreshCookie = (res: Response, token: string, expiresAt: Date): void => {
  res.cookie(REFRESH_COOKIE, token, { ...baseOptions, expires: expiresAt });
};

export const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE, baseOptions);
};

export const readRefreshCookie = (req: Request): string | undefined => {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};
