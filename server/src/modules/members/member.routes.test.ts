import request from "supertest";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { forTenant } from "../../common/db/tenant-scope";
import { clearTestDb, startTestDb, stopTestDb } from "../../test/db";
import { FakeEmailService } from "../../test/fake-email";
import { addMember, bearer, createOrg, createUser, type TestUser } from "../../test/factories";
import { setEmailService } from "../email/email.service";
import { InvitationModel } from "../invitations/invitation.model";
import { MembershipModel } from "./membership.model";

let app: Express;
let priya: TestUser; // Tenant Admin
let arun: TestUser; // Project Manager
let meena: TestUser; // Team Member
let orgId: string;

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
  const org = await createOrg(priya);
  orgId = org.id;
  await addMember(org._id, arun, "project_manager");
  await addMember(org._id, meena, "member");
});

const members = () => `/api/v1/orgs/${orgId}/members`;
const roleOf = async (user: TestUser) =>
  (await forTenant(MembershipModel, orgId).findOne({ userId: user._id }))?.role;
const changeRole = (as: TestUser, target: TestUser, role: string) =>
  request(app).patch(`${members()}/${target.id}`).set("Authorization", bearer(as)).send({ role });

describe("GET /members (US-15, FR-MEM-01)", () => {
  it("lists members with role, sorted by name, for any member", async () => {
    const res = await request(app).get(members()).set("Authorization", bearer(meena));

    expect(res.status).toBe(200);
    expect(res.body.data.map((m: { name: string; role: string }) => [m.name, m.role])).toEqual([
      ["Arun", "project_manager"],
      ["Meena", "member"],
      ["Priya", "admin"],
    ]);
    expect(res.body.pagination.total).toBe(3);
  });
});

describe("PATCH /members/:userId (FR-MEM-02, R1, R12)", () => {
  it("lets a Tenant Admin change roles; others get 403", async () => {
    expect((await changeRole(priya, meena, "project_manager")).status).toBe(200);
    expect(await roleOf(meena)).toBe("project_manager");

    expect((await changeRole(arun, meena, "member")).status).toBe(403);
  });

  it("never demotes the last Tenant Admin", async () => {
    const res = await changeRole(priya, priya, "member");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LAST_ADMIN");
  });

  it("holds under a race: two admins demoting each other leave one admin", async () => {
    await changeRole(priya, arun, "admin");

    const [a, b] = await Promise.all([
      changeRole(priya, arun, "member"),
      changeRole(arun, priya, "member"),
    ]);

    const admins = await forTenant(MembershipModel, orgId).countDocuments({ role: "admin" });
    expect(admins).toBe(1);
    expect([a.status, b.status]).toContain(200);
  });

  it("revokes a demoted Project Manager's pending invitations (R12)", async () => {
    await request(app)
      .post(`/api/v1/orgs/${orgId}/invitations`)
      .set("Authorization", bearer(arun))
      .send({ email: "ravi@acme.test", role: "member" });

    await changeRole(priya, arun, "member");

    const invitation = await forTenant(InvitationModel, orgId).findOne({ email: "ravi@acme.test" });
    expect(invitation?.status).toBe("revoked");
    expect(invitation?.revokedBy).toBeUndefined(); // revoked by the system
  });
});

describe("DELETE /members/:userId and leave (FR-MEM-03, 04)", () => {
  it("removes a member; the account remains", async () => {
    const res = await request(app)
      .delete(`${members()}/${meena.id}`)
      .set("Authorization", bearer(priya));
    expect(res.status).toBe(204);
    expect(await roleOf(meena)).toBeUndefined();

    // Removed members lose access on their next request.
    const after = await request(app).get(members()).set("Authorization", bearer(meena));
    expect(after.status).toBe(404);
  });

  it("asks admins to use 'leave' for themselves", async () => {
    const res = await request(app)
      .delete(`${members()}/${priya.id}`)
      .set("Authorization", bearer(priya));
    expect(res.status).toBe(400);
  });

  it("lets members leave, but not the last Tenant Admin", async () => {
    const leave = (as: TestUser) =>
      request(app).post(`/api/v1/orgs/${orgId}/leave`).set("Authorization", bearer(as));

    expect((await leave(meena)).status).toBe(204);

    const last = await leave(priya);
    expect(last.status).toBe(409);
    expect(last.body.error.code).toBe("LAST_ADMIN");
  });
});
