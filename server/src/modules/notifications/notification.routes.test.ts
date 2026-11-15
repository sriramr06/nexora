import request from "supertest";
import { Types } from "mongoose";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { clearTestDb, startTestDb, stopTestDb } from "../../test/db";
import { FakeEmailService } from "../../test/fake-email";
import { addMember, bearer, createOrg, createUser, type TestUser } from "../../test/factories";
import { setEmailService } from "../email/email.service";
import { NotificationModel } from "./notification.model";

let app: Express;
let priya: TestUser; // Tenant Admin
let arun: TestUser; // Project Manager, manages "Website"
let meena: TestUser; // Team Member, assignee
let kiran: TestUser; // Team Member
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
  // Start each test with empty inboxes (setup itself sends "added to project").
  await NotificationModel.deleteMany({ organizationId: orgId });
});

type T = { id: string; version: number };
type N = {
  id: string;
  type: string;
  read: boolean;
  taskId: string | null;
  data: Record<string, unknown>;
};

const as = (user: TestUser) => {
  const auth = (r: request.Test) => r.set("Authorization", bearer(user));
  const base = `/api/v1/orgs/${orgId}`;
  const api = {
    create: async (body: object = {}): Promise<T> =>
      (
        await auth(request(app).post(`${base}/projects/${projectId}/tasks`)).send({
          title: "Design onboarding",
          ...body,
        })
      ).body.data,
    get: async (t: T): Promise<T> =>
      (await auth(request(app).get(`${base}/tasks/${t.id}`))).body.data,
    assign: (t: T, assigneeId: string | null) =>
      auth(request(app).put(`${base}/tasks/${t.id}/assignee`)).send({
        assigneeId,
        version: t.version,
      }),
    move: (t: T, status: string) =>
      auth(request(app).post(`${base}/tasks/${t.id}/status`)).send({ status, version: t.version }),
    requestChanges: (t: T, reason: string) =>
      auth(request(app).post(`${base}/tasks/${t.id}/request-changes`)).send({
        reason,
        version: t.version,
      }),
    flag: (t: T, type: string, reason = "Waiting for keys") =>
      auth(request(app).put(`${base}/tasks/${t.id}/flag`)).send({
        type,
        reason,
        version: t.version,
      }),
    unflag: (t: T) =>
      auth(request(app).delete(`${base}/tasks/${t.id}/flag`)).send({ version: t.version }),
    comment: (t: T, body = "Looks good") =>
      auth(request(app).post(`${base}/tasks/${t.id}/comments`)).send({ body }),
    deleteTask: (t: T) => auth(request(app).delete(`${base}/tasks/${t.id}`)),
    removeFromProject: (userId: string) =>
      auth(request(app).delete(`${base}/projects/${projectId}/members/${userId}`)),
    notifications: async (query = ""): Promise<N[]> =>
      (await auth(request(app).get(`${base}/notifications${query}`))).body.data,
    page: (query = "") => auth(request(app).get(`${base}/notifications${query}`)),
    unread: async (): Promise<number> =>
      (await auth(request(app).get(`${base}/notifications/unread-count`))).body.data.count,
    read: (id: string) => auth(request(app).post(`${base}/notifications/${id}/read`)),
    readAll: () => auth(request(app).post(`${base}/notifications/read-all`)),
    feed: (query = "") => auth(request(app).get(`${base}/projects/${projectId}/activity${query}`)),
  };
  return api;
};

const types = (list: N[]) => list.map((n) => n.type);

