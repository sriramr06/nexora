import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { authConfig } from "../../config/auth";
import { AppError } from "../../common/errors/app-error";

interface VerifiedAccessToken {
  userId: string;
  issuedAt: Date;
}

export const signAccessToken = (userId: string): string => {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: authConfig.accessTokenTtl,
  });
};

export const verifyAccessToken = (token: string): VerifiedAccessToken => {
  let payload: string | jwt.JwtPayload;

  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ["HS256"],
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw AppError.tokenExpired();
    }

    throw AppError.unauthenticated();
  }

  if (typeof payload !== "object" || payload === null) {
    throw AppError.unauthenticated();
  }

  if (typeof payload.sub !== "string" || typeof payload.iat !== "number") {
    throw AppError.unauthenticated();
  }

  return {
    userId: payload.sub,
    issuedAt: new Date(payload.iat * 1000),
  };
};
