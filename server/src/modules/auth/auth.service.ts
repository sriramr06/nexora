import type { ClientSession, Types } from "mongoose";
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "@nexora/shared";
import { authConfig } from "../../config/auth";
import { AppError } from "../../common/errors/app-error";
import { generateToken, hashToken } from "../../common/crypto/tokens";
import { withTransaction } from "../../common/db/transaction";
import { logger } from "../../common/logger";
import type { AuthUser } from "../../common/middleware/authenticate";
import { UserModel } from "../users/user.model";
import { getEmailService } from "../email/email.service";
import { appLink, passwordResetEmail, verificationEmail } from "../email/templates";
import { UserTokenModel, type UserTokenType } from "./user-token.model";
import { hashPassword, verifyPassword } from "./password";
import { signAccessToken } from "./access-token";
import {
  revokeAllForUser,
  rotate,
  startFamily,
  type IssuedRefreshToken,
  type RotationResult,
} from "./refresh-token.service";

export interface AuthSession {
  accessToken: string;
  refresh: IssuedRefreshToken;
  user: AuthUser;
}

const INVALID_LINK = "This link is invalid or has expired.";

// ---------- one-time email tokens (verification, reset) ----------

// Issuing a new token invalidates the previous unused ones of the same type (§4.1, §4.7).
const issueUserToken = async (userId: Types.ObjectId, type: UserTokenType, ttlMs: number) => {
  await UserTokenModel.deleteMany({ userId, type, usedAt: { $exists: false } });

  const token = generateToken();
  await UserTokenModel.create({
    userId,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
};

// Atomic "check and mark used", so a link cannot be used twice even in parallel.
const consumeUserToken = async (token: string, type: UserTokenType, session: ClientSession) => {
  const now = new Date();
  const record = await UserTokenModel.findOneAndUpdate(
    { tokenHash: hashToken(token), type, usedAt: { $exists: false }, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
    { session },
  );
  if (!record) throw AppError.validation(INVALID_LINK);
  return record;
};

const sendVerificationEmail = async (user: AuthUser) => {
  const token = await issueUserToken(
    user._id,
    "email_verification",
    authConfig.emailVerificationTtlMs,
  );
  const content = verificationEmail(user.name, appLink("/verify-email", token));
  await getEmailService().send({ to: user.email, ...content });
};

// ---------- sessions ----------

const createSession = async (user: AuthUser, session?: ClientSession): Promise<AuthSession> => ({
  accessToken: signAccessToken(user.id),
  refresh: await startFamily(user._id, session),
  user,
});

// Compared against when the email is unknown, so "no such user" takes as long as
// "wrong password" and response time does not reveal registered emails (AU-11).
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword("not-a-real-password-1"));

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === 11000;

// ---------- flows ----------

// §4.1 / US-01
export const register = async (input: RegisterInput): Promise<AuthUser> => {
  const duplicate = AppError.duplicate("An account with this email already exists.");
  if (await UserModel.exists({ email: input.email })) throw duplicate;

  let user: AuthUser;
  try {
    user = await UserModel.create({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
    });
  } catch (error) {
    // Two parallel registrations: the unique index rejects the second one.
    if (isDuplicateKeyError(error)) throw duplicate;
    throw error;
  }

  // The account exists either way; if the email fails, the user can resend it.
  try {
    await sendVerificationEmail(user);
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to send verification email");
  }

  return user;
};

// §4.1 / US-02
export const verifyEmail = async (token: string): Promise<void> => {
  await withTransaction(async (session) => {
    const record = await consumeUserToken(token, "email_verification", session);
    await UserModel.updateOne(
      { _id: record.userId },
      { $set: { emailVerified: true } },
      { session },
    );
  });
};

// §4.1 / FR-AUTH-06. Already verified → nothing to do.
export const resendVerification = async (user: AuthUser): Promise<void> => {
  if (user.emailVerified) return;
  await sendVerificationEmail(user);
};

// §4.2 / US-03
export const login = async ({ email, password }: LoginInput): Promise<AuthSession> => {
  const user = await UserModel.findOne({ email }).select("+passwordHash");
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));

  if (!user || !passwordOk) throw AppError.unauthenticated("Invalid email or password.");

  user.lastLoginAt = new Date();
  await user.save();

  return createSession(user);
};

// §4.4 / §4.5: rotate the refresh token and issue a new access token.
export type RefreshResult =
  { status: "ok"; session: AuthSession } | Exclude<RotationResult, { status: "rotated" }>;

export const refresh = async (token: string): Promise<RefreshResult> => {
  const result = await rotate(token);
  if (result.status !== "rotated") return result;

  const user = await UserModel.findById(result.userId);
  if (!user) return { status: "invalid" };

  return {
    status: "ok",
    session: { accessToken: signAccessToken(user.id), refresh: result.refresh, user },
  };
};

// §4.7 / US-04. Same outcome whether or not the account exists.
export const forgotPassword = async (email: string): Promise<void> => {
  const user = await UserModel.findOne({ email });
  if (!user) return;

  try {
    const token = await issueUserToken(user._id, "password_reset", authConfig.passwordResetTtlMs);
    const content = passwordResetEmail(user.name, appLink("/reset-password", token));
    await getEmailService().send({ to: user.email, ...content });
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to send password reset email");
  }
};

// §4.7 / US-04, FR-AUTH-12
export const resetPassword = async ({ token, password }: ResetPasswordInput): Promise<void> => {
  const passwordHash = await hashPassword(password); // slow; keep it out of the transaction

  await withTransaction(async (session) => {
    const record = await consumeUserToken(token, "password_reset", session);
    await UserModel.updateOne(
      { _id: record.userId },
      { $set: { passwordHash, passwordChangedAt: new Date() } },
      { session },
    );
    await revokeAllForUser(record.userId, session);
  });
};

// §4.8 / US-05: other sessions end; this one continues on a new family.
export const changePassword = async (
  user: AuthUser,
  { currentPassword, newPassword }: ChangePasswordInput,
): Promise<AuthSession> => {
  const withHash = await UserModel.findById(user._id).select("+passwordHash");

  // 400, not 401: a 401 would make the client think its session expired.
  if (!withHash || !(await verifyPassword(currentPassword, withHash.passwordHash))) {
    throw AppError.validation("Current password is incorrect.", [
      { field: "currentPassword", message: "Current password is incorrect." },
    ]);
  }

  const passwordHash = await hashPassword(newPassword);

  return withTransaction(async (session) => {
    // Set before signing the new access token, so the new token is not older than it.
    user.passwordChangedAt = new Date();
    await UserModel.updateOne(
      { _id: user._id },
      { $set: { passwordHash, passwordChangedAt: user.passwordChangedAt } },
      { session },
    );
    await revokeAllForUser(user._id, session);
    return createSession(user, session);
  });
};
