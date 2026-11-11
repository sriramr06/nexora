import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../errors/app-error";
import { clearTestDb, startTestDb, stopTestDb } from "../../test/db";
import { withTransaction } from "./transaction";

// Throwaway model used only by these tests.
const Item = mongoose.model("TransactionTestItem", new mongoose.Schema({ name: String }));

describe("withTransaction", () => {
  beforeAll(async () => {
    await startTestDb();
    await Item.createCollection(); // collections can't be created inside a transaction
  });
  beforeEach(clearTestDb);
  afterAll(stopTestDb);

  it("commits all writes and returns the callback's result", async () => {
    const result = await withTransaction(async (session) => {
      await Item.create([{ name: "a" }, { name: "b" }], { session, ordered: true });
      return "done";
    });

    expect(result).toBe("done");
    expect(await Item.countDocuments()).toBe(2);
  });

  it("rolls back every write when the callback throws", async () => {
    await expect(
      withTransaction(async (session) => {
        await Item.create([{ name: "a" }], { session });
        throw new Error("something failed after the first write");
      }),
    ).rejects.toThrow("something failed");

    expect(await Item.countDocuments()).toBe(0); // the first write was undone
  });

  it("re-throws the original error so the error handler can use it", async () => {
    const promise = withTransaction(async () => {
      throw AppError.forbidden();
    });

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("does not see writes made outside the session", async () => {
    await withTransaction(async (session) => {
      await Item.create([{ name: "inside" }], { session });

      // Outside the transaction, the uncommitted document is not visible yet.
      expect(await Item.countDocuments()).toBe(0);
    });

    expect(await Item.countDocuments()).toBe(1);
  });
});
