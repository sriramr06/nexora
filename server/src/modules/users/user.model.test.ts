import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearTestDb, startTestDb, stopTestDb } from "../../test/db";
import { UserModel } from "./user.model";

const validUser = {
  name: "Priya",
  email: "priya@acme.com",
  passwordHash: "$2b$12$fakehashfakehashfakehashfakehashfakehashfakehashfake",
};

describe("UserModel", () => {
  beforeAll(async () => {
    await startTestDb();
    await UserModel.syncIndexes(); // the unique email index must exist for the duplicate test
  });
  beforeEach(clearTestDb);
  afterAll(stopTestDb);

  it("stores email lowercase and trimmed, name trimmed", async () => {
    const user = await UserModel.create({
      ...validUser,
      name: "  Priya  ",
      email: "  Priya@Acme.COM ",
    });

    expect(user.email).toBe("priya@acme.com");
    expect(user.name).toBe("Priya");
  });

  it("applies defaults and leaves optional fields absent", async () => {
    const user = await UserModel.create(validUser);

    expect(user.emailVerified).toBe(false);
    expect(user.avatar).toBeUndefined();
    expect(user.platformRole).toBeUndefined();
  });

  it("rejects a duplicate email regardless of case", async () => {
    await UserModel.create(validUser);

    await expect(UserModel.create({ ...validUser, email: "PRIYA@acme.com" })).rejects.toMatchObject(
      { code: 11000 },
    ); // MongoDB duplicate key error
  });

  it("rejects an unknown platform role", async () => {
    // Cast: the invalid value is the point of this test.
    const invalid = { ...validUser, platformRole: "admin" as unknown as "owner" };
    await expect(UserModel.create(invalid)).rejects.toThrow();
  });

  it("does not load passwordHash unless explicitly selected", async () => {
    await UserModel.create(validUser);

    const withoutHash = await UserModel.findOne({ email: validUser.email });
    const withHash = await UserModel.findOne({ email: validUser.email }).select("+passwordHash");

    expect(withoutHash?.passwordHash).toBeUndefined();
    expect(withHash?.passwordHash).toBe(validUser.passwordHash);
  });

  it("never includes passwordHash in JSON, and exposes id instead of _id", async () => {
    await UserModel.create(validUser);
    const user = await UserModel.findOne({ email: validUser.email }).select("+passwordHash");

    const json = JSON.parse(JSON.stringify(user));

    expect(json.passwordHash).toBeUndefined();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
    expect(json.id).toBe(String(user?._id));
  });
});
