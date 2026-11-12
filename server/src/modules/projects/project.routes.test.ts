import request from "supertest";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { forTenant } from "../../common/db/tenant-scope";
import { clearTestDb, startTestDb, stopTestDb } from "../../test/db";
import { FakeEmailService } from "../../test/fake-email";
import { addMember, bearer, createOrg, createUser, type TestUser } from "../../test/factories";
import { ActivityModel } from "../activity/activity.model";
import { setEmailService } from "../email/email.service";
import { TaskModel } from "../tasks/task.model";
import { ProjectModel } from "./project.model";

let app: Express;
let priya: TestUser; // Tenant Admin
let arun: TestUser; // Project Manager
let ravi: TestUser; // Project Manager
let meena: TestUser; // Team Member
let orgId: string;

beforeAll(async () => {
  await startTestDb();
  await ProjectModel.syncIndexes();
  setEmailService(new FakeEmailService());
  app = createApp();
});
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  priya = await createUser({ name: "Priya" });
  arun = await createUser({ name: "Arun" });
  ravi = await createUser({ name: "Ravi" });
  meena = await createUser({ name: "Meena" });
  const org = await createOrg(priya);
  orgId = org.id;
  await addMember(org._id, arun, "project_manager");
  await addMember(org._id, ravi, "project_manager");
  await addMember(org._id, meena, "member");
});

const projects = () => `/api/v1/orgs/${orgId}/projects`;
const as = (user: TestUser) => ({
  get: (path: string) => request(app).get(path).set("Authorization", bearer(user)),
  post: (path: string, body?: object) =>
    request(app).post(path).set("Authorization", bearer(user)).send(body),
  patch: (path: string, body: object) =>
    request(app).patch(path).set("Authorization", bearer(user)).send(body),
  put: (path: string, body: object) =>
    request(app).put(path).set("Authorization", bearer(user)).send(body),
  delete: (path: string) => request(app).delete(path).set("Authorization", bearer(user)),
});

const createProject = async (user: TestUser, body: object = { name: "Website relaunch" }) => {
  const res = await as(user).post(projects(), body);
  expect(res.status).toBe(201);
  return res.body.data as { id: string; manager: { id: string }; members: { id: string }[] };
};

describe("create (US-17, FR-PROJ-01, 02)", () => {
  it("makes a Project Manager the manager and first member", async () => {
    const project = await createProject(arun);
    expect(project.manager.id).toBe(arun.id);
    expect(project.members.map((m) => m.id)).toEqual([arun.id]);
  });

  it("lets a Tenant Admin choose the manager (R3: PM or admin only)", async () => {
    const project = await createProject(priya, { name: "Mobile app", managerId: ravi.id });
    expect(project.manager.id).toBe(ravi.id);

    const res = await as(priya).post(projects(), { name: "Ops", managerId: meena.id });
    expect(res.status).toBe(400);
  });

  it("refuses Team Members", async () => {
    expect((await as(meena).post(projects(), { name: "Mine" })).status).toBe(403);
  });

  it("keeps names unique per organization, ignoring case", async () => {
    await createProject(arun);
    const res = await as(priya).post(projects(), { name: "WEBSITE Relaunch" });
    expect(res.status).toBe(409);
  });

  it("records project.created in the activity log", async () => {
    const project = await createProject(arun);
    const entries = await forTenant(ActivityModel, orgId).find({ projectId: project.id });
    expect(entries.map((e) => e.action)).toEqual(["project.created"]);
  });
});

describe("list and view (FR-PROJ-05)", () => {
  it("shows admins every project and others only projects they belong to", async () => {
    await createProject(arun, { name: "Alpha" });
    await createProject(ravi, { name: "Beta" });

    const admin = await as(priya).get(projects());
    expect(admin.body.data.map((p: { name: string }) => p.name).sort()).toEqual(["Alpha", "Beta"]);

    const pm = await as(arun).get(projects());
    expect(pm.body.data.map((p: { name: string }) => p.name)).toEqual(["Alpha"]);
  });

  it("hides projects from non-members with 404", async () => {
    const project = await createProject(arun);
    expect((await as(meena).get(`${projects()}/${project.id}`)).status).toBe(404);
    expect((await as(ravi).get(`${projects()}/${project.id}`)).status).toBe(404);
  });

  it("includes task counts for progress", async () => {
    const project = await createProject(arun);
    await as(arun).post(`/api/v1/orgs/${orgId}/projects/${project.id}/tasks`, { title: "One" });
    const res = await as(arun).get(projects());
    expect(res.body.data[0]).toMatchObject({ taskCount: 1, doneCount: 0, memberCount: 1 });
  });
});

