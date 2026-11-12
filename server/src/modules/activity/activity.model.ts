import { Schema, model, type InferSchemaType } from "mongoose";
import { ACTIVITY_ACTIONS } from "@nexora/shared";
import { tenantScoped } from "../../common/db/tenant-scope";

// Data model §4.8 — append-only (FR-ACT-05): no updatedAt, no edit or delete endpoints.
const activitySchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task" },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, enum: ACTIVITY_ACTIONS, required: true },
    changes: { type: Schema.Types.Mixed }, // { field: { from, to } }
    reason: { type: String, maxlength: 500 },
    // Values at the time of the action (DM-4): history still reads right after renames.
    snapshot: {
      projectName: { type: String, required: true },
      taskTitle: { type: String },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

activitySchema.index({ organizationId: 1, projectId: 1, createdAt: -1, _id: -1 });
activitySchema.index({ organizationId: 1, taskId: 1, createdAt: -1, _id: -1 });

activitySchema.plugin(tenantScoped);

export type ActivityRecord = InferSchemaType<typeof activitySchema>;

export const ActivityModel = model("Activity", activitySchema);
