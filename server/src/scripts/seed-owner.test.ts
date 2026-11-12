import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UserModel } from "../modules/users/user.model";
import { verifyPassword } from "../modules/auth/password";
import { clearTestDb, startTestDb, stopTestDb } from "../test/db";
import { addMember, createOrg, createUser } from "../test/factories";
import { seedOwner } from "./seed-owner";

const input = { email: "owner@nexora.test", name: "Nexora Owner", password: "ownerpass1" };

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

describe("seedOwner (FR-PLAT-01)", () => {
  it("creates a verified Application Owner, and is idempotent", async () => {
    expect(await seedOwner(input)).toBe("created");
    expect(await seedOwner(input)).toBe("unchanged");

    const owner = await UserModel.findOne({ email: input.email }).select("+passwordHash");
    expect(owner).toMatchObject({ platformRole: "owner", emailVerified: true });
    expect(await verifyPassword(input.password, owner!.passwordHash)).toBe(true);
    expect(await UserModel.countDocuments()).toBe(1);
  });

  it("refuses to promote a user who belongs to an organization (R8)", async () => {
    const priya = await createUser({ email: input.email });
    const org = await createOrg(await createUser());
    await addMember(org._id, priya, "member");

    await expect(seedOwner(input)).rejects.toThrow(/R8/);
  });
});
