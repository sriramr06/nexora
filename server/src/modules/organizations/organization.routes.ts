import { Router } from "express";
import { organizationDetailsSchema } from "@nexora/shared";
import { sendCreated, sendData } from "../../common/http/respond";
import { authenticate, currentUser, requireVerified } from "../../common/middleware/authenticate";
import { authorize, currentTenant, tenant } from "../../common/middleware/tenancy";
import { validate } from "../../common/middleware/validate";
import * as orgs from "./organization.service";

// /api/v1/orgs (API design §8.5). Every /:orgId route runs the tenancy pipeline.
export const createOrganizationRouter = (): Router => {
  const router = Router();

  // FR-AUTH-05: only verified users can register an organization.
  router.post(
    "/",
    authenticate,
    requireVerified,
    validate({ body: organizationDetailsSchema }),
    async (req, res) => {
      sendCreated(res, await orgs.registerOrganization(currentUser(req), req.body));
    },
  );

  // Status-exempt: members of a non-active organization need it for the status page.
  router.get("/:orgId", ...tenant({ statusExempt: true }), authorize("org.view"), (req, res) => {
    sendData(res, orgs.getOrganization(currentTenant(req)));
  });

  // Status-exempt so a Rejected organization can be fixed; the service allows only
  // Active or Rejected.
  router.patch(
    "/:orgId",
    ...tenant({ statusExempt: true }),
    authorize("org.update"),
    validate({ body: organizationDetailsSchema }),
    async (req, res) => {
      sendData(res, await orgs.updateOrganization(currentTenant(req), currentUser(req), req.body));
    },
  );

  router.post(
    "/:orgId/resubmit",
    ...tenant({ statusExempt: true }),
    authorize("org.update"),
    async (req, res) => {
      sendData(res, await orgs.resubmitOrganization(currentTenant(req), currentUser(req)));
    },
  );

  return router;
};
