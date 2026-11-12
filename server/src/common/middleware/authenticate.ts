import type { RequestHandler } from "express";
import { isValidObjectId, type HydratedDocument } from "mongoose";
import { AppError } from "../errors/app-error";
import { ERROR_CODES } from "../errors/error-codes";
import { verifyAccessToken } from "../../modules/auth/access-token";
import { UserModel, type User } from "../../modules/users/user.model";

export type AuthUser = HydratedDocument<User>;

declare module "express-serve-static-core" {
  interface Request {
    // Set by `authenticate`; always present in handlers mounted after it.
    user?: AuthUser;
  }
}

// API design §7: verify JWT → load user → reject tokens older than passwordChangedAt (AU-10).
export const authenticate: RequestHandler = async (req, _res, next) => {
  const match = req.get("authorization")?.match(/^Bearer\s+(\S+)$/i);
  if (!match?.[1]) throw AppError.unauthenticated();

  const { userId, issuedAt } = verifyAccessToken(match[1]);
  if (!isValidObjectId(userId)) throw AppError.unauthenticated();

  const user = await UserModel.findById(userId);
  if (!user) throw AppError.unauthenticated();

  // JWT iat has 1-second precision, so compare whole seconds; otherwise the token
  // issued right after a password change (same second) would be rejected.
  if (user.passwordChangedAt) {
    const changedAtSeconds = Math.floor(user.passwordChangedAt.getTime() / 1000);
    if (issuedAt.getTime() / 1000 < changedAtSeconds) {
      throw AppError.unauthenticated("Session expired. Please log in again.");
    }
  }

  req.user = user;
  next();
};

// Use after `authenticate` on routes for verified users only (FR-AUTH-05).
export const requireVerified: RequestHandler = (req, _res, next) => {
  if (!req.user) throw AppError.unauthenticated();
  if (!req.user.emailVerified) {
    throw new AppError(403, ERROR_CODES.EMAIL_NOT_VERIFIED, "Please verify your email first.");
  }
  next();
};

// For handlers behind `authenticate`: narrows req.user to non-optional.
export const currentUser = (req: { user?: AuthUser }): AuthUser => {
  if (!req.user) throw AppError.unauthenticated();
  return req.user;
};
