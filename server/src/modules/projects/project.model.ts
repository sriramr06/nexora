import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { PROJECT_STATUSES } from "@nexora/shared";
import { tenantScoped } from "../../common/db/tenant-scope";

// Data model §4.5. Members are embedded (DM-2) and always include the manager.
const projectSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    description: { type: String, maxlength: 2000 },
    managerId: { type: Schema.Types.ObjectId, ref: "User" },
    memberIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      required: true,
      default: [],
    },
    status: { type: String, enum: PROJECT_STATUSES, required: true, default: "active" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// Unique per organization, ignoring case ("Website" = "website"), archived included.
projectSchema.index(
  { organizationId: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);
projectSchema.index({ organizationId: 1, memberIds: 1 });

projectSchema.plugin(tenantScoped);

export type ProjectRecord = InferSchemaType<typeof projectSchema>;
export type ProjectDoc = HydratedDocument<ProjectRecord>;

export const ProjectModel = model("Project", projectSchema);
