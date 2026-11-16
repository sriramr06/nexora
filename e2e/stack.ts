// End-to-end test stack: an in-memory MongoDB replica set and the real API on :4100,
// with emails captured instead of sent. Started by Playwright (playwright.config.ts).
//
// Two test-only routes live here, outside the app, so they can never ship:
//   POST /__e2e/reset          drop everything, re-create indexes, the Owner and the demo data
//   GET  /__e2e/emails?to=…    the last email sent to that address (with its link token)
import express from "express";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

export const E2E_API_PORT = 4100;
export const OWNER = { email: "owner@nexora.test", password: "Owner1234" };

const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, name: "e2e", storageEngine: "wiredTiger" },
});
Object.assign(process.env, {
  NODE_ENV: "development",
  PORT: String(E2E_API_PORT),
  MONGODB_URI: replSet.getUri("nexora-e2e"),
  JWT_ACCESS_SECRET: "e2e-secret-that-is-at-least-32-characters-long",
  APP_URL: "http://localhost:5180",
  EMAIL_TRANSPORT: "console",
  LOG_LEVEL: "warn",
});

// Imported after the environment is set: the server validates it on load.
const { createApp } = await import("../server/src/app");
const { connectDb } = await import("../server/src/common/db/connection");
const { setEmailService } = await import("../server/src/modules/email/email.service");
const { FakeEmailService } = await import("../server/src/test/fake-email");
const { seedOwner } = await import("../server/src/scripts/seed-owner");
const { seedDemo } = await import("../server/src/scripts/demo-data");

await connectDb();
const emails = new FakeEmailService();

const reset = async () => {
  await mongoose.connection.db!.dropDatabase();
  for (const name of mongoose.modelNames()) await mongoose.model(name).syncIndexes();
  await seedOwner({ ...OWNER, name: "Nexora Owner" });
  await seedDemo();
  setEmailService(emails); // seedDemo silences email while it runs
  emails.clear();
};

const harness = express();
harness.post("/__e2e/reset", async (_req, res) => {
  await reset();
  res.status(204).end();
});
harness.get("/__e2e/emails", (req, res) => {
  const to = String(req.query.to ?? "");
  const email = emails.sent.filter((e) => e.to === to).at(-1);
  if (!email) return void res.status(404).json({ error: "no email" });
  const token = email.text.match(/[?&]token=([^\s&]+)/)?.[1];
  res.json({ subject: email.subject, text: email.text, token: token && decodeURIComponent(token) });
});
harness.use(createApp());

await reset();
harness.listen(E2E_API_PORT, () =>
  console.log(`e2e API ready on http://localhost:${E2E_API_PORT}`),
);
