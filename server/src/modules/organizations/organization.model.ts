import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { INDUSTRIES, ORG_SIZES, ORG_STATUSES, ORG_TYPES } from "@nexora/shared";

// Data model §4.2. A global collection: the organization IS the tenant.

const statusHistorySchema = new Schema(
  {
    status: { type: String, enum: ORG_STATUSES, required: true },
    reason: { type: String },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    changedAt: { type: Date, required: true },
  },
  { _id: false },
);

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    type: { type: String, enum: ORG_TYPES, required: true },
    size: { type: String, enum: ORG_SIZES, required: true },
    industry: { type: String, enum: INDUSTRIES, required: true },
    country: { type: String, required: true },
    timezone: { type: String, required: true },
    website: { type: String, maxlength: 200 },
    description: { type: String, maxlength: 500 },
    status: { type: String, enum: ORG_STATUSES, required: true, default: "pending_approval" },
    statusHistory: { type: [statusHistorySchema], required: true, default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    // Bumped by every transaction that changes the set of admins (R1 write-skew guard).
    adminsVersion: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

organizationSchema.index({ status: 1, createdAt: 1 });
organizationSchema.index({ name: 1 });
// FR-ORG-09 enforced by the database: one Pending / Rejected organization per creator.
// Two parallel registrations cannot both pass, even though each checked "none open".
organizationSchema.index(
  { createdBy: 1 },
  {
    name: "one_open_registration_per_user",
    unique: true,
    partialFilterExpression: { status: { $in: ["pending_approval", "rejected"] } },
  },
);

export type OrganizationRecord = InferSchemaType<typeof organizationSchema>;
export type OrganizationDoc = HydratedDocument<OrganizationRecord>;

export const OrganizationModel = model("Organization", organizationSchema);
