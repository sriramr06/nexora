import type { ClientSession, Types } from "mongoose";
import type { ActivityAction, ActivityEntry, CursorPage } from "@nexora/shared";
import { AppError } from "../../common/errors/app-error";
import { UserModel } from "../users/user.model";
import { ActivityModel, type ActivityRecord } from "./activity.model";

type Id = Types.ObjectId;

export interface ActivityInput {
  organizationId: Id;
  projectId: Id;
  taskId?: Id;
  actorId: Id;
  action: ActivityAction;
  changes?: Record<string, { from: unknown; to: unknown }>;
  reason?: string;
  snapshot: { projectName: string; taskTitle?: string };
}

// FR-ACT-02: always called with the session of the change it describes, so the change
// and its history entry commit together or not at all.
export const recordActivity = async (session: ClientSession, ...entries: ActivityInput[]) => {
  if (entries.length === 0) return;
  await ActivityModel.create(entries, { session, ordered: true });
};

// ---------- reading (cursor-based, newest first) ----------

const encodeCursor = (doc: { createdAt: Date; _id: Id }) =>
  Buffer.from(`${doc.createdAt.toISOString()}|${String(doc._id)}`).toString("base64url");

const decodeCursor = (cursor: string) => {
  const [at, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const date = new Date(at ?? "");
  if (!id || Number.isNaN(date.getTime()) || !/^[a-f0-9]{24}$/.test(id)) {
    throw AppError.validation("Invalid cursor.");
  }
  return { date, id };
};

const userIdsIn = (entries: ActivityRecord[]) => {
  const ids = new Set<string>();
  for (const e of entries) {
    ids.add(String(e.actorId));
    for (const change of Object.values(
      (e.changes ?? {}) as Record<string, { from: unknown; to: unknown }>,
    )) {
      for (const v of [change.from, change.to])
        if (typeof v === "string" && /^[a-f0-9]{24}$/.test(v)) ids.add(v);
    }
  }
  return [...ids];
};

// Shared by the task history (FR-ACT-03) and, in Sprint 6, the project feed (FR-ACT-04).
export const listActivity = async (
  filter: { organizationId: Id; taskId?: Id; projectId?: Id },
  { cursor, limit }: { cursor?: string; limit: number },
): Promise<CursorPage<ActivityEntry>> => {
  const query: Record<string, unknown> = { ...filter };
  if (cursor) {
    const { date, id } = decodeCursor(cursor);
    // Keyset pagination on (createdAt, _id): stable even when new entries arrive.
    query.$or = [{ createdAt: { $lt: date } }, { createdAt: date, _id: { $lt: id } }];
  }

  const docs = await ActivityModel.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const hasMore = docs.length > limit;
  const page = docs.slice(0, limit);

  const users = await UserModel.find({ _id: { $in: userIdsIn(page) } })
    .select("name avatar")
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  return {
    data: page.map((e) => {
      const actor = byId.get(String(e.actorId));
      const names: Record<string, string> = {};
      for (const id of userIdsIn([e])) {
        const u = byId.get(id);
        if (u) names[id] = u.name;
      }
      return {
        id: String(e._id),
        action: e.action,
        actor: actor
          ? { id: String(actor._id), name: actor.name, avatarUrl: actor.avatar?.url ?? null }
          : null,
        taskId: e.taskId ? String(e.taskId) : null,
        changes: (e.changes ?? undefined) as ActivityEntry["changes"],
        reason: e.reason ?? undefined,
        snapshot: {
          projectName: e.snapshot?.projectName ?? "",
          taskTitle: e.snapshot?.taskTitle ?? undefined,
        },
        users: names,
        createdAt: e.createdAt.toISOString(),
      };
    }),
    pagination: { nextCursor: hasMore ? encodeCursor(page.at(-1)!) : null, hasMore },
  };
};
