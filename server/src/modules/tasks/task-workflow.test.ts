import request from "supertest";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { clearTestDb, startTestDb, stopTestDb } from "../../test/db";
import { FakeEmailService } from "../../test/fake-email";
import { addMember, bearer, createOrg, createUser, type TestUser } from "../../test/factories";
import { setEmailService } from "../email/email.service";

let app: Express;
let arun: TestUser; // manager
let meena: TestUser; // assignee
let kiran: TestUser; // another member
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
  const priya = await createUser({ name: "Priya" });
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

type T = { id: string; version: number; status: string; flag: unknown };
const as = (user: TestUser) => {
  const auth = (r: request.Test) => r.set("Authorization", bearer(user));
  const base = `/api/v1/orgs/${orgId}`;
  return {
    create: async (body: object = {}): Promise<T> =>
      (
        await auth(request(app).post(`${base}/projects/${projectId}/tasks`)).send({
          title: "Task",
          assigneeId: meena.id,
          ...body,
        })
      ).body.data,
    move: (t: T, status: string) =>
      auth(request(app).post(`${base}/tasks/${t.id}/status`)).send({ status, version: t.version }),
    requestChanges: (t: T, reason?: string) =>
      auth(request(app).post(`${base}/tasks/${t.id}/request-changes`)).send({
        reason,
        version: t.version,
      }),
    flag: (t: T, type: string, reason?: string) =>
      auth(request(app).put(`${base}/tasks/${t.id}/flag`)).send({
        type,
        reason,
        version: t.version,
      }),
    unflag: (t: T) =>
      auth(request(app).delete(`${base}/tasks/${t.id}/flag`)).send({ version: t.version }),
    board: (query = "") => auth(request(app).get(`${base}/projects/${projectId}/board${query}`)),
    summary: () => auth(request(app).get(`${base}/projects/${projectId}/summary`)),
    blocked: () => auth(request(app).get(`${base}/projects/${projectId}/blocked-tasks`)),
    history: (t: T) => auth(request(app).get(`${base}/tasks/${t.id}/activity`)),
  };
};

describe("status changes (US-25, R14)", () => {
  it("lets the assignee work through To Do → In Progress → In Review", async () => {
    let t = await as(arun).create();
    t = (await as(meena).move(t, "in_progress")).body.data;
    const review = await as(meena).move(t, "in_review");
    expect(review.status).toBe(200);
    expect(review.body.data).toMatchObject({ status: "in_review", version: 2 });
  });

  it("tells a Team Member to submit for review instead of Done", async () => {
    const t = await as(arun).create();
    const res = await as(meena).move(t, "done");
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/Submit for review instead/);
  });

  it("stops a member who is not the assignee", async () => {
    const t = await as(arun).create();
    expect((await as(kiran).move(t, "in_progress")).status).toBe(403);
  });

  it("lets the manager approve, and records the move in history (US-36)", async () => {
    const t = await as(arun).create({ status: undefined });
    const done = await as(arun).move(t, "done");
    expect(done.body.data.status).toBe("done");

    const history = (await as(arun).history(t)).body.data;
    expect(history[0]).toMatchObject({
      action: "task.status_changed",
      changes: { status: { from: "todo", to: "done" } },
    });
  });

  it("lets only the manager reopen a Done task", async () => {
    let t = await as(arun).create();
    t = (await as(arun).move(t, "done")).body.data;
    expect((await as(meena).move(t, "todo")).status).toBe(403);
    expect((await as(arun).move(t, "in_progress")).body.data.status).toBe("in_progress");
  });

  it("rejects a stale version", async () => {
    const t = await as(arun).create();
    await as(meena).move(t, "in_progress");
    const stale = await as(arun).move(t, "done");
    expect(stale.status).toBe(409);
  });
});

describe("request changes (US-36)", () => {
  it("needs a reason, returns the task to In Progress and records the reason", async () => {
    let t = await as(arun).create();
    t = (await as(meena).move(t, "in_progress")).body.data;
    t = (await as(meena).move(t, "in_review")).body.data;

    expect((await as(arun).requestChanges(t)).status).toBe(400);
    expect((await as(arun).move(t, "in_progress")).body.error.message).toMatch(/Request changes/);

    const res = await as(arun).requestChanges(t, "Add the mobile layout");
    expect(res.body.data.status).toBe("in_progress");
    const [entry] = (await as(meena).history(t)).body.data;
    expect(entry).toMatchObject({
      action: "task.changes_requested",
      reason: "Add the mobile layout",
    });
  });
});

