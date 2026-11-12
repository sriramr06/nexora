import { Router } from "express";
import {
  bulkInviteSchema,
  invitationRegisterSchema,
  invitationsQuerySchema,
  invitationTokenSchema,
  inviteSchema,
} from "@nexora/shared";
import type { z } from "zod";
import { sendCreated, sendData, sendList } from "../../common/http/respond";
import { authenticate, currentUser } from "../../common/middleware/authenticate";
import { createInvitationRateLimiter } from "../../common/middleware/rate-limit";
import { authorize, currentTenant, tenant } from "../../common/middleware/tenancy";
import { validate } from "../../common/middleware/validate";
import { setRefreshCookie } from "../auth/refresh-cookie";
import * as invitations from "./invitation.service";

// Tenant side: /api/v1/orgs/:orgId/invitations (API design §8.7). Active organizations
// only (R10) — tenant() without statusExempt.
export const createTenantInvitationRouter = (): Router => {
  const router = Router({ mergeParams: true });
  const guard = [...tenant(), authorize("invitation.view")];

  router.get("/", ...guard, validate({ query: invitationsQuerySchema }), async (req, res) => {
    const { items, pagination } = await invitations.listInvitations(
      currentTenant(req),
      res.locals.query as z.output<typeof invitationsQuerySchema>,
    );
    sendList(res, items, pagination);
  });

  router.post("/", ...guard, validate({ body: inviteSchema }), async (req, res) => {
    sendCreated(
      res,
      await invitations.createInvitation(currentTenant(req), currentUser(req), req.body),
    );
  });

  router.post("/bulk", ...guard, validate({ body: bulkInviteSchema }), async (req, res) => {
    sendData(
      res,
      await invitations.createBulkInvitations(currentTenant(req), currentUser(req), req.body),
    );
  });

  router.post("/:invitationId/resend", ...guard, async (req, res) => {
    sendData(
      res,
      await invitations.resendInvitation(
        currentTenant(req),
        currentUser(req),
        String(req.params.invitationId),
      ),
    );
  });

  router.post("/:invitationId/revoke", ...guard, async (req, res) => {
    sendData(
      res,
      await invitations.revokeInvitation(
        currentTenant(req),
        currentUser(req),
        String(req.params.invitationId),
      ),
    );
  });

  return router;
};

// Public side: /api/v1/invitations (API design §8.3). The token in the body is the
// credential; rate-limited per IP.
export const createPublicInvitationRouter = (): Router => {
  const router = Router();
  router.use(createInvitationRateLimiter());

  router.post("/lookup", validate({ body: invitationTokenSchema }), async (req, res) => {
    sendData(res, await invitations.lookupInvitation(req.body.token));
  });

  router.post("/register", validate({ body: invitationRegisterSchema }), async (req, res) => {
    const { organizationId, ...session } = await invitations.registerWithInvitation(req.body);
    setRefreshCookie(res, session.refresh.token, session.refresh.expiresAt);
    sendCreated(res, { accessToken: session.accessToken, user: session.user, organizationId });
  });

  router.post(
    "/accept",
    authenticate,
    validate({ body: invitationTokenSchema }),
    async (req, res) => {
      sendData(res, await invitations.acceptInvitation(currentUser(req), req.body.token));
    },
  );

  return router;
};
