import { Schema, model, type InferSchemaType } from "mongoose";

const refreshTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    familyId: {
      type: String,
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    familyExpiresAt: {
      type: Date,
      required: true,
    },
    replacedAt: { type: Date },
    revokedAt: { type: Date },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  },
);

refreshTokenSchema.index({ userId: 1 });
refreshTokenSchema.index({ familyId: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshToken = InferSchemaType<typeof refreshTokenSchema>;

export const RefreshTokenModel = model<RefreshToken>("RefreshToken", refreshTokenSchema);
