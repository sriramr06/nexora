import express from "express";
import request from "supertest";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import { sendData } from "../common/http/respond";
import { errorHandler } from "../common/middleware/error-handler";
import { currentTenant, tenant } from "../common/middleware/tenancy";
import { OrganizationModel } from "../modules/organizations/organization.model";
import { clearTestDb, startTestDb, stopTestDb } from "./db";
import { bearer, createOrg, createUser, type TestUser } from "./factories";
import { TENANT_ENDPOINTS } from "./tenant-endpoints";

// US-33: a user of Organization A must not reach Organization B — through ANY tenant
// endpoint. Expected answer is 404 (not 403), so B's existence is not revealed (TEN-6).

let app: Express;
let priya: TestUser; // Tenant Admin of A
let meena: TestUser; // Tenant Admin of B
let orgA: string;
let orgB: string;

beforeAll(async () => {
  await startTestDb();
  app = createApp();
});
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  priya = await createUser({ name: "Priya" });
  meena = await createUser({ name: "Meena" });
  orgA = (await createOrg(priya, { name: "Acme" })).id;
  orgB = (await createOrg(meena, { name: "Globex" })).id;
});

const call = (endpoint: (typeof TENANT_ENDPOINTS)[number], orgId: string, user: TestUser) => {
  const req = request(app)
    [endpoint.method](endpoint.path(orgId))
    .set("Authorization", bearer(user));
  return endpoint.body ? req.send(endpoint.body) : req;
};

describe("cross-tenant isolation", () => {
  for (const endpoint of TENANT_ENDPOINTS) {
    const label = `${endpoint.method.toUpperCase()} ${endpoint.path(":orgId")}`;

    it(`${label}: another tenant's admin gets 404`, async () => {
      const res = await call(endpoint, orgB, priya);
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain("Globex");
    });

    it(`${label}: the Application Owner gets 404 (FR-PLAT-08)`, async () => {
      const owner = await createUser({ owner: true });
      expect((await call(endpoint, orgA, owner)).status).toBe(404);
    });

    it(`${label}: unknown and malformed organization IDs get 404`, async () => {
      expect((await call(endpoint, "665f1c2e9b1d4a0012345678", priya)).status).toBe(404);
      expect((await call(endpoint, "not-an-id", priya)).status).toBe(404);
    });
  }

  it("B's data is unchanged after A's attempts", async () => {
    for (const endpoint of TENANT_ENDPOINTS) await call(endpoint, orgB, priya);
    const b = await OrganizationModel.findById(orgB);
    expect(b?.name).toBe("Globex");
  });

  it("an organization ID in the body never changes which tenant is used (TEN-4)", async () => {
    const res = await request(app)
      .patch(`/api/v1/orgs/${orgA}`)
      .set("Authorization", bearer(priya))
      .send({
        name: "Acme Renamed",
        type: "product",
        size: "1-10",
        industry: "other",
        country: "IN",
        timezone: "Asia/Kolkata",
        organizationId: orgB,
      });

    expect(res.status).toBe(200);
    expect((await OrganizationModel.findById(orgB))?.name).toBe("Globex");
  });
});

describe("requireActiveOrg (R9, US-11)", () => {
  // A minimal non-exempt tenant route; real ones (projects, members…) arrive in later sprints.
  const probeApp = () => {
    const a = express();
    a.get("/orgs/:orgId/probe", ...tenant(), (req, res) =>
      sendData(res, { org: currentTenant(req).organization.name }),
    );
    a.use(errorHandler);
    return a;
  };

  it("blocks members of a non-active organization on their next request", async () => {
    const a = probeApp();
    expect(
      (await request(a).get(`/orgs/${orgA}/probe`).set("Authorization", bearer(priya))).status,
    ).toBe(200);

    for (const status of ["pending_approval", "rejected", "suspended"] as const) {
      await OrganizationModel.updateOne({ _id: orgA }, { status });
      const res = await request(a).get(`/orgs/${orgA}/probe`).set("Authorization", bearer(priya));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ORG_NOT_ACTIVE");
    }
  });

  it("checks membership before status, so outsiders still get 404", async () => {
    await OrganizationModel.updateOne({ _id: orgB }, { status: "suspended" });
    const res = await request(probeApp())
      .get(`/orgs/${orgB}/probe`)
      .set("Authorization", bearer(priya));
    expect(res.status).toBe(404);
  });
});
