import type { TaskFlagType, TaskStatus } from "./constants";
import type { Actor, ProjectFacts, TaskFacts } from "./permissions";

// The review and blocker workflow (Roles §5.3, R14 – R16) in one place. Pure: the
// server enforces it, and the board uses the same reasons when it reverts a drop.

export interface WorkflowFacts extends ProjectFacts, TaskFacts {
  status: TaskStatus;
  flag: TaskFlagType | null;
}

export type Decision = { ok: true } | { ok: false; reason: string };

const allow: Decision = { ok: true };
const deny = (reason: string): Decision => ({ ok: false, reason });

const isManager = (actor: Actor, f: ProjectFacts) =>
  actor.role === "admin" || f.managerId === actor.userId;
const isAssignee = (actor: Actor, f: TaskFacts) => f.assigneeId === actor.userId;

// Assignee moves (Roles §5.3): To Do ↔ In Progress → In Review, and withdraw In Review → In Progress.
const ASSIGNEE_MOVES: Partial<Record<TaskStatus, TaskStatus[]>> = {
  todo: ["in_progress"],
  in_progress: ["todo", "in_review"],
  in_review: ["in_progress"],
};

export function statusChange(actor: Actor, f: WorkflowFacts, to: TaskStatus): Decision {
  if (f.status === to) return deny("The task is already in that column.");
  const manager = isManager(actor, f);

  // R16: while Blocked, only the project's manager or a Tenant Admin moves the task.
  if (f.flag === "blocked" && !manager) {
    return deny("This task is blocked. Ask the project's manager to clear the blocker first.");
  }

  if (manager) {
    // Managers moving In Review back without being the assignee are requesting changes,
    // which needs a reason (R14) — a separate action.
    if (f.status === "in_review" && to === "in_progress" && !isAssignee(actor, f)) {
      return deny("Use “Request changes” and give a reason.");
    }
    return allow; // incl. approve (→ Done from any status) and reopen (Done → To Do / In Progress)
  }

  if (!isAssignee(actor, f)) {
    return deny("Only the assignee or the project's manager can move this task.");
  }
  if (to === "done") return deny("Submit for review instead. The project's manager marks it Done.");
  if (f.status === "done") return deny("Only the project's manager can reopen a done task.");
  if (!ASSIGNEE_MOVES[f.status]?.includes(to)) {
    return deny("Move the task to In Progress first.");
  }
  return allow;
}

// R14: In Review → In Progress with a reason, by the project's manager or a Tenant Admin.
export function requestChanges(actor: Actor, f: WorkflowFacts): Decision {
  if (!isManager(actor, f)) return deny("Only the project's manager can request changes.");
  if (f.status !== "in_review") return deny("Only tasks in review can be sent back.");
  return allow;
}

// R15 / R16: flag with a reason; never on Done tasks.
export function setFlag(actor: Actor, f: WorkflowFacts, type: TaskFlagType): Decision {
  if (f.status === "done") return deny("Done tasks cannot be flagged.");
  if (!isManager(actor, f) && !isAssignee(actor, f)) {
    return deny("Only the assignee or the project's manager can flag this task.");
  }
  if (f.flag === type)
    return deny(`The task is already ${type === "blocked" ? "blocked" : "on hold"}.`);
  // Replacing Blocked with On hold would clear a blocker without a manager.
  if (f.flag === "blocked" && !isManager(actor, f)) {
    return deny("Only the project's manager can clear a blocker.");
  }
  return allow;
}

// R16: Blocked is cleared only by the manager or a Tenant Admin; On hold also by the assignee.
export function clearFlag(actor: Actor, f: WorkflowFacts): Decision {
  if (!f.flag) return deny("The task has no flag.");
  if (isManager(actor, f)) return allow;
  if (f.flag === "blocked") return deny("Only the project's manager can clear a blocker.");
  return isAssignee(actor, f)
    ? allow
    : deny("Only the assignee or the project's manager can clear this.");
}

// Comments (Roles §5.4): members comment; authors edit; authors, the manager and admins delete.
export const canComment = (actor: Actor, f: ProjectFacts) =>
  actor.role === "admin" || f.memberIds.includes(actor.userId);
export const canEditComment = (actor: Actor, authorId: string) => actor.userId === authorId;
export const canDeleteComment = (actor: Actor, f: ProjectFacts, authorId: string) =>
  actor.userId === authorId || isManager(actor, f);
