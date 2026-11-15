import { Router } from "express";
import { activityQuerySchema, commentBodySchema } from "@nexora/shared";
import type { z } from "zod";
import { sendCreated, sendData, sendNoContent } from "../../common/http/respond";
import { currentUser } from "../../common/middleware/authenticate";
import { currentTenant, tenant } from "../../common/middleware/tenancy";
import { validate } from "../../common/middleware/validate";
import * as comments from "./comment.service";

// /api/v1/orgs/:orgId/... (API design §8.10)
export const createCommentRouter = (): Router => {
  const router = Router({ mergeParams: true });
  router.use(...tenant());

  router.get(
    "/tasks/:taskId/comments",
    validate({ query: activityQuerySchema }),
    async (req, res) => {
      const page = await comments.listComments(
        currentTenant(req),
        String(req.params.taskId),
        res.locals.query as z.output<typeof activityQuerySchema>,
      );
      res.status(200).json(page);
    },
  );

  router.post(
    "/tasks/:taskId/comments",
    validate({ body: commentBodySchema }),
    async (req, res) => {
      sendCreated(
        res,
        await comments.addComment(
          currentTenant(req),
          currentUser(req),
          String(req.params.taskId),
          req.body.body,
        ),
      );
    },
  );

  router.patch("/comments/:commentId", validate({ body: commentBodySchema }), async (req, res) => {
    sendData(
      res,
      await comments.editComment(currentTenant(req), String(req.params.commentId), req.body.body),
    );
  });

  router.delete("/comments/:commentId", async (req, res) => {
    await comments.deleteComment(
      currentTenant(req),
      currentUser(req),
      String(req.params.commentId),
    );
    sendNoContent(res);
  });

  return router;
};
