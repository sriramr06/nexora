import { Schema, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { TASK_FLAG_TYPES, TASK_PRIORITIES, TASK_STATUSES } from "@nexora/shared";
import { tenantScoped } from "../../common/db/tenant-scope";

// Data model §4.6.
const flagSchema = new Schema(
  {
    type: { type: String, enum: TASK_FLAG_TYPES, required: true },
    reason: { type: String, required: true, maxlength: 500 },
    setBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    setAt: { type: Date, required: true },
  },
  { _id: false },
);

const taskSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    description: { type: String, maxlength: 5000 },
    status: { type: String, enum: TASK_STATUSES, required: true, default: "todo" },
    priority: { type: String, enum: TASK_PRIORITIES, required: true, default: "medium" },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User" },
    dueDate: { type: Date }, // UTC midnight of the calendar date
    flag: { type: flagSchema },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Optimistic concurrency (API design §6): every change must name the version it saw.
    version: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

taskSchema.index({ organizationId: 1, projectId: 1, status: 1 });
taskSchema.index({ organizationId: 1, assigneeId: 1, status: 1 });
taskSchema.index({ organizationId: 1, projectId: 1, "flag.type": 1 });

taskSchema.plugin(tenantScoped);

export type TaskRecord = InferSchemaType<typeof taskSchema>;
export type TaskDoc = HydratedDocument<TaskRecord>;

export const TaskModel = model("Task", taskSchema);
