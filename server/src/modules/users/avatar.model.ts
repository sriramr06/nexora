import { Schema, model } from "mongoose";

// Data model §4.12 / INT-4: one resized WebP per user (~10–30 KB), stored in MongoDB.
const avatarSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    version: { type: String, required: true },
    contentType: { type: String, required: true, default: "image/webp" },
    data: { type: Buffer, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

avatarSchema.index({ userId: 1 }, { unique: true });

export const AvatarModel = model("Avatar", avatarSchema);
