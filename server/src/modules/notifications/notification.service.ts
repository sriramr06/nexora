import type { ClientSession, Types } from "mongoose";
import type { CursorPage, Notification, NotificationData, NotificationType } from "@nexora/shared";
import { afterCursor, encodeCursor } from "../../common/db/cursor";
import { forTenant } from "../../common/db/tenant-scope";
import { AppError } from "../../common/errors/app-error";
import type { TenantContext } from "../../common/middleware/tenancy";
import { MembershipModel } from "../members/membership.model";
import { UserModel } from "../users/user.model";
import { NotificationModel } from "./notification.model";

type Id = Types.ObjectId;

export interface NotifyEvent {
  organizationId: Id;
  actorId: Id;
  projectId?: Id;
  taskId?: Id;
  data: NotificationData;
}

export interface Audience {
  type: NotificationType;
  recipients: (Id | null | undefined)[];
  data?: NotificationData; // extra fields for this audience only
}

/**
 * The only way notifications are created (integrations §5.2). Called with the session of
 * the change, so the change and its notifications commit together (INT-5).
 *
 * Audiences are listed most specific first; each recipient gets one notification per
 * action — the first audience that names them wins. The actor is never notified (FR-NOT-02).
 */
export const notify = async (
  session: ClientSession,
  event: NotifyEvent,
  ...audiences: Audience[]
) => {
  const seen = new Set([String(event.actorId)]);
  const docs = [];
  for (const { type, recipients, data } of audiences) {
    for (const recipient of recipients) {
      if (!recipient || seen.has(String(recipient))) continue;
      seen.add(String(recipient));
      docs.push({
        organizationId: event.organizationId,
        recipientId: recipient,
        type,
        actorId: event.actorId,
        projectId: event.projectId,
        taskId: event.taskId,
        data: { ...event.data, ...data },
      });
    }
  }
  if (docs.length > 0) await NotificationModel.insertMany(docs, { session });
};

export const tenantAdminIds = async (organizationId: Id, session?: ClientSession) =>
  (
    await MembershipModel.find({ organizationId, role: "admin" }, null, { session })
      .select("userId")
      .lean()
  ).map((m) => m.userId);

// Who acts on reviews and blockers: the project's manager, or — when the project has
// none (R6) — every Tenant Admin, since they can act on any project.
export const reviewersOf = async (
  organizationId: Id,
  project: { managerId?: Id | null },
  session?: ClientSession,
): Promise<Id[]> =>
  project.managerId ? [project.managerId] : tenantAdminIds(organizationId, session);

// ---------- reading (FR-NOT-03 – 07) ----------

const scoped = (tenant: TenantContext) => ({
  repo: forTenant(NotificationModel, tenant.organization._id),
  recipientId: tenant.membership.userId,
});

export const listNotifications = async (
  tenant: TenantContext,
  { cursor, limit }: { cursor?: string; limit: number },
): Promise<CursorPage<Notification>> => {
  const { repo, recipientId } = scoped(tenant);
  const rows = await repo
    .find({ recipientId, ...afterCursor(cursor, "newest") })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  const actors = await UserModel.find({ _id: { $in: page.map((n) => n.actorId) } })
    .select("name avatar")
    .lean();
  const byId = new Map(actors.map((u) => [String(u._id), u]));

  return {
    data: page.map((n) => {
      const actor = n.actorId ? byId.get(String(n.actorId)) : undefined;
      return {
        id: String(n._id),
        type: n.type,
        actor: actor
          ? { id: String(actor._id), name: actor.name, avatarUrl: actor.avatar?.url ?? null }
          : null,
        projectId: n.projectId ? String(n.projectId) : null,
        taskId: n.taskId ? String(n.taskId) : null,
        data: Object.fromEntries(
          Object.entries(n.data ?? {}).filter(([, v]) => v !== undefined && v !== null),
        ),
        read: Boolean(n.readAt),
        createdAt: n.createdAt.toISOString(),
      };
    }),
    pagination: { nextCursor: hasMore ? encodeCursor(page.at(-1)!) : null, hasMore },
  };
};

export const unreadCount = async (tenant: TenantContext) => {
  const { repo, recipientId } = scoped(tenant);
  return { count: await repo.countDocuments({ recipientId, readAt: { $exists: false } }) };
};

// Recipient only: someone else's notification is "not found".
export const markRead = async (tenant: TenantContext, notificationId: string) => {
  const { repo, recipientId } = scoped(tenant);
  const found = await repo.findOne({ _id: notificationId, recipientId }).catch(() => null);
  if (!found) throw AppError.notFound("Notification not found.");
  if (!found.readAt) {
    found.readAt = new Date();
    await found.save();
  }
};

export const markAllRead = async (tenant: TenantContext) => {
  await NotificationModel.updateMany(
    {
      organizationId: tenant.organization._id,
      recipientId: tenant.membership.userId,
      readAt: { $exists: false },
    },
    { $set: { readAt: new Date() } },
  );
};
