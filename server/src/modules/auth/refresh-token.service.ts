import { randomUUID } from "node:crypto";
import type { ClientSession, Types } from "mongoose";
import { authConfig } from "../../config/auth";
import { generateToken, hashToken } from "../../common/crypto/tokens";
import { RefreshTokenModel } from "./refresh-token.model";

type UserId = Types.ObjectId | string;

export interface IssuedRefreshToken {
  token: string; // raw value for the cookie; only its hash is stored
  expiresAt: Date;
}

export type RotationResult =
  | { status: "rotated"; userId: string; refresh: IssuedRefreshToken }
  // Replaced moments ago by a parallel request (another tab): reject without
  // revoking, and leave the cookie alone because the browser already has the new one.
  | { status: "grace" }
  | { status: "invalid" };

const issue = async (
  userId: UserId,
  familyId: string,
  familyExpiresAt: Date,
  session?: ClientSession,
): Promise<IssuedRefreshToken> => {
  const token = generateToken();
  // Never outlive the family's absolute limit (AU-8).
  const expiresAt = new Date(
    Math.min(Date.now() + authConfig.refreshTokenTtlMs, familyExpiresAt.getTime()),
  );

  await RefreshTokenModel.create(
    [{ userId, familyId, tokenHash: hashToken(token), expiresAt, familyExpiresAt }],
    { session },
  );

  return { token, expiresAt };
};

// New family = new login / device (AU-6).
export const startFamily = (userId: UserId, session?: ClientSession) =>
  issue(userId, randomUUID(), new Date(Date.now() + authConfig.refreshFamilyTtlMs), session);

export const rotate = async (token: string): Promise<RotationResult> => {
  const now = new Date();
  const tokenHash = hashToken(token);

  // Atomic claim: of two parallel requests with the same token, only one can set
  // replacedAt, so only one new token is ever issued from it.
  const claimed = await RefreshTokenModel.findOneAndUpdate(
    {
      tokenHash,
      replacedAt: { $exists: false },
      revokedAt: { $exists: false },
      expiresAt: { $gt: now },
      familyExpiresAt: { $gt: now },
    },
    { $set: { replacedAt: now } },
  );

  if (claimed) {
    const refresh = await issue(claimed.userId, claimed.familyId, claimed.familyExpiresAt);
    return { status: "rotated", userId: String(claimed.userId), refresh };
  }

  const existing = await RefreshTokenModel.findOne({ tokenHash });

  if (existing?.replacedAt && !existing.revokedAt) {
    const sinceReplaced = now.getTime() - existing.replacedAt.getTime();

    if (sinceReplaced <= authConfig.refreshReuseGraceMs) {
      return { status: "grace" };
    }

    // An old token came back after the grace period: assume theft (AU-6, section 3).
    await revokeFamily(existing.familyId);
  }

  return { status: "invalid" };
};

export const revokeFamily = async (familyId: string, session?: ClientSession) => {
  await RefreshTokenModel.updateMany(
    { familyId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
    { session },
  );
};

export const revokeFamilyOf = async (token: string) => {
  const existing = await RefreshTokenModel.findOne({ tokenHash: hashToken(token) });
  if (existing) await revokeFamily(existing.familyId);
};

export const revokeAllForUser = async (userId: UserId, session?: ClientSession) => {
  await RefreshTokenModel.updateMany(
    { userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
    { session },
  );
};
