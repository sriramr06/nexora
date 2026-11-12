import request from "supertest";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { clearTestDb, startTestDb, stopTestDb } from "../../test/db";
import { FakeEmailService } from "../../test/fake-email";
import { addMember, bearer, createOrg, createUser, type TestUser } from "../../test/factories";
import { setEmailService } from "../email/email.service";
import { OrganizationModel } from "../organizations/organization.model";
import { todayIn } from "./task.service";

let app: Express;
let priya: TestUser; // Tenant Admin
let arun: TestUser; // Project Manager (manager of the project)
let meena: TestUser; // Team Member (project member)
let kiran: TestUser; // Team Member (project member)
let orgId: string;
let projectId: string;

beforeAll(async () => {
  await startTestDb();
  setEmailService(new FakeEmailService());
  app = createApp();
});
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  priya = await createUser({ name: "Priya" });
  arun = await createUser({ name: "Arun" });
  meena = await createUser({ name: "Meena" });
  kiran = await createUser({ name: "Kiran" });
  const org = await createOrg(priya);
  orgId = org.id;
  await addMember(org._id, arun, "project_manager");
  await addMember(org._id, meena, "member");
  await addMember(org._id, kiran, "member");
  projectId = (
    await request(app)
      .post(`/api/v1/orgs/${orgId}/projects`)
      .set("Authorization", bearer(arun))
      .send({ name: "Website" })
  ).body.data.id;
  await request(app)
    .post(`/api/v1/orgs/${orgId}/projects/${projectId}/members`)
    .set("Authorization", bearer(arun))
    .send({ userIds: [meena.id, kiran.id] });
});

const api = (user: TestUser) => ({
  create: (body: object) =>
    request(app)
      .post(`/api/v1/orgs/${orgId}/projects/${projectId}/tasks`)
      .set("Authorization", bearer(user))
      .send(body),
  get: (id: string) =>
    request(app).get(`/api/v1/orgs/${orgId}/tasks/${id}`).set("Authorization", bearer(user)),
  update: (id: string, body: object) =>
    request(app)
      .patch(`/api/v1/orgs/${orgId}/tasks/${id}`)
      .set("Authorization", bearer(user))
      .send(body),
  assign: (id: string, body: object) =>
    request(app)
      .put(`/api/v1/orgs/${orgId}/tasks/${id}/assignee`)
      .set("Authorization", bearer(user))
      .send(body),
  remove: (id: string) =>
    request(app).delete(`/api/v1/orgs/${orgId}/tasks/${id}`).set("Authorization", bearer(user)),
  history: (id: string) =>
    request(app)
      .get(`/api/v1/orgs/${orgId}/tasks/${id}/activity`)
      .set("Authorization", bearer(user)),
  myTasks: (query = "") =>
    request(app).get(`/api/v1/orgs/${orgId}/my-tasks${query}`).set("Authorization", bearer(user)),
});

const fields = (task: {
  title: string;
  priority: string;
  dueDate: string | null;
  version: number;
}) => ({
  title: task.title,
  priority: task.priority,
  dueDate: task.dueDate,
  version: task.version,
});

describe("create (US-21, FR-TASK-01, 02, 05, 06)", () => {
  it("creates a To Do task with defaults", async () => {
    const res = await api(meena).create({ title: "  Fix login redirect " });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: "Fix login redirect",
      status: "todo",
      priority: "medium",
      assignee: null,
      version: 0,
      createdBy: { name: "Meena" },
    });
  });

  it("lets Team Members assign new tasks only to themselves", async () => {
    expect((await api(meena).create({ title: "Mine", assigneeId: meena.id })).status).toBe(201);
    expect((await api(meena).create({ title: "Yours", assigneeId: kiran.id })).status).toBe(403);
    expect((await api(arun).create({ title: "Any", assigneeId: kiran.id })).status).toBe(201);
  });

  it("only assigns project members (R4)", async () => {
    const outsider = await createUser();
    const res = await api(arun).create({ title: "T", assigneeId: outsider.id });
    expect(res.status).toBe(400);
  });

  it("hides tasks from people outside the project (404)", async () => {
    const task = (await api(arun).create({ title: "Secret" })).body.data;
    const ravi = await createUser();
    await addMember(new (await import("mongoose")).Types.ObjectId(orgId), ravi, "member");
    expect((await api(ravi).get(task.id)).status).toBe(404);
  });
});