describe("flags (US-37, US-38, R15, R16)", () => {
  it("keeps a Blocked task in its column and freezes it for the assignee", async () => {
    let t = await as(arun).create();
    t = (await as(meena).move(t, "in_progress")).body.data;
    expect((await as(meena).flag(t, "blocked")).status).toBe(400); // reason required
    t = (await as(meena).flag(t, "blocked", "Waiting for API keys")).body.data;
    expect(t).toMatchObject({
      status: "in_progress",
      flag: { type: "blocked", reason: "Waiting for API keys" },
    });

    expect((await as(meena).move(t, "in_review")).status).toBe(403);
    expect((await as(meena).unflag(t)).status).toBe(403);
    expect((await as(meena).flag(t, "on_hold", "Sneaky")).status).toBe(403);

    const cleared = await as(arun).unflag(t);
    expect(cleared.body.data.flag).toBeNull();
  });

  it("lets the assignee clear On hold", async () => {
    let t = await as(arun).create();
    t = (await as(meena).flag(t, "on_hold", "Parked until Monday")).body.data;
    expect((await as(meena).unflag(t)).body.data.flag).toBeNull();
  });

  it("clears the flag on Done and refuses to flag Done tasks", async () => {
    let t = await as(arun).create();
    t = (await as(meena).flag(t, "blocked", "Blocked")).body.data;
    t = (await as(arun).move(t, "done")).body.data;
    expect(t.flag).toBeNull();
    expect((await as(arun).flag(t, "on_hold", "Later")).status).toBe(403);
  });

  it("lists blocked tasks with reason and who flagged them (FR-BOARD-09)", async () => {
    const t = await as(arun).create({ title: "Integrate payments" });
    await as(meena).flag(t, "blocked", "No sandbox account");
    const res = await as(arun).blocked();
    expect(res.body.data).toEqual([
      expect.objectContaining({
        title: "Integrate payments",
        assignee: expect.objectContaining({ name: "Meena" }),
        flag: expect.objectContaining({
          reason: "No sandbox account",
          setBy: expect.objectContaining({ name: "Meena" }),
        }),
      }),
    ]);
  });
});

describe("board and summary (FR-BOARD-01, 02, 06; US-19, US-26)", () => {
  it("groups by status and sorts by priority, then due date", async () => {
    await as(arun).create({ title: "Low", priority: "low" });
    await as(arun).create({ title: "Urgent", priority: "urgent" });
    await as(arun).create({ title: "High later", priority: "high", dueDate: "2099-02-01" });
    await as(arun).create({ title: "High sooner", priority: "high", dueDate: "2099-01-01" });

    const board = (await as(meena).board()).body.data;
    expect(board.todo.map((t: { title: string }) => t.title)).toEqual([
      "Urgent",
      "High sooner",
      "High later",
      "Low",
    ]);
    expect(board.done).toEqual([]);
  });

  it("filters by assignee, unassigned, priority and flag", async () => {
    await as(arun).create({ title: "Meena's", priority: "high" });
    await as(arun).create({ title: "Nobody's", assigneeId: null });
    const flagged = await as(arun).create({ title: "Flagged" });
    await as(meena).flag(flagged, "blocked", "x");

    const titles = async (q: string) =>
      Object.values((await as(meena).board(q)).body.data as Record<string, { title: string }[]>)
        .flat()
        .map((t) => t.title)
        .sort();
    expect(await titles(`?assigneeId=${meena.id}&priority=high`)).toEqual(["Meena's"]);
    expect(await titles("?assigneeId=none")).toEqual(["Nobody's"]);
    expect(await titles("?flag=blocked")).toEqual(["Flagged"]);
  });

  it("summarises counts, overdue, blocked and % complete", async () => {
    const a = await as(arun).create({ dueDate: "2000-01-01" }); // overdue
    const b = await as(arun).create();
    await as(meena).flag(b, "blocked", "x");
    await as(arun).move(a, "in_progress");
    const c = await as(arun).create({ dueDate: "2000-01-01" });
    await as(arun).move(c, "done"); // done: not overdue

    const res = await as(meena).summary();
    expect(res.body.data).toEqual({
      counts: { todo: 1, in_progress: 1, in_review: 0, done: 1 },
      total: 3,
      overdue: 1,
      blocked: 1,
      percentComplete: 33,
    });
  });
});
