import request from "supertest";
import sharp from "sharp";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { clearTestDb, startTestDb, stopTestDb } from "../../test/db";
import { bearer, createUser, type TestUser } from "../../test/factories";
import { detectImageType } from "./avatar.service";

let app: Express;
let priya: TestUser;

const png = (width = 400, height = 300) =>
  sharp({ create: { width, height, channels: 3, background: "#0f6b62" } })
    .png()
    .toBuffer();

beforeAll(async () => {
  await startTestDb();
  app = createApp();
});
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  priya = await createUser({ name: "Priya" });
});

const upload = (bytes: Buffer, filename = "photo.png") =>
  request(app)
    .post("/api/v1/me/avatar")
    .set("Authorization", bearer(priya))
    .attach("avatar", bytes, filename);

describe("PATCH /me (US-31, FR-PROF-01)", () => {
  it("updates the display name", async () => {
    const res = await request(app)
      .patch("/api/v1/me")
      .set("Authorization", bearer(priya))
      .send({ name: "  Priya Sharma " });
    expect(res.body.data.user.name).toBe("Priya Sharma");
  });
});

describe("avatars (US-32, FR-PROF-02 – 04)", () => {
  it("accepts an image, stores a 256 px WebP and serves it with long caching", async () => {
    const res = await upload(await png());

    expect(res.status).toBe(200);
    const url: string = res.body.data.user.avatar.url;
    expect(url).toMatch(/^\/api\/v1\/users\/[a-f0-9]{24}\/avatar\?v=/);

    const image = await request(app).get(url);
    expect(image.status).toBe(200);
    expect(image.headers["content-type"]).toBe("image/webp");
    expect(image.headers["cache-control"]).toContain("immutable");
    const meta = await sharp(image.body as Buffer).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 256, 256]);
  });

  it("changes the URL on every upload, so caches never show the old image", async () => {
    const first = (await upload(await png())).body.data.user.avatar.url;
    const second = (await upload(await png(100, 100))).body.data.user.avatar.url;
    expect(second).not.toBe(first);
  });

  it("checks the real bytes, not the file name", async () => {
    const res = await upload(Buffer.from("<script>alert(1)</script>"), "evil.png");
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/JPEG, PNG or WebP/);
  });

  it("rejects files over 2 MB", async () => {
    const big = Buffer.concat([await png(), Buffer.alloc(2 * 1024 * 1024)]);
    const res = await upload(big);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/2 MB/);
  });

  it("removes the avatar and the stored image", async () => {
    const url = (await upload(await png())).body.data.user.avatar.url;
    const res = await request(app).delete("/api/v1/me/avatar").set("Authorization", bearer(priya));

    expect(res.body.data.user.avatar).toBeUndefined();
    expect((await request(app).get(url)).status).toBe(404);
  });
});

describe("detectImageType", () => {
  it("recognises JPEG, PNG and WebP signatures only", async () => {
    const base = sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } });
    expect(detectImageType(await base.clone().jpeg().toBuffer())).toBe("jpeg");
    expect(detectImageType(await base.clone().png().toBuffer())).toBe("png");
    expect(detectImageType(await base.clone().webp().toBuffer())).toBe("webp");
    expect(detectImageType(await base.clone().gif().toBuffer())).toBeNull();
    expect(detectImageType(Buffer.from("GIF89a"))).toBeNull();
  });
});
