import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { INVITATION_STATUSES, ORG_ROLES } from "@nexora/shared";
import { tenantScoped } from "../../common/db/tenant-scope";

// Data model §4.4. "Expired" is computed (pending + expiresAt in the past), never stored.

const invitationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ORG_ROLES, required: true },
    // R13: projects to join on acceptance (only those still active then).
    projectIds: { type: [{ type: Schema.Types.ObjectId, ref: "Project" }], default: [] },
    tokenHash: { type: String, required: true },
    status: { type: String, enum: INVITATION_STATUSES, required: true, default: "pending" },
    expiresAt: { type: Date, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    lastSentAt: { type: Date, required: true },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User" },
    acceptedAt: { type: Date },
    revokedBy: { type: Schema.Types.ObjectId, ref: "User" }, // absent when revoked by the system (R12)
    revokedAt: { type: Date },
  },
  { timestamps: true },
);

invitationSchema.index({ tokenHash: 1 }, { unique: true });
// FR-INV-04: at most one pending invitation per email per organization — enforced by the DB.
invitationSchema.index(
  { organizationId: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
invitationSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
invitationSchema.index({ organizationId: 1, invitedBy: 1 });

invitationSchema.plugin(tenantScoped);

export type InvitationRecord = InferSchemaType<typeof invitationSchema>;
export type InvitationDoc = HydratedDocument<InvitationRecord>;

export const InvitationModel = model("Invitation", invitationSchema);