describe("edit with optimistic concurrency (FR-TASK-08, API design §6)", () => {
  it("applies an edit with the current version and bumps it", async () => {
    const task = (await api(meena).create({ title: "Draft" })).body.data;
    const res = await api(meena).update(task.id, {
      ...fields(task),
      title: "Final",
      priority: "high",
      dueDate: "2026-12-01",
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      title: "Final",
      priority: "high",
      dueDate: "2026-12-01",
      version: 1,
    });
  });

  it("rejects a stale version with 409 VERSION_CONFLICT", async () => {
    const task = (await api(arun).create({ title: "Draft" })).body.data;
    await api(arun).update(task.id, { ...fields(task), title: "First" });

    const stale = await api(arun).update(task.id, { ...fields(task), title: "Second" });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("VERSION_CONFLICT");
  });

  it("holds under a race: two parallel edits of the same version, one wins", async () => {
    const task = (await api(arun).create({ title: "Draft" })).body.data;
    const [a, b] = await Promise.all([
      api(arun).update(task.id, { ...fields(task), title: "A" }),
      api(priya).update(task.id, { ...fields(task), title: "B" }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });

  it("lets Team Members edit only tasks assigned to or created by them (note 3)", async () => {
    const task = (await api(arun).create({ title: "Arun's", assigneeId: kiran.id })).body.data;
    expect((await api(meena).update(task.id, fields(task))).status).toBe(403);
    expect(
      (await api(kiran).update(task.id, { ...fields(task), title: "Kiran edits" })).status,
    ).toBe(200);
  });
});

describe("assignment (FR-TASK-05 – 07)", () => {
  it("lets a Team Member self-assign an unassigned task, but not reassign", async () => {
    const task = (await api(arun).create({ title: "Up for grabs" })).body.data;
    const mine = await api(meena).assign(task.id, { assigneeId: meena.id, version: 0 });
    expect(mine.body.data.assignee.name).toBe("Meena");

    expect((await api(kiran).assign(task.id, { assigneeId: kiran.id, version: 1 })).status).toBe(
      403,
    );
    expect((await api(meena).assign(task.id, { assigneeId: null, version: 1 })).status).toBe(403);
  });

  it("lets the manager reassign and unassign", async () => {
    const task = (await api(arun).create({ title: "T", assigneeId: meena.id })).body.data;
    const re = await api(arun).assign(task.id, { assigneeId: kiran.id, version: 0 });
    expect(re.body.data.assignee.name).toBe("Kiran");
    const un = await api(arun).assign(task.id, { assigneeId: null, version: 1 });
    expect(un.body.data.assignee).toBeNull();
  });
});

describe("history and delete (FR-ACT-01 – 03, FR-TASK-09)", () => {
  it("records each change with who, what and from → to", async () => {
    const task = (await api(arun).create({ title: "Draft", assigneeId: meena.id })).body.data;
    await api(arun).update(task.id, { ...fields(task), title: "Final" });

    const res = await api(meena).history(task.id);
    expect(res.status).toBe(200);
    const entries = res.body.data as {
      action: string;
      changes?: Record<string, { from: unknown; to: unknown }>;
      users: Record<string, string>;
    }[];
    expect(entries.map((e) => e.action)).toEqual(["task.updated", "task.assigned", "task.created"]);
    expect(entries[0]?.changes?.title).toEqual({ from: "Draft", to: "Final" });
    expect(entries[1]?.users[meena.id]).toBe("Meena");
  });

  it("paginates history with a cursor", async () => {
    let task = (await api(arun).create({ title: "v0" })).body.data;
    for (let i = 1; i <= 3; i++) {
      task = (await api(arun).update(task.id, { ...fields(task), title: `v${i}` })).body.data;
    }
    const first = await request(app)
      .get(`/api/v1/orgs/${orgId}/tasks/${task.id}/activity?limit=2`)
      .set("Authorization", bearer(arun));
    expect(first.body.data).toHaveLength(2);
    expect(first.body.pagination.hasMore).toBe(true);

    const second = await request(app)
      .get(
        `/api/v1/orgs/${orgId}/tasks/${task.id}/activity?limit=2&cursor=${first.body.pagination.nextCursor}`,
      )
      .set("Authorization", bearer(arun));
    expect(second.body.data).toHaveLength(2);
    expect(second.body.pagination.hasMore).toBe(false);
  });

  it("lets only admins and the manager delete", async () => {
    const task = (await api(meena).create({ title: "Mine" })).body.data;
    expect((await api(meena).remove(task.id)).status).toBe(403);
    expect((await api(arun).remove(task.id)).status).toBe(204);
    expect((await api(arun).get(task.id)).status).toBe(404);
  });
});

describe("My Tasks and overdue (FR-TASK-10, 11)", () => {
  it("lists my tasks soonest due first, undated last, and flags overdue in the org timezone", async () => {
    await OrganizationModel.updateOne({ _id: orgId }, { timezone: "Pacific/Kiritimati" }); // UTC+14
    const today = todayIn("Pacific/Kiritimati");
    const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000)
      .toISOString()
      .slice(0, 10);

    await api(arun).create({ title: "No date", assigneeId: meena.id });
    await api(arun).create({ title: "Later", assigneeId: meena.id, dueDate: "2099-01-01" });
    await api(arun).create({ title: "Late", assigneeId: meena.id, dueDate: yesterday });
    await api(arun).create({ title: "Not mine", assigneeId: kiran.id });

    const res = await api(meena).myTasks();
    expect(res.body.data.map((t: { title: string }) => t.title)).toEqual([
      "Late",
      "Later",
      "No date",
    ]);
    expect(res.body.data[0]).toMatchObject({ overdue: true, projectName: "Website" });
    expect(res.body.data[1].overdue).toBe(false);
  });

  it("leaves out tasks from archived projects", async () => {
    await api(arun).create({ title: "T", assigneeId: meena.id });
    await request(app)
      .post(`/api/v1/orgs/${orgId}/projects/${projectId}/archive`)
      .set("Authorization", bearer(arun));
    expect((await api(meena).myTasks()).body.data).toHaveLength(0);
  });
});
