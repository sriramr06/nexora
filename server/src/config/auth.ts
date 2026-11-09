// Fixed security settings from the authentication design (AU-2, AU-7, AU-8, AU-9).
// Kept in code, not env, so they cannot be weakened by configuration.
export const authConfig = {
  accessTokenTtl: "15m",
  refreshTokenTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days of inactivity
  refreshFamilyTtlMs: 30 * 24 * 60 * 60 * 1000, // 30 days absolute
  refreshReuseGraceMs: 10 * 1000, // multi-tab grace period
  bcryptCost: 12,
} as const;
