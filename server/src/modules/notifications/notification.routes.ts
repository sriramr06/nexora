import { Router } from "express";
import { activityQuerySchema } from "@nexora/shared";
import type { z } from "zod";
import { sendData, sendNoContent } from "../../common/http/respond";
import { currentTenant, tenant } from "../../common/middleware/tenancy";
import { validate } from "../../common/middleware/validate";
import * as notifications from "./notification.service";

// /api/v1/orgs/:orgId/notifications (API design §8.11) — always the caller's own.
export const createNotificationRouter = (): Router => {
  const router = Router({ mergeParams: true });
  router.use(...tenant());

  router.get("/", validate({ query: activityQuerySchema }), async (req, res) => {
    res
      .status(200)
      .json(
        await notifications.listNotifications(
          currentTenant(req),
          res.locals.query as z.output<typeof activityQuerySchema>,
        ),
      );
  });

  router.get("/unread-count", async (req, res) => {
    sendData(res, await notifications.unreadCount(currentTenant(req)));
  });

  router.post("/read-all", async (req, res) => {
    await notifications.markAllRead(currentTenant(req));
    sendNoContent(res);
  });

  router.post("/:notificationId/read", async (req, res) => {
    await notifications.markRead(currentTenant(req), String(req.params.notificationId));
    sendNoContent(res);
  });

  return router;
};
