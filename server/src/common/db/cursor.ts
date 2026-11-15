import type { Types } from "mongoose";
import { AppError } from "../errors/app-error";

// Keyset pagination on (createdAt, _id) for feeds (API design §5): stable when new entries
// arrive while paging — no duplicates, no gaps. Used by activity, comments, notifications.

export const encodeCursor = (doc: { createdAt: Date; _id: Types.ObjectId }) =>
  Buffer.from(`${doc.createdAt.toISOString()}|${String(doc._id)}`).toString("base64url");

const decodeCursor = (cursor: string) => {
  const [at, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const date = new Date(at ?? "");
  if (!id || Number.isNaN(date.getTime()) || !/^[a-f0-9]{24}$/.test(id)) {
    throw AppError.validation("Invalid cursor.");
  }
  return { date, id };
};

// Filter for "entries after this cursor" in the given sort direction.
export const afterCursor = (cursor: string | undefined, direction: "newest" | "oldest") => {
  if (!cursor) return {};
  const { date, id } = decodeCursor(cursor);
  const op = direction === "newest" ? "$lt" : "$gt";
  return { $or: [{ createdAt: { [op]: date } }, { createdAt: date, _id: { [op]: id } }] };
};
