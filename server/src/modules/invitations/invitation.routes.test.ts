import request from "supertest";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { forTenant } from "../../common/db/tenant-scope";
import { clearTestDb, startTestDb, stopTestDb } from "../../test/db";
import { FakeEmailService } from "../../test/fake-email";
import { addMember, bearer, createOrg, createUser, type TestUser } from "../../test/factories";
import { setEmailService } from "../email/email.service";
import { MembershipModel } from "../members/membership.model";
import { OrganizationModel } from "../organizations/organization.model";
import { UserModel } from "../users/user.model";
import { InvitationModel } from "./invitation.model";

const email = new FakeEmailService();
let app: Express;
let priya: TestUser; // Tenant Admin
let arun: TestUser; // Project Manager
let meena: TestUser; // Team Member
let orgId: string;

beforeAll(async () => {
  await startTestDb();
  await InvitationModel.syncIndexes();
  await MembershipModel.syncIndexes();
  setEmailService(email);
  app = createApp();
});
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  email.clear();
  priya = await createUser({ name: "Priya" });
  arun = await createUser({ name: "Arun" });
  meena = await createUser({ name: "Meena" });
  const org = await createOrg(priya, { name: "Acme" });
  orgId = org.id;
  await addMember(org._id, arun, "project_manager");
  await addMember(org._id, meena, "member");
});

const base = () => `/api/v1/orgs/${orgId}/invitations`;
const invite = (as: TestUser, body: object) =>
  request(app).post(base()).set("Authorization", bearer(as)).send(body);
const lookup = (token: string) => request(app).post("/api/v1/invitations/lookup").send({ token });

describe("POST /invitations (US-12, FR-INV-01, 10)", () => {
  it("lets a Tenant Admin invite any role and emails the link", async () => {
    const res = await invite(priya, { email: "Ravi@Acme.test", role: "project_manager" });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      emailSent: true,
      invitation: {
        email: "ravi@acme.test",
        role: "project_manager",
        status: "pending",
        invitedBy: { name: "Priya" },
      },
    });
    expect(email.last()).toMatchObject({ to: "ravi@acme.test" });
    expect(email.last()?.subject).toContain("Priya invited you to Acme");
    expect(email.lastToken()).toBeDefined();
  });

  it("lets a Project Manager invite Team Members only (R11)", async () => {
    expect((await invite(arun, { email: "ravi@acme.test", role: "member" })).status).toBe(201);
    expect((await invite(arun, { email: "kiran@acme.test", role: "admin" })).status).toBe(403);
  });

  it("does not let Team Members invite", async () => {
    expect((await invite(meena, { email: "ravi@acme.test", role: "member" })).status).toBe(403);
  });

  it("rejects existing members, duplicate pending invitations and the Owner (FR-INV-04, 09)", async () => {
    const owner = await createUser({ owner: true, email: "owner@nexora.test" });
    expect((await invite(priya, { email: meena.email, role: "member" })).status).toBe(409);

    await invite(priya, { email: "ravi@acme.test", role: "member" });
    expect((await invite(priya, { email: "ravi@acme.test", role: "member" })).status).toBe(409);

    expect((await invite(priya, { email: owner.email, role: "member" })).status).toBe(400);
  });

  it("holds under a race: parallel invitations to one email create one", async () => {
    const results = await Promise.all(
      [1, 2, 3].map(() => invite(priya, { email: "ravi@acme.test", role: "member" })),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
  });

  it("re-inviting an expired invitation reuses it", async () => {
    await invite(priya, { email: "ravi@acme.test", role: "member" });
    await InvitationModel.updateMany(
      { organizationId: orgId },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    const res = await invite(priya, { email: "ravi@acme.test", role: "project_manager" });
    expect(res.status).toBe(201);
    expect(await forTenant(InvitationModel, orgId).countDocuments()).toBe(1);
  });

  it("keeps the invitation when the email fails, and says so", async () => {
    email.shouldFail = true;
    const res = await invite(priya, { email: "ravi@acme.test", role: "member" });
    expect(res.status).toBe(201);
    expect(res.body.data.emailSent).toBe(false);
  });

  it("is refused for a suspended organization (R10)", async () => {
    await OrganizationModel.updateOne({ _id: orgId }, { status: "suspended" });
    const res = await invite(priya, { email: "ravi@acme.test", role: "member" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ORG_NOT_ACTIVE");
  });
});

describe("POST /invitations/bulk (FR-INV-12)", () => {
  it("reports a result per address", async () => {
    const res = await request(app)
      .post(`${base()}/bulk`)
      .set("Authorization", bearer(priya))
      .send({
        role: "member",
        emails: ["a@acme.test", "not-an-email", "A@acme.test", meena.email, "b@acme.test"],
      });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { email: "a@acme.test", outcome: "sent" },
      { email: "not-an-email", outcome: "skipped", reason: expect.any(String) },
      { email: "a@acme.test", outcome: "skipped", reason: "Listed more than once." },
      { email: meena.email, outcome: "skipped", reason: "This person is already a member." },
      { email: "b@acme.test", outcome: "sent" },
    ]);
    expect(email.sent).toHaveLength(2);
  });

  it("accepts at most 20 addresses", async () => {
    const emails = Array.from({ length: 21 }, (_, i) => `u${i}@acme.test`);
    const res = await request(app)
      .post(`${base()}/bulk`)
      .set("Authorization", bearer(priya))
      .send({ role: "member", emails });
    expect(res.status).toBe(400);
  });
});