describe("update, manager and members (FR-PROJ-02 – 04)", () => {
  it("lets the manager edit; another PM who is only a member cannot", async () => {
    const project = await createProject(arun);
    await as(arun).post(`${projects()}/${project.id}/members`, { userIds: [ravi.id] });

    expect(
      (await as(arun).patch(`${projects()}/${project.id}`, { name: "Website v2" })).status,
    ).toBe(200);
    expect((await as(ravi).patch(`${projects()}/${project.id}`, { name: "Hijack" })).status).toBe(
      403,
    );
  });

  it("lets only admins change the manager, who becomes a member", async () => {
    const project = await createProject(arun);
    expect(
      (await as(arun).put(`${projects()}/${project.id}/manager`, { userId: ravi.id })).status,
    ).toBe(403);

    const res = await as(priya).put(`${projects()}/${project.id}/manager`, { userId: ravi.id });
    expect(res.body.data.manager.id).toBe(ravi.id);
    expect(res.body.data.members.map((m: { id: string }) => m.id)).toContain(ravi.id);
  });

  it("only adds members of this organization (NFR-ISO-05)", async () => {
    const project = await createProject(arun);
    const outsider = await createUser();
    const res = await as(arun).post(`${projects()}/${project.id}/members`, {
      userIds: [meena.id, outsider.id],
    });
    expect(res.status).toBe(400);
  });

  it("removing a member unassigns their open tasks only (R5)", async () => {
    const project = await createProject(arun);
    await as(arun).post(`${projects()}/${project.id}/members`, { userIds: [meena.id] });
    const tasks = `/api/v1/orgs/${orgId}/projects/${project.id}/tasks`;
    const open = (await as(arun).post(tasks, { title: "Open", assigneeId: meena.id })).body.data;
    const done = (await as(arun).post(tasks, { title: "Done", assigneeId: meena.id })).body.data;
    await TaskModel.updateOne({ _id: done.id, organizationId: orgId }, { status: "done" });

    const res = await as(arun).delete(`${projects()}/${project.id}/members/${meena.id}`);
    expect(res.status).toBe(200);

    const after = await forTenant(TaskModel, orgId).find({ projectId: project.id });
    const byTitle = Object.fromEntries(after.map((t) => [t.title, t]));
    expect(byTitle.Open?.assigneeId).toBeUndefined();
    expect(String(byTitle.Done?.assigneeId)).toBe(meena.id);
    expect(byTitle.Open?.version).toBe(open.version + 1);
  });

  it("refuses to remove the manager", async () => {
    const project = await createProject(arun);
    expect((await as(priya).delete(`${projects()}/${project.id}/members/${arun.id}`)).status).toBe(
      400,
    );
  });
});

describe("archive, restore, delete (FR-PROJ-06, 07, R7)", () => {
  it("makes archived projects read-only until restored", async () => {
    const project = await createProject(arun);
    await as(arun).post(`${projects()}/${project.id}/archive`);

    expect((await as(arun).patch(`${projects()}/${project.id}`, { name: "Website X" })).status).toBe(403);
    expect(
      (await as(arun).post(`/api/v1/orgs/${orgId}/projects/${project.id}/tasks`, { title: "T" }))
        .status,
    ).toBe(403);

    await as(arun).post(`${projects()}/${project.id}/restore`);
    expect(
      (await as(arun).patch(`${projects()}/${project.id}`, { name: "Website v3" })).status,
    ).toBe(200);
  });

  it("lets only admins delete, removing tasks and history", async () => {
    const project = await createProject(arun);
    await as(arun).post(`/api/v1/orgs/${orgId}/projects/${project.id}/tasks`, { title: "T" });

    expect((await as(arun).delete(`${projects()}/${project.id}`)).status).toBe(403);
    expect((await as(priya).delete(`${projects()}/${project.id}`)).status).toBe(204);

    expect(await forTenant(TaskModel, orgId).countDocuments({ projectId: project.id })).toBe(0);
    expect(await forTenant(ActivityModel, orgId).countDocuments({ projectId: project.id })).toBe(0);
  });
});

describe("organization membership cascades (R5, R6)", () => {
  it("leaving the organization unassigns open tasks and removes project membership", async () => {
    const project = await createProject(arun);
    await as(arun).post(`${projects()}/${project.id}/members`, { userIds: [meena.id] });
    await as(arun).post(`/api/v1/orgs/${orgId}/projects/${project.id}/tasks`, {
      title: "Open",
      assigneeId: meena.id,
    });

    expect((await as(meena).post(`/api/v1/orgs/${orgId}/leave`)).status).toBe(204);

    const stored = await forTenant(ProjectModel, orgId).findById(project.id);
    expect(stored?.memberIds.map(String)).not.toContain(meena.id);
    const task = await forTenant(TaskModel, orgId).findOne({ projectId: project.id });
    expect(task?.assigneeId).toBeUndefined();
  });

  it("demoting a manager to Team Member unsets the project's manager", async () => {
    const project = await createProject(arun);
    await as(priya).patch(`/api/v1/orgs/${orgId}/members/${arun.id}`, { role: "member" });

    const stored = await forTenant(ProjectModel, orgId).findById(project.id);
    expect(stored?.managerId).toBeUndefined();
    expect(stored?.memberIds.map(String)).toContain(arun.id); // still a member
  });
});
