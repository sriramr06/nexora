import request from "supertest";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { hashToken } from "../../common/crypto/tokens";
import { clearTestDb, startTestDb, stopTestDb } from "../../test/db";
import { FakeEmailService } from "../../test/fake-email";
import { setEmailService } from "../email/email.service";
import { UserModel } from "../users/user.model";
import { signAccessToken } from "./access-token";
import { REFRESH_COOKIE } from "./refresh-cookie";
import { RefreshTokenModel } from "./refresh-token.model";
import { UserTokenModel } from "./user-token.model";

const AUTH = "/api/v1/auth";
const priya = { name: "Priya", email: "priya@acme.com", password: "secret123" };

const email = new FakeEmailService();
let app: Express;

// "nexora_refresh=<value>" from a response's Set-Cookie header, ready to send back.
const refreshCookieOf = (res: request.Response): string | undefined => {
  const header = res.headers["set-cookie"] as unknown as string[] | undefined;
  return header?.find((c) => c.startsWith(`${REFRESH_COOKIE}=`))?.split(";")[0];
};

const register = (body = priya) => request(app).post(`${AUTH}/register`).send(body);
const login = (body: { email: string; password: string } = priya) =>
  request(app).post(`${AUTH}/login`).send(body);
const refresh = (cookie?: string) => {
  const req = request(app).post(`${AUTH}/refresh`);
  return cookie ? req.set("Cookie", cookie) : req;
};

// Registers and logs in; returns the access token and refresh cookie.
const signedIn = async () => {
  await register();
  const res = await login();
  return { accessToken: res.body.data.accessToken as string, cookie: refreshCookieOf(res)! };
};

beforeAll(async () => {
  await startTestDb();
  await UserModel.syncIndexes();
  setEmailService(email);
});
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  email.clear();
  app = createApp(); // fresh rate-limit counters
});

describe("POST /auth/register (US-01)", () => {
  it("creates an unverified user and sends a verification email", async () => {
    const res = await register();

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email: priya.email, emailVerified: false });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    expect(email.last()?.to).toBe(priya.email);
    expect(email.lastToken()).toBeDefined();
    expect(refreshCookieOf(res)).toBeUndefined(); // registering does not log in
  });

  it("rejects an email that is already registered", async () => {
    await register();
    const res = await register({ ...priya, email: "PRIYA@acme.com" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE");
    expect(await UserModel.countDocuments()).toBe(1);
  });

  it("shows the password policy for a weak password", async () => {
    const res = await register({ ...priya, password: "abcdefgh" });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toContainEqual(
      expect.objectContaining({ field: "password", message: expect.stringMatching(/number/) }),
    );
  });

  it("still creates the account when the email cannot be sent", async () => {
    email.shouldFail = true;
    const res = await register();

    expect(res.status).toBe(201);
    expect(await UserModel.countDocuments()).toBe(1);
  });
});

