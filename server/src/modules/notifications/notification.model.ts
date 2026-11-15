import { Schema, model, type InferSchemaType } from "mongoose";
import { NOTIFICATION_TYPES } from "@nexora/shared";
import { tenantScoped } from "../../common/db/tenant-scope";

const NINETY_DAYS = 90 * 24 * 60 * 60;

// Data model §4.9 — only type, link targets and a display snapshot; no rendered text.
const notificationSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    taskId: { type: Schema.Types.ObjectId, ref: "Task" },
    data: {
      taskTitle: String,
      projectName: String,
      status: String,
      reason: String,
      memberName: String,
      count: Number,
    },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ organizationId: 1, recipientId: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ organizationId: 1, recipientId: 1, readAt: 1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NINETY_DAYS }); // DM-7

notificationSchema.plugin(tenantScoped);

export type NotificationRecord = InferSchemaType<typeof notificationSchema>;

export const NotificationModel = model("Notification", notificationSchema);
