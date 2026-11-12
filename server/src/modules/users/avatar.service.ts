import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { API_PREFIX } from "@nexora/shared";
import { AppError } from "../../common/errors/app-error";
import type { AuthUser } from "../../common/middleware/authenticate";
import { AvatarModel } from "./avatar.model";
import { UserModel } from "./user.model";

// INT-4: avatars are validated by their bytes, resized and stored in MongoDB.

// The file's first bytes decide its type — never the name or the declared Content-Type,
// which the client controls.
export const detectImageType = (bytes: Buffer): "jpeg" | "png" | "webp" | null => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "jpeg";
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
};

export const avatarUrl = (userId: string, version: string) =>
  `${API_PREFIX}/users/${userId}/avatar?v=${version}`;

// Square-crop to 256 px WebP. Re-encoding also drops metadata (EXIF, GPS).
const toAvatarWebp = async (bytes: Buffer) => {
  try {
    return await sharp(bytes, { limitInputPixels: 40_000_000 })
      .rotate() // respect the camera's orientation flag before it is dropped
      .resize(256, 256, { fit: "cover", position: "centre" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw AppError.validation("The image could not be read. Try a different file.");
  }
};

// FR-PROF-02/03: replacing overwrites the stored image (one document per user).
export const saveAvatar = async (user: AuthUser, bytes: Buffer) => {
  if (!detectImageType(bytes)) {
    throw AppError.validation("Upload a JPEG, PNG or WebP image.");
  }
  const data = await toAvatarWebp(bytes);
  const version = randomUUID().replaceAll("-", "").slice(0, 16);

  await AvatarModel.updateOne(
    { userId: user._id },
    { $set: { version, data, contentType: "image/webp" } },
    { upsert: true },
  );
  user.avatar = { url: avatarUrl(user.id, version), publicId: version };
  await user.save();
  return user;
};

export const removeAvatar = async (user: AuthUser) => {
  // Clear the reference first: a failed delete then leaves only an unused image.
  user.set("avatar", undefined);
  await user.save();
  await AvatarModel.deleteOne({ userId: user._id });
  return user;
};

export const loadAvatar = (userId: string) =>
  AvatarModel.findOne({ userId }).select("data contentType version").lean();

export const updateName = async (user: AuthUser, name: string) => {
  await UserModel.updateOne({ _id: user._id }, { $set: { name } });
  user.name = name;
  return user;
};
