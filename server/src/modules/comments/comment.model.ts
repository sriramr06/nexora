import { Schema, model, type InferSchemaType } from "mongoose";
import { tenantScoped } from "../../common/db/tenant-scope";

// Data model §4.7. Plain text only; rendered as text, never HTML (NFR-SEC-06).
const commentSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, minlength: 1, maxlength: 2000 },
    editedAt: { type: Date },
  },
  { timestamps: true },
);

commentSchema.index({ organizationId: 1, taskId: 1, createdAt: 1, _id: 1 });
commentSchema.index({ organizationId: 1, projectId: 1 });

commentSchema.plugin(tenantScoped);

export type CommentRecord = InferSchemaType<typeof commentSchema>;

export const CommentModel = model("Comment", commentSchema);