describe("task notifications (FR §12.1)", () => {
  it("notifies the new assignee, not someone assigning themselves (US-30, FR-NOT-02)", async () => {
    const task = await as(arun).create({ assigneeId: meena.id });
    const [n] = await as(meena).notifications();
    expect(n).toMatchObject({
      type: "task.assigned",
      taskId: task.id,
      read: false,
      data: { taskTitle: "Design onboarding", projectName: "Website" },
    });
    expect(await as(meena).unread()).toBe(1);

    await as(arun).create({ assigneeId: arun.id });
    expect(await as(arun).notifications()).toEqual([]);
  });

  it("tells the new assignee and the previous one on reassignment", async () => {
    const task = await as(arun).create({ assigneeId: meena.id });
    await as(arun).assign(task, kiran.id).expect(200);
    expect(types(await as(kiran).notifications())).toEqual(["task.assigned"]);
    expect(types(await as(meena).notifications())).toEqual(["task.unassigned", "task.assigned"]);
  });

  it("submission notifies the manager; approval notifies the assignee", async () => {
    let task = await as(arun).create({ assigneeId: meena.id });
    await as(meena).move(task, "in_progress").expect(200);
    task = await as(meena).get(task);
    await as(meena).move(task, "in_review").expect(200);
    expect(types(await as(arun).notifications())).toEqual(["task.submitted_for_review"]);

    task = await as(arun).get(task);
    await as(arun).move(task, "done").expect(200);
    const [latest] = await as(meena).notifications();
    expect(latest).toMatchObject({ type: "task.status_changed", data: { status: "done" } });
  });

  it("a change request sends only the most specific type, with the reason", async () => {
    let task = await as(arun).create({ assigneeId: meena.id });
    await as(meena).move(task, "in_progress");
    task = await as(meena).get(task);
    await as(meena).move(task, "in_review");
    task = await as(arun).get(task);
    await as(arun).requestChanges(task, "Add the mobile layout").expect(200);

    const list = await as(meena).notifications();
    expect(types(list)).toEqual(["task.changes_requested", "task.assigned"]);
    expect(list[0]!.data.reason).toBe("Add the mobile layout");
  });

  it("Blocked notifies the manager, unblocking the assignee; On hold notifies no one", async () => {
    let task = await as(arun).create({ assigneeId: meena.id });
    await as(meena).flag(task, "blocked", "No staging keys").expect(200);
    const [blocked] = await as(arun).notifications();
    expect(blocked).toMatchObject({ type: "task.blocked", data: { reason: "No staging keys" } });

    task = await as(arun).get(task);
    await as(arun).unflag(task).expect(200);
    expect(types(await as(meena).notifications())[0]).toBe("task.unblocked");

    task = await as(meena).get(task);
    await as(meena).flag(task, "on_hold").expect(200);
    expect(types(await as(arun).notifications())).toEqual(["task.blocked"]);
  });

  it("a project without a manager sends blockers to every Tenant Admin (R6)", async () => {
    const lata = await createUser({ name: "Lata" });
    await addMember(new Types.ObjectId(orgId), lata, "admin");
    await request(app)
      .patch(`/api/v1/orgs/${orgId}/members/${arun.id}`)
      .set("Authorization", bearer(priya))
      .send({ role: "member" })
      .expect(200);
    // Priya made the change herself, so only the other admin hears about it.
    expect(await as(priya).notifications()).toEqual([]);
    const [unset] = await as(lata).notifications();
    expect(unset).toMatchObject({
      type: "project.manager_unset",
      data: { projectName: "Website", memberName: "Arun" },
    });

    const task = await as(meena).create({ assigneeId: meena.id });
    await as(meena).flag(task, "blocked").expect(200);
    expect(types(await as(priya).notifications())).toEqual(["task.blocked"]);
    expect(types(await as(lata).notifications())[0]).toBe("task.blocked");
  });

  it("comments notify the assignee and the creator once each, never the author", async () => {
    const task = await as(arun).create({ assigneeId: meena.id });
    await as(kiran).comment(task).expect(201);
    expect(types(await as(meena).notifications())[0]).toBe("comment.added");
    expect(types(await as(arun).notifications())).toEqual(["comment.added"]);
    expect(await as(kiran).notifications()).toEqual([]);

    await as(meena).comment(task).expect(201);
    expect(types(await as(meena).notifications())).toEqual(["comment.added", "task.assigned"]);
  });

  it("deleting a task removes the notifications that link to it", async () => {
    const task = await as(arun).create({ assigneeId: meena.id });
    await as(arun).deleteTask(task).expect(204);
    expect(await as(meena).notifications()).toEqual([]);
  });
});

