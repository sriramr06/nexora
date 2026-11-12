import request from "supertest";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { forTenant } from "../../common/db/tenant-scope";
import { clearTestDb, startTestDb, stopTestDb } from "../../test/db";
import { addMember, bearer, createOrg, createUser, orgDetails } from "../../test/factories";
import { MembershipModel } from "../members/membership.model";
import { OrganizationModel } from "./organization.model";

const ORGS = "/api/v1/orgs";
let app: Express;

beforeAll(async () => {
  await startTestDb();
  await OrganizationModel.syncIndexes();
  await MembershipModel.syncIndexes();
  app = createApp();
});
afterAll(stopTestDb);
beforeEach(clearTestDb);

const register = (user: Awaited<ReturnType<typeof createUser>>, body: object = orgDetails) =>
  request(app).post(ORGS).set("Authorization", bearer(user)).send(body);

describe("POST /orgs (US-06)", () => {
  it("creates a Pending organization with the submitter as Tenant Admin", async () => {
    const priya = await createUser();
    const res = await register(priya);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      role: "admin",
      organization: { name: "Acme Corp", status: "pending_approval", timezone: "Asia/Kolkata" },
    });
    expect(res.body.data.organization).not.toHaveProperty("adminsVersion");

    const membership = await forTenant(MembershipModel, res.body.data.organization.id).findOne({
      userId: priya._id,
    });
    expect(membership?.role).toBe("admin");
  });

  it("shows field-level errors", async () => {
    const res = await register(await createUser(), { ...orgDetails, name: "", country: "XX" });

    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["name", "country"]));
  });

  it("requires a verified email (FR-AUTH-05)", async () => {
    const res = await register(await createUser({ emailVerified: false }));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("refuses the Application Owner (R8)", async () => {
    const res = await register(await createUser({ owner: true }));
    expect(res.status).toBe(403);
  });

  it("allows only one open registration per user (FR-ORG-09)", async () => {
    const priya = await createUser();
    await register(priya);

    const second = await register(priya, { ...orgDetails, name: "Acme Two" });
    expect(second.status).toBe(409);
  });

  it("holds under a race: parallel registrations create exactly one organization", async () => {
    const priya = await createUser();
    const results = await Promise.all(
      [1, 2, 3].map((n) => register(priya, { ...orgDetails, name: `Acme ${n}` })),
    );

    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await OrganizationModel.countDocuments({ createdBy: priya._id })).toBe(1);
  });

  it("allows a new registration once the previous one is approved", async () => {
    const priya = await createUser();
    await createOrg(priya, { status: "active" });

    expect((await register(priya, { ...orgDetails, name: "Second Co" })).status).toBe(201);
  });
});

describe("GET /orgs/:orgId", () => {
  it("returns the organization and the caller's role, even while pending (status page)", async () => {
    const priya = await createUser();
    const org = await createOrg(priya, { status: "pending_approval" });

    const res = await request(app).get(`${ORGS}/${org.id}`).set("Authorization", bearer(priya));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      role: "admin",
      organization: { id: org.id, status: "pending_approval" },
    });
  });

  it("includes the rejection reason for a rejected organization", async () => {
    const priya = await createUser();
    const org = await createOrg(priya, { status: "pending_approval" });
    org.status = "rejected";
    org.statusHistory.push({
      status: "rejected",
      reason: "Website missing",
      changedBy: priya._id,
      changedAt: new Date(),
    });
    await org.save();

    const res = await request(app).get(`${ORGS}/${org.id}`).set("Authorization", bearer(priya));
    expect(res.body.data.organization.statusReason).toBe("Website missing");
  });
});

describe("PATCH /orgs/:orgId and resubmit (US-07, FR-ORG-04/05)", () => {
  const update = (user: Awaited<ReturnType<typeof createUser>>, orgId: string, body: object) =>
    request(app).patch(`${ORGS}/${orgId}`).set("Authorization", bearer(user)).send(body);

  it("lets a Tenant Admin update an active organization", async () => {
    const priya = await createUser();
    const org = await createOrg(priya);

    const res = await update(priya, org.id, { ...orgDetails, name: "Acme Global" });
    expect(res.status).toBe(200);
    expect(res.body.data.organization.name).toBe("Acme Global");
  });

  it("forbids other roles (403)", async () => {
    const priya = await createUser();
    const arun = await createUser();
    const org = await createOrg(priya);
    await addMember(org._id, arun, "project_manager");

    expect((await update(arun, org.id, orgDetails)).status).toBe(403);
  });

  it("does not allow edits while pending", async () => {
    const priya = await createUser();
    const org = await createOrg(priya, { status: "pending_approval" });

    const res = await update(priya, org.id, orgDetails);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ORG_NOT_ACTIVE");
  });

  it("fixes and resubmits a rejected organization", async () => {
    const priya = await createUser();
    const org = await createOrg(priya, { status: "rejected" });

    expect(
      (await update(priya, org.id, { ...orgDetails, website: "https://acme.example" })).status,
    ).toBe(200);

    const res = await request(app)
      .post(`${ORGS}/${org.id}/resubmit`)
      .set("Authorization", bearer(priya));
    expect(res.status).toBe(200);
    expect(res.body.data.organization).toMatchObject({
      status: "pending_approval",
      website: "https://acme.example",
    });

    const again = await request(app)
      .post(`${ORGS}/${org.id}/resubmit`)
      .set("Authorization", bearer(priya));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("INVALID_TRANSITION");
  });
});

describe("GET /me/organizations (US-08)", () => {
  it("lists every membership with status and role, sorted by name", async () => {
    const priya = await createUser();
    const meena = await createUser();
    await createOrg(priya, { name: "Zeta Labs" });
    const beta = await createOrg(meena, { name: "Beta Works", status: "suspended" });
    await addMember(beta._id, priya, "member");

    const res = await request(app)
      .get("/api/v1/me/organizations")
      .set("Authorization", bearer(priya));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({ name: "Beta Works", status: "suspended", role: "member" }),
      expect.objectContaining({ name: "Zeta Labs", status: "active", role: "admin" }),
    ]);
  });

  it("is empty for a user with no organizations", async () => {
    const res = await request(app)
      .get("/api/v1/me/organizations")
      .set("Authorization", bearer(await createUser()));
    expect(res.body.data).toEqual([]);
  });
});
