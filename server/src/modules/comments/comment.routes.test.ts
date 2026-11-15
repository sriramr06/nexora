import request from "supertest";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { forTenant } from "../../common/db/tenant-scope";
import { clearTestDb, startTestDb, stopTestDb } from "../../test/db";
import { FakeEmailService } from "../../test/fake-email";
import { addMember, bearer, createOrg, createUser, type TestUser } from "../../test/factories";
import { setEmailService } from "../email/email.service";
import { CommentModel } from "./comment.model";

let app: Express;
let arun: TestUser; // manager
let meena: TestUser;
let kiran: TestUser;
let outsider: TestUser; // org member, not in the project
let orgId: string;
let projectId: string;
let taskId: string;

beforeAll(async () => {
  await startTestDb();
  setEmailService(new FakeEmailService());
  app = createApp();
});
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  const priya = await createUser({ name: "Priya" });
  arun = await createUser({ name: "Arun" });
  meena = await createUser({ name: "Meena" });
  kiran = await createUser({ name: "Kiran" });
  outsider = await createUser({ name: "Ravi" });
  const org = await createOrg(priya);
  orgId = org.id;
  await addMember(org._id, arun, "project_manager");
  await addMember(org._id, meena, "member");
  await addMember(org._id, kiran, "member");
  await addMember(org._id, outsider, "member");
  const auth = (u: TestUser) => ({ Authorization: bearer(u) });
  projectId = (
    await request(app)
      .post(`/api/v1/orgs/${orgId}/projects`)
      .set(auth(arun))
      .send({ name: "Website" })
  ).body.data.id;
  await request(app)
    .post(`/api/v1/orgs/${orgId}/projects/${projectId}/members`)
    .set(auth(arun))
    .send({ userIds: [meena.id, kiran.id] });
  taskId = (
    await request(app)
      .post(`/api/v1/orgs/${orgId}/projects/${projectId}/tasks`)
      .set(auth(arun))
      .send({ title: "T" })
  ).body.data.id;
});

const comments = () => `/api/v1/orgs/${orgId}/tasks/${taskId}/comments`;
const post = (u: TestUser, body: string) =>
  request(app).post(comments()).set("Authorization", bearer(u)).send({ body });

describe("comments (US-28, FR-COM-01 – 04)", () => {
  it("adds comments with author, lists them oldest first, and records activity", async () => {
    await post(meena, "First");
    await post(kiran, "Second");

    const res = await request(app).get(comments()).set("Authorization", bearer(arun));
    expect(
      res.body.data.map((c: { body: string; author: { name: string } }) => [c.author.name, c.body]),
    ).toEqual([
      ["Meena", "First"],
      ["Kiran", "Second"],
    ]);

    const history = await request(app)
      .get(`/api/v1/orgs/${orgId}/tasks/${taskId}/activity`)
      .set("Authorization", bearer(arun));
    expect(history.body.data[0].action).toBe("comment.added");
  });

  it("stores HTML as plain text, untouched (rendered as text by the client)", async () => {
    const res = await post(meena, '<img src=x onerror="alert(1)">');
    expect(res.body.data.body).toBe('<img src=x onerror="alert(1)">');
  });

  it("refuses people outside the project", async () => {
    expect((await post(outsider, "Hi")).status).toBe(404);
  });

  it("lets authors edit (marked edited); nobody else", async () => {
    const id = (await post(meena, "Draft")).body.data.id;
    const edit = (u: TestUser) =>
      request(app)
        .patch(`/api/v1/orgs/${orgId}/comments/${id}`)
        .set("Authorization", bearer(u))
        .send({ body: "Final" });

    expect((await edit(arun)).status).toBe(403);
    const res = await edit(meena);
    expect(res.body.data).toMatchObject({ body: "Final", editedAt: expect.any(String) });
  });

  it("lets authors and the manager delete; other members get 403", async () => {
    const id = (await post(meena, "Oops")).body.data.id;
    const del = (u: TestUser) =>
      request(app).delete(`/api/v1/orgs/${orgId}/comments/${id}`).set("Authorization", bearer(u));

    expect((await del(kiran)).status).toBe(403);
    expect((await del(arun)).status).toBe(204);
    expect(await forTenant(CommentModel, orgId).countDocuments()).toBe(0);
  });

  it("are deleted with their task", async () => {
    await post(meena, "Bye");
    await request(app)
      .delete(`/api/v1/orgs/${orgId}/tasks/${taskId}`)
      .set("Authorization", bearer(arun));
    expect(await forTenant(CommentModel, orgId).countDocuments()).toBe(0);
  });

  it("validates length", async () => {
    expect((await post(meena, "   ")).status).toBe(400);
    expect((await post(meena, "x".repeat(2001))).status).toBe(400);
  });
});
