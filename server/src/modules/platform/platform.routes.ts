import { Router } from "express";
import {
  platformOrganizationsQuerySchema,
  renameOrganizationSchema,
  statusReasonSchema,
} from "@nexora/shared";
import type { z } from "zod";
import { sendData, sendList } from "../../common/http/respond";
import { authenticate, currentUser } from "../../common/middleware/authenticate";
import { requireOwner } from "../../common/middleware/tenancy";
import { validate } from "../../common/middleware/validate";
import * as platform from "./platform.service";

type ListQuery = z.output<typeof platformOrganizationsQuerySchema>;

// /api/v1/platform (API design §8.4): Application Owner only.
export const createPlatformRouter = (): Router => {
  const router = Router();
  router.use(authenticate, requireOwner);

  router.get(
    "/organizations",
    validate({ query: platformOrganizationsQuerySchema }),
    async (_req, res) => {
      const { items, pagination } = await platform.listOrganizations(res.locals.query as ListQuery);
      sendList(res, items, pagination);
    },
  );

  router.get("/organizations/:id", async (req, res) => {
    sendData(res, await platform.getOrganizationDetails(req.params.id));
  });

  router.patch(
    "/organizations/:id",
    validate({ body: renameOrganizationSchema }),
    async (req, res) => {
      sendData(
        res,
        await platform.renameOrganization(String(req.params.id), req.body.name, currentUser(req)),
      );
    },
  );

  router.post("/organizations/:id/approve", async (req, res) => {
    sendData(res, await platform.changeStatus(req.params.id, "approve", currentUser(req)));
  });

  router.post("/organizations/:id/reactivate", async (req, res) => {
    sendData(res, await platform.changeStatus(req.params.id, "reactivate", currentUser(req)));
  });

  for (const transition of ["reject", "suspend"] as const) {
    router.post(
      `/organizations/:id/${transition}`,
      validate({ body: statusReasonSchema }),
      async (req, res) => {
        sendData(
          res,
          await platform.changeStatus(
            String(req.params.id),
            transition,
            currentUser(req),
            req.body.reason,
          ),
        );
      },
    );
  }

  return router;
};
