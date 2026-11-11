import { Schema, model, type InferSchemaType } from "mongoose";

export const USER_TOKEN_TYPES = ["email_verification", "password_reset"] as const;

export type UserTokenType = (typeof USER_TOKEN_TYPES)[number];

const userTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: USER_TOKEN_TYPES,
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
    usedAt: {
      type: Date,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  },
);

userTokenSchema.index({ userId: 1, type: 1 });
userTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type UserToken = InferSchemaType<typeof userTokenSchema>;

export const UserTokenModel = model<UserToken>("UserToken", userTokenSchema);
