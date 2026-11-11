import { randomBytes, createHash } from "node:crypto";

// This raw value goes in the email link / cookie, NEVER in the database
export const generateToken = (): string => {
  return randomBytes(32).toString("base64url");
};

export const hashToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

//
// WHY SHA-256 HERE BUT BCRYPT FOR PASSWORDS?
//   tokens are long and random, so a fast hash is safe; passwords are guessable, so they
//   need a deliberately slow hash (bcrypt, cost 12).
//
// DONE WHEN
//   - generateToken() returns a different ~43-character string each call
//   - hashToken(x) is the same for the same x and 64 hex characters long