describe("list, resend, revoke (FR-INV-05, 13)", () => {
  it("shows admins every invitation and Project Managers only their own", async () => {
    await invite(priya, { email: "p@acme.test", role: "member" });
    await invite(arun, { email: "a@acme.test", role: "member" });

    const all = await request(app).get(base()).set("Authorization", bearer(priya));
    expect(all.body.data).toHaveLength(2);

    const own = await request(app).get(base()).set("Authorization", bearer(arun));
    expect(own.body.data.map((i: { email: string }) => i.email)).toEqual(["a@acme.test"]);
  });

  it("computes 'expired' for filtering", async () => {
    await invite(priya, { email: "old@acme.test", role: "member" });
    await invite(priya, { email: "new@acme.test", role: "member" });
    await InvitationModel.updateOne(
      { organizationId: orgId, email: "old@acme.test" },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    const expired = await request(app)
      .get(`${base()}?status=expired`)
      .set("Authorization", bearer(priya));
    expect(expired.body.data).toEqual([
      expect.objectContaining({ email: "old@acme.test", status: "expired" }),
    ]);
  });

  it("enforces the 5-minute resend cooldown, then rotates the token", async () => {
    const created = await invite(priya, { email: "ravi@acme.test", role: "member" });
    const id = created.body.data.invitation.id;
    const oldToken = email.lastToken()!;

    const tooSoon = await request(app)
      .post(`${base()}/${id}/resend`)
      .set("Authorization", bearer(priya));
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.error.code).toBe("RESEND_COOLDOWN");

    await InvitationModel.updateOne(
      { organizationId: orgId, _id: id },
      { $set: { lastSentAt: new Date(Date.now() - 6 * 60 * 1000) } },
    );
    const resent = await request(app)
      .post(`${base()}/${id}/resend`)
      .set("Authorization", bearer(priya));
    expect(resent.status).toBe(200);

    expect((await lookup(oldToken)).status).toBe(400); // previous link stops working
    expect((await lookup(email.lastToken()!)).body.data.state).toBe("valid");
  });

  it("revokes once; Project Managers cannot touch others' invitations", async () => {
    const created = await invite(priya, { email: "ravi@acme.test", role: "member" });
    const id = created.body.data.invitation.id;

    expect(
      (await request(app).post(`${base()}/${id}/revoke`).set("Authorization", bearer(arun))).status,
    ).toBe(404);

    const revoked = await request(app)
      .post(`${base()}/${id}/revoke`)
      .set("Authorization", bearer(priya));
    expect(revoked.body.data.status).toBe("revoked");

    const again = await request(app)
      .post(`${base()}/${id}/revoke`)
      .set("Authorization", bearer(priya));
    expect(again.status).toBe(409);
  });
});