describe("email verification (US-02)", () => {
  const verify = (token: string) => request(app).post(`${AUTH}/verify-email`).send({ token });

  it("verifies with a valid link, once", async () => {
    await register();
    const token = email.lastToken()!;

    expect((await verify(token)).status).toBe(204);
    expect((await UserModel.findOne({ email: priya.email }))?.emailVerified).toBe(true);

    const reused = await verify(token);
    expect(reused.status).toBe(400);
    expect(reused.body.error.message).toMatch(/invalid or has expired/);
  });

  it("rejects an expired link", async () => {
    await register();
    const token = email.lastToken()!;
    await UserTokenModel.updateOne(
      { tokenHash: hashToken(token) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    expect((await verify(token)).status).toBe(400);
  });

  it("resends a new link and invalidates the old one", async () => {
    const { accessToken } = await signedIn();
    const oldToken = email.lastToken()!;

    const res = await request(app)
      .post(`${AUTH}/resend-verification`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(204);
    expect(email.lastToken()).not.toBe(oldToken);
    expect((await verify(oldToken)).status).toBe(400);
    expect((await verify(email.lastToken()!)).status).toBe(204);
  });

  it("requires login to resend", async () => {
    const res = await request(app).post(`${AUTH}/resend-verification`);
    expect(res.status).toBe(401);
  });
});

describe("login, refresh and logout (US-03)", () => {
  it("logs in, returns an access token and sets the refresh cookie", async () => {
    await register();
    const res = await login();

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe(priya.email);

    const setCookie = (res.headers["set-cookie"] as unknown as string[]).join(";");
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    expect(setCookie).toMatch(/Path=\/api\/v1\/auth/);
    expect((await UserModel.findOne({ email: priya.email }))?.lastLoginAt).toBeInstanceOf(Date);
  });

  it("gives the same generic error for a wrong password and an unknown email", async () => {
    await register();
    const wrongPassword = await login({ ...priya, password: "wrong1234" });
    const unknownEmail = await login({ email: "nobody@acme.com", password: "secret123" });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Invalid email or password.");
    }
  });

  it("restores the session from the cookie and rotates it", async () => {
    const { cookie } = await signedIn();
    const res = await refresh(cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe(priya.email);
    expect(refreshCookieOf(res)).not.toBe(cookie);
  });

  it("rejects refresh without a cookie", async () => {
    expect((await refresh()).status).toBe(401);
  });

  it("within the grace period: rejects the old token but keeps the session", async () => {
    const { cookie: first } = await signedIn();
    const second = refreshCookieOf(await refresh(first))!;

    const parallel = await refresh(first); // e.g. a second tab, a moment later
    expect(parallel.status).toBe(401);
    expect(refreshCookieOf(parallel)).toBeUndefined(); // cookie not cleared

    expect((await refresh(second)).status).toBe(200);
  });

  it("after the grace period: reuse revokes the whole family, not other devices", async () => {
    const { cookie: laptop1 } = await signedIn();
    const phone = refreshCookieOf(await login())!;
    const laptop2 = refreshCookieOf(await refresh(laptop1))!;

    await RefreshTokenModel.updateOne(
      { tokenHash: hashToken(laptop1.split("=")[1]!) },
      { $set: { replacedAt: new Date(Date.now() - 11_000) } },
    );

    expect((await refresh(laptop1)).status).toBe(401); // stolen token replayed
    expect((await refresh(laptop2)).status).toBe(401); // family revoked
    expect((await refresh(phone)).status).toBe(200); // other family unaffected
  });

  it("rejects a family past its absolute expiry", async () => {
    const { cookie } = await signedIn();
    await RefreshTokenModel.updateMany({}, { $set: { familyExpiresAt: new Date(Date.now() - 1) } });

    expect((await refresh(cookie)).status).toBe(401);
  });

  it("logs out: the old refresh token is rejected and the cookie cleared", async () => {
    const { cookie } = await signedIn();
    const res = await request(app).post(`${AUTH}/logout`).set("Cookie", cookie);

    expect(res.status).toBe(204);
    expect(refreshCookieOf(res)).toBe(`${REFRESH_COOKIE}=`);
    expect((await refresh(cookie)).status).toBe(401);
  });
});

describe("password reset (US-04)", () => {
  const forgot = (address: string) =>
    request(app).post(`${AUTH}/forgot-password`).send({ email: address });
  const reset = (token: string, password = "newpass123") =>
    request(app).post(`${AUTH}/reset-password`).send({ token, password });

  it("responds the same whether or not the account exists", async () => {
    await register();
    email.clear();

    const known = await forgot(priya.email);
    const unknown = await forgot("nobody@acme.com");

    expect(known.status).toBe(204);
    expect(unknown.status).toBe(204);
    expect(email.sent).toHaveLength(1);
  });

  it("resets the password and signs out every session", async () => {
    const { cookie } = await signedIn();
    await forgot(priya.email);

    expect((await reset(email.lastToken()!)).status).toBe(204);
    expect((await refresh(cookie)).status).toBe(401);
    expect((await login()).status).toBe(401);
    expect((await login({ ...priya, password: "newpass123" })).status).toBe(200);
  });

  it("rejects a used or expired link", async () => {
    await register();
    await forgot(priya.email);
    const token = email.lastToken()!;

    expect((await reset(token)).status).toBe(204);
    expect((await reset(token)).status).toBe(400);

    await forgot(priya.email);
    const expired = email.lastToken()!;
    await UserTokenModel.updateOne(
      { tokenHash: hashToken(expired) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    expect((await reset(expired)).status).toBe(400);
  });
});

describe("POST /auth/change-password (US-05)", () => {
  const change = (accessToken: string, currentPassword: string, newPassword = "newpass123") =>
    request(app)
      .post(`${AUTH}/change-password`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword, newPassword });

  it("changes the password, keeps this session and signs out the others", async () => {
    const { accessToken, cookie: thisDevice } = await signedIn();
    const otherDevice = refreshCookieOf(await login())!;

    const res = await change(accessToken, priya.password);

    expect(res.status).toBe(200);
    const newCookie = refreshCookieOf(res)!;
    expect((await refresh(otherDevice)).status).toBe(401);
    expect((await refresh(thisDevice)).status).toBe(401);
    expect((await refresh(newCookie)).status).toBe(200);
    expect((await login({ ...priya, password: "newpass123" })).status).toBe(200);
  });

  it("rejects an incorrect current password with 400", async () => {
    const { accessToken } = await signedIn();
    const res = await change(accessToken, "wrong1234");

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe("currentPassword");
  });

  it("requires an access token", async () => {
    const res = await request(app).post(`${AUTH}/change-password`).send({});
    expect(res.status).toBe(401);
  });
});

describe("authenticate middleware", () => {
  const resend = (accessToken: string) =>
    request(app).post(`${AUTH}/resend-verification`).set("Authorization", `Bearer ${accessToken}`);

  it("rejects access tokens issued before the password changed (AU-10)", async () => {
    const { accessToken } = await signedIn();
    await UserModel.updateOne({}, { $set: { passwordChangedAt: new Date(Date.now() + 2000) } });

    expect((await resend(accessToken)).status).toBe(401);
  });

  it("rejects a valid token for a user that no longer exists", async () => {
    const res = await resend(signAccessToken("665f1c2e9b1d4a0012345678"));
    expect(res.status).toBe(401);
  });
});

describe("rate limiting", () => {
  it("allows 10 login attempts per 15 minutes per IP and email", async () => {
    const attempt = (address: string) => login({ email: address, password: "wrong1234" });

    for (let i = 0; i < 10; i++) expect((await attempt(priya.email)).status).toBe(401);

    const blocked = await attempt(priya.email);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");

    expect((await attempt("arun@acme.com")).status).toBe(401); // other email unaffected
  }, 30_000); // 12 bcrypt comparisons at cost 12

  it("allows 5 registrations per hour per IP", async () => {
    for (let i = 0; i < 5; i++) {
      expect((await register({ ...priya, email: `user${i}@acme.com` })).status).toBe(201);
    }
    expect((await register({ ...priya, email: "user5@acme.com" })).status).toBe(429);
  });
});
