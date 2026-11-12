import { Router } from "express";
import {
  addProjectMembersSchema,
  createProjectSchema,
  projectsQuerySchema,
  setManagerSchema,
  updateProjectSchema,
} from "@nexora/shared";
import type { z } from "zod";
import { sendCreated, sendData, sendList, sendNoContent } from "../../common/http/respond";
import { currentUser } from "../../common/middleware/authenticate";
import { currentTenant, tenant } from "../../common/middleware/tenancy";
import { validate } from "../../common/middleware/validate";
import * as projects from "./project.service";

// /api/v1/orgs/:orgId/projects (API design §8.8). Role and project access are checked
// in the service with can(), because they need the project's manager and members.
export const createProjectRouter = (): Router => {
  const router = Router({ mergeParams: true });
  router.use(...tenant());

  const id = (req: { params: Record<string, unknown> }) => String(req.params.projectId);

  router.get("/", validate({ query: projectsQuerySchema }), async (req, res) => {
    const { items, pagination } = await projects.listProjects(
      currentTenant(req),
      res.locals.query as z.output<typeof projectsQuerySchema>,
    );
    sendList(res, items, pagination);
  });

  router.post("/", validate({ body: createProjectSchema }), async (req, res) => {
    sendCreated(res, await projects.createProject(currentTenant(req), currentUser(req), req.body));
  });

  router.get("/:projectId", async (req, res) => {
    sendData(res, await projects.getProject(currentTenant(req), id(req)));
  });

  router.patch("/:projectId", validate({ body: updateProjectSchema }), async (req, res) => {
    sendData(
      res,
      await projects.updateProject(currentTenant(req), currentUser(req), id(req), req.body),
    );
  });

  router.put("/:projectId/manager", validate({ body: setManagerSchema }), async (req, res) => {
    sendData(
      res,
      await projects.setManager(currentTenant(req), currentUser(req), id(req), req.body.userId),
    );
  });

  router.post(
    "/:projectId/members",
    validate({ body: addProjectMembersSchema }),
    async (req, res) => {
      sendData(
        res,
        await projects.addMembers(currentTenant(req), currentUser(req), id(req), req.body.userIds),
      );
    },
  );

  router.delete("/:projectId/members/:userId", async (req, res) => {
    sendData(
      res,
      await projects.removeMember(
        currentTenant(req),
        currentUser(req),
        id(req),
        String(req.params.userId),
      ),
    );
  });

  router.post("/:projectId/archive", async (req, res) => {
    sendData(res, await projects.setArchived(currentTenant(req), currentUser(req), id(req), true));
  });

  router.post("/:projectId/restore", async (req, res) => {
    sendData(res, await projects.setArchived(currentTenant(req), currentUser(req), id(req), false));
  });

  router.delete("/:projectId", async (req, res) => {
    await projects.deleteProject(currentTenant(req), id(req));
    sendNoContent(res);
  });

  return router;
};
