import { Router, type Response } from "express";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@nexora/shared";
import { AppError } from "../../common/errors/app-error";
import { sendCreated, sendData, sendNoContent } from "../../common/http/respond";
import { authenticate, currentUser } from "../../common/middleware/authenticate";
import { createAuthRateLimiters } from "../../common/middleware/rate-limit";
import { validate } from "../../common/middleware/validate";
import * as auth from "./auth.service";
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from "./refresh-cookie";
import { revokeFamilyOf } from "./refresh-token.service";

// Response for login, refresh and change-password: { data: { accessToken, user } }.
const sendSession = (res: Response, session: auth.AuthSession) => {
  setRefreshCookie(res, session.refresh.token, session.refresh.expiresAt);
  return sendData(res, { accessToken: session.accessToken, user: session.user });
};

// Mounted at /api/v1/auth (API design §8.1).
export const createAuthRouter = (): Router => {
  const router = Router();
  const limit = createAuthRateLimiters();

  router.post("/register", limit.register, validate({ body: registerSchema }), async (req, res) => {
    const user = await auth.register(req.body);
    sendCreated(res, { user });
  });

  router.post("/verify-email", validate({ body: verifyEmailSchema }), async (req, res) => {
    await auth.verifyEmail(req.body.token);
    sendNoContent(res);
  });

  router.post("/resend-verification", limit.resendVerification, authenticate, async (req, res) => {
    await auth.resendVerification(currentUser(req));
    sendNoContent(res);
  });

  router.post("/login", limit.login, validate({ body: loginSchema }), async (req, res) => {
    sendSession(res, await auth.login(req.body));
  });

  // §4.4. Also used on page load to restore the session (§4.5), so it returns the user too.
  router.post("/refresh", async (req, res) => {
    const token = readRefreshCookie(req);
    const result = token ? await auth.refresh(token) : ({ status: "invalid" } as const);

    if (result.status === "grace") {
      // Keep the cookie: a parallel request already set the new one. Client retries.
      throw AppError.unauthenticated("Session is being refreshed. Please retry.");
    }
    if (result.status === "invalid") {
      clearRefreshCookie(res);
      throw AppError.unauthenticated("Session expired. Please log in again.");
    }

    sendSession(res, result.session);
  });

  // §4.6. Always succeeds, so the client can always reach a logged-out state.
  router.post("/logout", async (req, res) => {
    const token = readRefreshCookie(req);
    if (token) await revokeFamilyOf(token);
    clearRefreshCookie(res);
    sendNoContent(res);
  });

  router.post(
    "/forgot-password",
    limit.forgotPassword,
    validate({ body: forgotPasswordSchema }),
    async (req, res) => {
      await auth.forgotPassword(req.body.email);
      sendNoContent(res);
    },
  );

  router.post("/reset-password", validate({ body: resetPasswordSchema }), async (req, res) => {
    await auth.resetPassword(req.body);
    // All sessions were revoked, including this browser's, if any.
    clearRefreshCookie(res);
    sendNoContent(res);
  });

  router.post(
    "/change-password",
    authenticate,
    validate({ body: changePasswordSchema }),
    async (req, res) => {
      sendSession(res, await auth.changePassword(currentUser(req), req.body));
    },
  );

  return router;
};
