import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MembershipModel } from "../../modules/members/membership.model";
import { clearTestDb, startTestDb, stopTestDb } from "../../test/db";
import { forTenant, TenantScopeError } from "./tenant-scope";

const orgA = new Types.ObjectId();
const orgB = new Types.ObjectId();
const userId = new Types.ObjectId();

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  await MembershipModel.create([
    { organizationId: orgA, userId, role: "admin" },
    { organizationId: orgB, userId, role: "member" },
  ]);
});

describe("tenantScoped guard (NFR-ISO-03)", () => {
  it("throws on queries without organizationId instead of reading every tenant", async () => {
    await expect(MembershipModel.find({ userId })).rejects.toBeInstanceOf(TenantScopeError);
    await expect(MembershipModel.countDocuments({})).rejects.toBeInstanceOf(TenantScopeError);
    await expect(MembershipModel.updateMany({}, { role: "admin" })).rejects.toBeInstanceOf(
      TenantScopeError,
    );
    await expect(MembershipModel.deleteMany({})).rejects.toBeInstanceOf(TenantScopeError);
    await expect(MembershipModel.aggregate([{ $match: { userId } }])).rejects.toBeInstanceOf(
      TenantScopeError,
    );
  });

  it("allows an explicit, greppable bypass for legitimate cross-tenant reads", async () => {
    const all = await MembershipModel.find({ userId }).setOptions({ tenantScope: "bypass" });
    expect(all).toHaveLength(2);
  });
});

describe("forTenant repository", () => {
  it("only ever sees its own organization's documents", async () => {
    const repoA = forTenant(MembershipModel, orgA);

    expect(await repoA.find({ userId })).toHaveLength(1);
    expect(await repoA.countDocuments()).toBe(1);

    const bDoc = await forTenant(MembershipModel, orgB).findOne({ userId });
    // A valid ID from another tenant is "not found" through A's repository.
    expect(await repoA.findById(bDoc!._id)).toBeNull();
  });

  it("sets organizationId on create from the context, overriding the input", async () => {
    const other = new Types.ObjectId();
    const created = await forTenant(MembershipModel, orgA).create({
      userId: other,
      role: "member",
      // Even if a caller smuggles a different organizationId in, the context wins.
      ...({ organizationId: orgB } as object),
    } as never);

    expect(String(created.organizationId)).toBe(String(orgA));
  });

  it("refuses to build a repository without an organization", () => {
    expect(() => forTenant(MembershipModel, "")).toThrow();
  });
});
