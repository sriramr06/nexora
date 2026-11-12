import { Router, type RequestHandler } from "express";
import multer from "multer";
import { AVATAR_MAX_BYTES, updateProfileSchema } from "@nexora/shared";
import { AppError } from "../../common/errors/app-error";
import { sendData } from "../../common/http/respond";
import { authenticate, currentUser } from "../../common/middleware/authenticate";
import { validate } from "../../common/middleware/validate";
import { listMyOrganizations } from "../organizations/organization.service";
import { loadAvatar, removeAvatar, saveAvatar, updateName } from "./avatar.service";

// Memory only, never disk (INT-4); one file, at most 2 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
});

const avatarUpload: RequestHandler = (req, res, next) => {
  upload.single("avatar")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      return next(
        AppError.validation(
          err.code === "LIMIT_FILE_SIZE"
            ? "Image must be 2 MB or smaller."
            : 'Upload one image in the "avatar" field.',
        ),
      );
    }
    next(err);
  });
};

// /api/v1/me (API design §8.2).
export const createMeRouter = (): Router => {
  const router = Router();
  router.use(authenticate);

  router.get("/", (req, res) => {
    sendData(res, { user: currentUser(req) });
  });

  // FR-PROF-01
  router.patch("/", validate({ body: updateProfileSchema }), async (req, res) => {
    sendData(res, { user: await updateName(currentUser(req), req.body.name) });
  });

  // FR-PROF-02 / 03
  router.post("/avatar", avatarUpload, async (req, res) => {
    if (!req.file) throw AppError.validation('Upload one image in the "avatar" field.');
    sendData(res, { user: await saveAvatar(currentUser(req), req.file.buffer) });
  });

  router.delete("/avatar", async (req, res) => {
    sendData(res, { user: await removeAvatar(currentUser(req)) });
  });

  router.get("/organizations", async (req, res) => {
    sendData(res, await listMyOrganizations(currentUser(req)._id));
  });

  return router;
};

// /api/v1/users/:userId/avatar — public, because <img> cannot send the access token.
// The URL carries the version, so a matching request can be cached for a year.
export const createUserRouter = (): Router => {
  const router = Router();

  router.get("/:userId/avatar", async (req, res) => {
    const avatar = await loadAvatar(String(req.params.userId)).catch(() => null);
    if (!avatar) throw AppError.notFound("Avatar not found.");

    const versioned = req.query.v === avatar.version;
    res
      .status(200)
      .type(avatar.contentType)
      .set(
        "Cache-Control",
        versioned ? "public, max-age=31536000, immutable" : "public, max-age=60",
      )
      .send(Buffer.from(avatar.data.buffer));
  });

  return router;
};
