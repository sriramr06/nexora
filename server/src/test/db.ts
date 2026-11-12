import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { connectDb, disconnectDb } from "../common/db/connection";

// In-memory MongoDB for tests. A replica set (not a standalone server)
// so transactions work exactly as on Atlas.
let replSet: MongoMemoryReplSet | undefined;

export async function startTestDb() {
  // Generous launch timeout: many test files start a database in parallel (CI, busy machines).
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ launchTimeout: 60_000 }],
  });
  await connectDb(replSet.getUri());
}

export async function stopTestDb() {
  await disconnectDb();
  await replSet?.stop();
  replSet = undefined;
}

// Empties every collection; call between tests so they don't affect each other.
export async function clearTestDb() {
  const collections = await mongoose.connection.db?.collections();
  await Promise.all((collections ?? []).map((collection) => collection.deleteMany({})));
}
