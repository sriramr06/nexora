import { Schema, model, type InferSchemaType } from "mongoose";
import { PLATFORM_ROLES } from "@nexora/shared";

const avatarSchema = new Schema(
  {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    emailVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    avatar: {
      type: avatarSchema,
      required: false,
    },
    platformRole: {
      type: String,
      enum: PLATFORM_ROLES,
    },
    passwordChangedAt: {
      type: Date,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,

    toJSON: {
      // Explicit parameter types: untyped ones make Mongoose infer every field as unknown.
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        const { _id, __v: _version, passwordHash: _passwordHash, ...rest } = ret;
        return { id: String(_id), ...rest };
      },
    },
  },
);

export type User = InferSchemaType<typeof userSchema>;

export const UserModel = model<User>("User", userSchema);

//
// DONE WHEN
//   - typecheck passes
//   - creating a user with "Priya@Acme.COM " stores "priya@acme.com"
//   - UserModel.findOne() result has no passwordHash; .select("+passwordHash") has it
//   - JSON.stringify(user) never contains passwordHash
//   (I'll write the tests once you're done.)
