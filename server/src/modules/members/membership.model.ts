import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { ORG_ROLES } from "@nexora/shared";
import { tenantScoped } from "../../common/db/tenant-scope";

// Data model §4.3. Tenant-owned: every query must be scoped by organizationId.

const membershipSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ORG_ROLES, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

membershipSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
membershipSchema.index({ userId: 1 });
membershipSchema.index({ organizationId: 1, role: 1 });

membershipSchema.plugin(tenantScoped);

export type MembershipRecord = InferSchemaType<typeof membershipSchema>;
export type MembershipDoc = HydratedDocument<MembershipRecord>;

export const MembershipModel = model("Membership", membershipSchema);
