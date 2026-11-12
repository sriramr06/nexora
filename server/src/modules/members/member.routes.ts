import { Router } from "express";
import { changeRoleSchema, membersQuerySchema } from "@nexora/shared";
import type { z } from "zod";
import { sendData, sendList, sendNoContent } from "../../common/http/respond";
import { authorize, currentTenant, tenant } from "../../common/middleware/tenancy";
import { validate } from "../../common/middleware/validate";
import * as members from "./member.service";

// /api/v1/orgs/:orgId/members and /leave (API design §8.6).
export const createMemberRouter = (): Router => {
  const router = Router({ mergeParams: true });

  router.get(
    "/members",
    ...tenant(),
    authorize("member.view"),
    validate({ query: membersQuerySchema }),
    async (req, res) => {
      const { items, pagination } = await members.listMembers(
        currentTenant(req).organization._id,
        res.locals.query as z.output<typeof membersQuerySchema>,
      );
      sendList(res, items, pagination);
    },
  );

  router.patch(
    "/members/:userId",
    ...tenant(),
    authorize("member.changeRole"),
    validate({ body: changeRoleSchema }),
    async (req, res) => {
      sendData(
        res,
        await members.changeRole(currentTenant(req), String(req.params.userId), req.body.role),
      );
    },
  );

  router.delete("/members/:userId", ...tenant(), authorize("member.remove"), async (req, res) => {
    await members.removeMember(currentTenant(req), String(req.params.userId));
    sendNoContent(res);
  });

  router.post("/leave", ...tenant(), authorize("org.leave"), async (req, res) => {
    await members.leaveOrganization(currentTenant(req));
    sendNoContent(res);
  });

  return router;
};
