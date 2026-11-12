import { Router } from "express";
import {
  activityQuerySchema,
  createTaskSchema,
  myTasksQuerySchema,
  setAssigneeSchema,
  updateTaskSchema,
} from "@nexora/shared";
import type { z } from "zod";
import { sendCreated, sendData, sendList, sendNoContent } from "../../common/http/respond";
import { currentUser } from "../../common/middleware/authenticate";
import { currentTenant, tenant } from "../../common/middleware/tenancy";
import { validate } from "../../common/middleware/validate";
import * as tasks from "./task.service";

// /api/v1/orgs/:orgId/... task routes (API design §8.9). Permissions need the task's
// project, so they are checked in the service with can().
export const createTaskRouter = (): Router => {
  const router = Router({ mergeParams: true });
  router.use(...tenant());

  const taskId = (req: { params: Record<string, unknown> }) => String(req.params.taskId);

  router.get("/projects/:projectId/tasks", async (req, res) => {
    sendData(res, await tasks.listProjectTasks(currentTenant(req), String(req.params.projectId)));
  });

  router.post(
    "/projects/:projectId/tasks",
    validate({ body: createTaskSchema }),
    async (req, res) => {
      sendCreated(
        res,
        await tasks.createTask(
          currentTenant(req),
          currentUser(req),
          String(req.params.projectId),
          req.body,
        ),
      );
    },
  );

  router.get("/my-tasks", validate({ query: myTasksQuerySchema }), async (req, res) => {
    const { items, pagination } = await tasks.myTasks(
      currentTenant(req),
      res.locals.query as z.output<typeof myTasksQuerySchema>,
    );
    sendList(res, items, pagination);
  });

  router.get("/tasks/:taskId", async (req, res) => {
    sendData(res, await tasks.getTask(currentTenant(req), taskId(req)));
  });

  router.patch("/tasks/:taskId", validate({ body: updateTaskSchema }), async (req, res) => {
    sendData(
      res,
      await tasks.updateTask(currentTenant(req), currentUser(req), taskId(req), req.body),
    );
  });

  router.put("/tasks/:taskId/assignee", validate({ body: setAssigneeSchema }), async (req, res) => {
    sendData(
      res,
      await tasks.setAssignee(currentTenant(req), currentUser(req), taskId(req), req.body),
    );
  });

  router.delete("/tasks/:taskId", async (req, res) => {
    await tasks.deleteTask(currentTenant(req), currentUser(req), taskId(req));
    sendNoContent(res);
  });

  router.get(
    "/tasks/:taskId/activity",
    validate({ query: activityQuerySchema }),
    async (req, res) => {
      const page = await tasks.taskActivity(
        currentTenant(req),
        taskId(req),
        res.locals.query as z.output<typeof activityQuerySchema>,
      );
      res.status(200).json(page);
    },
  );

  return router;
};
