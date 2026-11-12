import request from "supertest";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { clearTestDb, startTestDb, stopTestDb } from "../../test/db";
import { FakeEmailService } from "../../test/fake-email";
import { addMember, bearer, createOrg, createUser, type TestUser } from "../../test/factories";
import { setEmailService } from "../email/email.service";

const PLATFORM = "/api/v1/platform/organizations";
const email = new FakeEmailService();
let app: Express;
let owner: TestUser;

beforeAll(async () => {
  await startTestDb();
  setEmailService(email);
  app = createApp();
});
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  email.clear();
  owner = await createUser({ owner: true, name: "Owner" });
});

const asOwner = (method: "get" | "post" | "patch", path: string) =>
  request(app)[method](path).set("Authorization", bearer(owner));

describe("access", () => {
  it("is Application Owner only (403 for tenant users)", async () => {
    const priya = await createUser();
    await createOrg(priya);
    const res = await request(app).get(PLATFORM).set("Authorization", bearer(priya));
    expect(res.status).toBe(403);
  });
});

describe("GET /platform/organizations (US-09)", () => {
  it("filters by status, searches by name and paginates", async () => {
    const admin = await createUser();
    await createOrg(admin, { name: "Acme Corp", status: "pending_approval" });
    await createOrg(admin, { name: "Beta Works", status: "active" });
    await createOrg(admin, { name: "Acme Labs", status: "active" });

    const pending = await asOwner("get", `${PLATFORM}?status=pending_approval`);
    expect(pending.body.data.map((o: { name: string }) => o.name)).toEqual(["Acme Corp"]);

    const search = await asOwner("get", `${PLATFORM}?q=acme`);
    expect(search.body.data).toHaveLength(2);

    const page = await asOwner("get", `${PLATFORM}?limit=2&page=2`);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  it("treats search text literally (no regex injection)", async () => {
    await createOrg(await createUser(), { name: "Acme Corp" });
    const res = await asOwner("get", `${PLATFORM}?q=${encodeURIComponent(".*")}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe("GET /platform/organizations/:id (US-09)", () => {
  it("shows registration details, admins, member count and history — no tenant content", async () => {
    const priya = await createUser({ name: "Priya", email: "priya@acme.test" });
    const org = await createOrg(priya, { status: "pending_approval" });
    await addMember(org._id, await createUser(), "member");

    const res = await asOwner("get", `${PLATFORM}/${org.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      name: "Acme Corp",
      memberCount: 2,
      admins: [{ name: "Priya", email: "priya@acme.test" }],
      createdBy: { name: "Priya" },
      statusHistory: [{ status: "pending_approval", changedBy: { name: "Priya" } }],
    });
    expect(Object.keys(res.body.data)).not.toEqual(expect.arrayContaining(["projects", "tasks"]));
  });

  it("returns 404 for unknown or malformed IDs", async () => {
    expect((await asOwner("get", `${PLATFORM}/665f1c2e9b1d4a0012345678`)).status).toBe(404);
    expect((await asOwner("get", `${PLATFORM}/not-an-id`)).status).toBe(404);
  });
});

describe("approve / reject (US-10)", () => {
  it("approves a pending organization and emails its admin", async () => {
    const priya = await createUser({ email: "priya@acme.test" });
    const org = await createOrg(priya, { status: "pending_approval" });

    const res = await asOwner("post", `${PLATFORM}/${org.id}/approve`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("active");
    expect(res.body.data.statusHistory.at(-1)).toMatchObject({
      status: "active",
      changedBy: { name: "Owner" },
    });
    expect(email.last()).toMatchObject({
      to: "priya@acme.test",
      subject: expect.stringMatching(/approved/),
    });
  });

  it("refuses to reject without a reason", async () => {
    const org = await createOrg(await createUser(), { status: "pending_approval" });
    const res = await asOwner("post", `${PLATFORM}/${org.id}/reject`).send({});
    expect(res.status).toBe(400);
  });

  it("rejects with a reason and emails it", async () => {
    const priya = await createUser({ email: "priya@acme.test" });
    const org = await createOrg(priya, { status: "pending_approval" });

    const res = await asOwner("post", `${PLATFORM}/${org.id}/reject`).send({
      reason: "Please add a company website",
    });

    expect(res.body.data).toMatchObject({
      status: "rejected",
      statusReason: "Please add a company website",
    });
    expect(email.last()?.text).toContain("Please add a company website");
  });

  it("only allows valid transitions (409), and only once", async () => {
    const org = await createOrg(await createUser(), { status: "pending_approval" });

    const [first, second] = await Promise.all([
      asOwner("post", `${PLATFORM}/${org.id}/approve`),
      asOwner("post", `${PLATFORM}/${org.id}/approve`),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);

    const reactivate = await asOwner("post", `${PLATFORM}/${org.id}/reactivate`);
    expect(reactivate.status).toBe(409);
    expect(reactivate.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("still succeeds when the email fails", async () => {
    const org = await createOrg(await createUser(), { status: "pending_approval" });
    email.shouldFail = true;

    expect((await asOwner("post", `${PLATFORM}/${org.id}/approve`)).status).toBe(200);
  });
});

describe("suspend / reactivate (US-11)", () => {
  it("suspends with a reason, cuts access, emails every admin; reactivation restores it", async () => {
    const priya = await createUser({ email: "priya@acme.test" });
    const meena = await createUser({ email: "meena@acme.test" });
    const org = await createOrg(priya);
    await addMember(org._id, meena, "admin");

    const suspend = await asOwner("post", `${PLATFORM}/${org.id}/suspend`).send({
      reason: "Unpaid invoices",
    });
    expect(suspend.body.data.status).toBe("suspended");
    expect(email.sent.map((m) => m.to).sort()).toEqual(["meena@acme.test", "priya@acme.test"]);

    // Members still see the status page (status-exempt), with the reason.
    const status = await request(app)
      .get(`/api/v1/orgs/${org.id}`)
      .set("Authorization", bearer(priya));
    expect(status.body.data.organization).toMatchObject({
      status: "suspended",
      statusReason: "Unpaid invoices",
    });

    email.clear();
    const reactivate = await asOwner("post", `${PLATFORM}/${org.id}/reactivate`);
    expect(reactivate.body.data.status).toBe("active");
    expect(email.sent).toHaveLength(2);
  });
});

describe("PATCH /platform/organizations/:id (FR-PLAT-07)", () => {
  it("renames an organization", async () => {
    const org = await createOrg(await createUser());
    const res = await asOwner("patch", `${PLATFORM}/${org.id}`).send({ name: "Acme Holdings" });
    expect(res.body.data.name).toBe("Acme Holdings");
  });
});