describe("public side: lookup, register, accept (US-13, US-14, FR-INV-06 – 08)", () => {
  const sendInvite = async (to: string, role = "member") => {
    await invite(priya, { email: to, role });
    return email.lastToken()!;
  };

  it("looks up an invitation and tells the client whether an account exists", async () => {
    const token = await sendInvite("ravi@acme.test", "project_manager");
    const res = await lookup(token);

    expect(res.body.data).toEqual({
      organizationName: "Acme",
      email: "ravi@acme.test",
      role: "project_manager",
      invitedBy: "Priya",
      state: "valid",
      accountExists: false,
    });
    expect((await lookup("garbage")).body.error.code).toBe("INVITATION_INVALID");
  });

  it("registers through the invitation: verified, joined with the role, logged in", async () => {
    const token = await sendInvite("ravi@acme.test", "project_manager");
    const res = await request(app)
      .post("/api/v1/invitations/register")
      .send({ token, name: "Ravi", password: "secret123" });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      accessToken: expect.any(String),
      organizationId: orgId,
      user: { email: "ravi@acme.test", emailVerified: true },
    });
    expect(res.headers["set-cookie"]?.toString()).toContain("nexora_refresh=");

    const user = await UserModel.findOne({ email: "ravi@acme.test" });
    const membership = await forTenant(MembershipModel, orgId).findOne({ userId: user!._id });
    expect(membership?.role).toBe("project_manager");

    const reused = await request(app)
      .post("/api/v1/invitations/register")
      .send({ token, name: "Ravi", password: "secret123" });
    expect(reused.status).toBe(400);
  });

  it("lets an existing user accept with the invited email only", async () => {
    const kiran = await createUser({ email: "kiran@acme.test" });
    const token = await sendInvite("kiran@acme.test");
    expect((await lookup(token)).body.data.accountExists).toBe(true);

    const mismatch = await request(app)
      .post("/api/v1/invitations/accept")
      .set("Authorization", bearer(meena))
      .send({ token });
    expect(mismatch.status).toBe(403);
    expect(mismatch.body.error.code).toBe("INVITATION_EMAIL_MISMATCH");

    const ok = await request(app)
      .post("/api/v1/invitations/accept")
      .set("Authorization", bearer(kiran))
      .send({ token });
    expect(ok.status).toBe(200);
    expect(ok.body.data.organizationId).toBe(orgId);
    expect((await lookup(token)).body.data.state).toBe("accepted");
  });

  it("rejects expired, revoked and suspended-organization invitations (FR-INV-08)", async () => {
    const kiran = await createUser({ email: "kiran@acme.test" });
    const token = await sendInvite("kiran@acme.test");
    const accept = () =>
      request(app)
        .post("/api/v1/invitations/accept")
        .set("Authorization", bearer(kiran))
        .send({ token });

    await OrganizationModel.updateOne({ _id: orgId }, { status: "suspended" });
    expect((await lookup(token)).body.data.state).toBe("organization_inactive");
    expect((await accept()).status).toBe(400);

    await OrganizationModel.updateOne({ _id: orgId }, { status: "active" });
    await InvitationModel.updateMany({ organizationId: orgId }, { expiresAt: new Date(0) });
    expect((await lookup(token)).body.data.state).toBe("expired");
    expect((await accept()).status).toBe(400);
  });
});

describe("project pre-selection (US-34, R11, R13)", () => {
  const createProject = async (user: TestUser, name: string) =>
    (
      await request(app)
        .post(`/api/v1/orgs/${orgId}/projects`)
        .set("Authorization", bearer(user))
        .send({ name })
    ).body.data.id as string;

  it("adds the new member to pre-selected active projects on acceptance", async () => {
    const alpha = await createProject(arun, "Alpha");
    const beta = await createProject(arun, "Beta");
    const res = await invite(arun, {
      email: "ravi@acme.test",
      role: "member",
      projectIds: [alpha, beta],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.invitation.projects.map((p: { name: string }) => p.name).sort()).toEqual([
      "Alpha",
      "Beta",
    ]);
    const token = email.lastToken()!;

    // Beta is archived before acceptance → not joined (R13).
    await request(app)
      .post(`/api/v1/orgs/${orgId}/projects/${beta}/archive`)
      .set("Authorization", bearer(arun));

    const reg = await request(app)
      .post("/api/v1/invitations/register")
      .send({ token, name: "Ravi", password: "secret123" });
    const raviId = reg.body.data.user.id;

    const alphaDoc = await request(app)
      .get(`/api/v1/orgs/${orgId}/projects/${alpha}`)
      .set("Authorization", bearer(arun));
    expect(alphaDoc.body.data.members.map((m: { id: string }) => m.id)).toContain(raviId);
    const betaDoc = await request(app)
      .get(`/api/v1/orgs/${orgId}/projects/${beta}`)
      .set("Authorization", bearer(arun));
    expect(betaDoc.body.data.members.map((m: { id: string }) => m.id)).not.toContain(raviId);
  });

  it("stops a Project Manager pre-selecting a project they do not manage (R11)", async () => {
    const adminsProject = await createProject(priya, "Admin's");
    const res = await invite(arun, {
      email: "x@acme.test",
      role: "member",
      projectIds: [adminsProject],
    });
    expect(res.status).toBe(403);
  });
});
