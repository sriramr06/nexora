import type { Types } from "mongoose";
import {
  canComment,
  canDeleteComment,
  canEditComment,
  type Comment,
  type CursorPage,
} from "@nexora/shared";
import { AppError } from "../../common/errors/app-error";
import { forTenant } from "../../common/db/tenant-scope";
import { withTransaction } from "../../common/db/transaction";
import type { AuthUser } from "../../common/middleware/authenticate";
import type { TenantContext } from "../../common/middleware/tenancy";
import { recordActivity } from "../activity/activity.service";
import { actorOf, assertActive, factsOf, loadProject } from "../projects/project.service";
import { loadTask } from "../tasks/task.service";
import { UserModel } from "../users/user.model";
import { CommentModel, type CommentRecord } from "./comment.model";

type Id = Types.ObjectId;
const commentNotFound = () => AppError.notFound("Comment not found.");

const toComments = async (rows: (CommentRecord & { _id: Id })[]): Promise<Comment[]> => {
  const users = await UserModel.find({ _id: { $in: rows.map((r) => r.authorId) } })
    .select("name avatar")
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return rows.map((r) => {
    const author = byId.get(String(r.authorId));
    return {
      id: String(r._id),
      taskId: String(r.taskId),
      author: author
        ? { id: String(author._id), name: author.name, avatarUrl: author.avatar?.url ?? null }
        : null,
      body: r.body,
      editedAt: r.editedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  });
};

const encodeCursor = (c: { createdAt: Date; _id: Id }) =>
  Buffer.from(`${c.createdAt.toISOString()}|${String(c._id)}`).toString("base64url");

const decodeCursor = (cursor: string) => {
  const [at, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const date = new Date(at ?? "");
  if (!id || Number.isNaN(date.getTime()) || !/^[a-f0-9]{24}$/.test(id)) {
    throw AppError.validation("Invalid cursor.");
  }
  return { date, id };
};

// FR-COM-02: oldest first, keyset-paginated on (createdAt, _id).
export const listComments = async (
  tenant: TenantContext,
  taskId: string,
  { cursor, limit }: { cursor?: string; limit: number },
): Promise<CursorPage<Comment>> => {
  const { task } = await loadTask(tenant, taskId);
  const after = cursor ? decodeCursor(cursor) : null;
  const rows = await forTenant(CommentModel, tenant.organization._id)
    .find({
      taskId: task._id,
      ...(after
        ? {
            $or: [
              { createdAt: { $gt: after.date } },
              { createdAt: after.date, _id: { $gt: after.id } },
            ],
          }
        : {}),
    })
    .sort({ createdAt: 1, _id: 1 })
    .limit(limit + 1)
    .lean();
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  return {
    data: await toComments(page),
    pagination: { nextCursor: hasMore ? encodeCursor(page.at(-1)!) : null, hasMore },
  };
};

// FR-COM-01
export const addComment = async (
  tenant: TenantContext,
  user: AuthUser,
  taskId: string,
  body: string,
): Promise<Comment> => {
  const { task, project } = await loadTask(tenant, taskId);
  assertActive(project); // R7
  if (!canComment(actorOf(tenant), factsOf(project))) throw AppError.forbidden();

  const created = await withTransaction(async (session) => {
    const comment = await forTenant(CommentModel, tenant.organization._id).create(
      { projectId: project._id, taskId: task._id, authorId: user._id, body } as never,
      session,
    );
    await recordActivity(session, {
      organizationId: tenant.organization._id,
      projectId: project._id,
      taskId: task._id,
      actorId: user._id,
      action: "comment.added",
      snapshot: { projectName: project.name, taskTitle: task.title },
    });
    return comment;
  });
  return (await toComments([created.toObject()]))[0]!;
};

// Comments are reached by ID, but checked through their project like tasks (404 otherwise).
const loadComment = async (tenant: TenantContext, commentId: string) => {
  const comment = await forTenant(CommentModel, tenant.organization._id)
    .findById(commentId)
    .catch(() => null);
  if (!comment) throw commentNotFound();
  const project = await loadProject(tenant, String(comment.projectId)).catch(() => {
    throw commentNotFound();
  });
  return { comment, project };
};

// FR-COM-03: authors only; marked "edited".
export const editComment = async (
  tenant: TenantContext,
  commentId: string,
  body: string,
): Promise<Comment> => {
  const { comment, project } = await loadComment(tenant, commentId);
  assertActive(project);
  if (!canEditComment(actorOf(tenant), String(comment.authorId))) {
    throw AppError.forbidden("You can only edit your own comments.");
  }
  if (comment.body !== body) {
    comment.set({ body, editedAt: new Date() });
    await comment.save();
  }
  return (await toComments([comment.toObject()]))[0]!;
};

// FR-COM-04: author, the project's manager or a Tenant Admin. The text is not kept anywhere.
export const deleteComment = async (tenant: TenantContext, user: AuthUser, commentId: string) => {
  const { comment, project } = await loadComment(tenant, commentId);
  assertActive(project);
  if (!canDeleteComment(actorOf(tenant), factsOf(project), String(comment.authorId))) {
    throw AppError.forbidden("You can only delete your own comments.");
  }
  const task = await loadTask(tenant, String(comment.taskId)).catch(() => null);

  await withTransaction(async (session) => {
    await CommentModel.deleteOne(
      { _id: comment._id, organizationId: tenant.organization._id },
      { session },
    );
    await recordActivity(session, {
      organizationId: tenant.organization._id,
      projectId: project._id,
      taskId: comment.taskId,
      actorId: user._id,
      action: "comment.deleted",
      snapshot: { projectName: project.name, taskTitle: task?.task.title },
    });
  });
};