describe("project notifications", () => {
  it("added and removed members are told; the manager gets one R5 notice with a count", async () => {
    const ravi = await createUser({ name: "Ravi" });
    await addMember(new Types.ObjectId(orgId), ravi, "member");
    await request(app)
      .post(`/api/v1/orgs/${orgId}/projects/${projectId}/members`)
      .set("Authorization", bearer(arun))
      .send({ userIds: [ravi.id] })
      .expect(200);
    expect(types(await as(ravi).notifications())).toEqual(["project.member_added"]);

    await as(arun).create({ assigneeId: kiran.id, title: "One" });
    await as(arun).create({ assigneeId: kiran.id, title: "Two" });

    await as(arun).removeFromProject(kiran.id).expect(200);
    expect(types(await as(kiran).notifications())[0]).toBe("project.member_removed");
    // Arun removed Kiran himself, so he is not notified about his own action.
    expect(types(await as(arun).notifications())).toEqual([]);
  });

  it("R5 on leaving the organization notifies the manager with the count", async () => {
    await as(arun).create({ assigneeId: kiran.id, title: "One" });
    await as(arun).create({ assigneeId: kiran.id, title: "Two" });
    await request(app)
      .delete(`/api/v1/orgs/${orgId}/members/${kiran.id}`)
      .set("Authorization", bearer(priya))
      .expect(204);
    const [n] = await as(arun).notifications();
    expect(n).toMatchObject({
      type: "project.tasks_unassigned",
      data: { count: 2, memberName: "Kiran", projectName: "Website" },
    });
  });
});

describe("reading notifications (FR-NOT-03 – 06)", () => {
  it("marks one read, refuses someone else's, and marks all read", async () => {
    await as(arun).create({ assigneeId: meena.id, title: "A" });
    await as(arun).create({ assigneeId: meena.id, title: "B" });
    const [first] = await as(meena).notifications();
    expect(await as(meena).unread()).toBe(2);

    await as(kiran).read(first!.id).expect(404);
    await as(meena).read(first!.id).expect(204);
    expect(await as(meena).unread()).toBe(1);
    expect((await as(meena).notifications())[0]!.read).toBe(true);

    await as(meena).readAll().expect(204);
    expect(await as(meena).unread()).toBe(0);
  });

  it("pages newest first with a cursor", async () => {
    for (const title of ["A", "B", "C"]) await as(arun).create({ assigneeId: meena.id, title });
    const first = (await as(meena).page("?limit=2").expect(200)).body;
    expect(first.data.map((n: N) => n.data.taskTitle)).toEqual(["C", "B"]);
    expect(first.pagination.hasMore).toBe(true);
    const next = (await as(meena).page(`?limit=2&cursor=${first.pagination.nextCursor}`)).body;
    expect(next.data.map((n: N) => n.data.taskTitle)).toEqual(["A"]);
    expect(next.pagination.hasMore).toBe(false);
  });
});

describe("project activity feed (FR-ACT-04)", () => {
  it("lists project and task entries newest first, page by page; outsiders get 404", async () => {
    await as(arun).create({ title: "A" });
    await as(arun).create({ title: "B" });
    const first = (await as(meena).feed("?limit=2").expect(200)).body;
    expect(first.data.map((e: { action: string }) => e.action)).toEqual([
      "task.created",
      "task.created",
    ]);
    expect(first.data[0].snapshot.taskTitle).toBe("B");
    const rest = (await as(meena).feed(`?limit=50&cursor=${first.pagination.nextCursor}`)).body;
    expect(rest.data.at(-1).action).toBe("project.created");

    const outsider = await createUser({ name: "Outsider" });
    await request(app)
      .get(`/api/v1/orgs/${orgId}/projects/${projectId}/activity`)
      .set("Authorization", bearer(outsider))
      .expect(404);
  });
});
