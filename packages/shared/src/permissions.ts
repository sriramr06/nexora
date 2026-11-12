import type { OrgRole } from "./constants";

// TEN-7: permission rules implemented once, used by the server (authorize) and the
// client (hide / disable actions). Pure functions: the server loads the facts and
// passes them in; nothing here reads a database or trusts client-supplied roles.

export interface Actor {
  userId: string;
  role: OrgRole; // always from the stored membership (TEN-3)
}

// Facts each action needs. Actions without facts take `undefined`.
export interface PermissionContext {
  "org.view": undefined;
  "org.update": undefined;
  "member.view": undefined;
  // R11: Project Managers invite Team Members only, to projects they manage.
  "invitation.create": { role: OrgRole; projectIds: string[]; managedProjectIds: string[] };
  "invitation.view": undefined; // the invitations page: admins (all) and PMs (own)
  "invitation.viewAll": undefined;
  "invitation.manage": { invitedBy: string };
  "member.changeRole": undefined; // last-admin rule (R1) is checked in the transaction
  "member.remove": undefined;
  "org.leave": undefined;

  // Roles §5.2 — projects. "managerId / memberIds" are loaded by the server.
  "project.create": undefined;
  "project.viewAll": undefined;
  "project.view": ProjectFacts;
  "project.update": ProjectFacts; // details, archive / restore
  "project.setManager": undefined;
  "project.manageMembers": ProjectFacts;
  "project.delete": undefined;

  // Roles §5.3 — tasks (status changes and flags arrive with the board, Sprint 5).
  "task.create": ProjectFacts;
  "task.edit": ProjectFacts & TaskFacts;
  // Assign / reassign / unassign. Team Members may only self-assign an unassigned task.
  "task.assign": ProjectFacts & TaskFacts & { newAssigneeId: string | null };
  "task.delete": ProjectFacts;
}

export interface ProjectFacts {
  managerId: string | null;
  memberIds: string[];
}

export interface TaskFacts {
  assigneeId: string | null;
  createdBy: string;
}

export type Action = keyof PermissionContext;

type Rule<A extends Action> = (actor: Actor, context: PermissionContext[A]) => boolean;

const isAdmin = (actor: Actor) => actor.role === "admin";
const isPmOrAdmin = (actor: Actor) => actor.role === "admin" || actor.role === "project_manager";
// "Managed project": the actor is its manager (Roles §3.3). In projects they only belong
// to, Project Managers have Team Member permissions.
const manages = (actor: Actor, p: ProjectFacts) => p.managerId === actor.userId;
const belongs = (actor: Actor, p: ProjectFacts) => p.memberIds.includes(actor.userId);
const adminOrManager = (actor: Actor, p: ProjectFacts) => isAdmin(actor) || manages(actor, p);
const anyRole = () => true;

// Roles document, section 5.1 (Organization and Members).
const rules: { [A in Action]: Rule<A> } = {
  "org.view": anyRole,
  "org.update": isAdmin,
  "member.view": anyRole,
  "invitation.create": (actor, { role, projectIds, managedProjectIds }) => {
    if (isAdmin(actor)) return true;
    if (actor.role !== "project_manager") return false;
    return role === "member" && projectIds.every((id) => managedProjectIds.includes(id));
  },
  "invitation.view": (actor) => actor.role === "admin" || actor.role === "project_manager",
  "invitation.viewAll": isAdmin,
  "invitation.manage": (actor, { invitedBy }) =>
    isAdmin(actor) || (actor.role === "project_manager" && invitedBy === actor.userId),
  "member.changeRole": isAdmin,
  "member.remove": isAdmin,
  "org.leave": anyRole,

  "project.create": isPmOrAdmin,
  "project.viewAll": isAdmin,
  "project.view": (actor, p) => isAdmin(actor) || belongs(actor, p),
  "project.update": adminOrManager,
  "project.setManager": isAdmin,
  "project.manageMembers": adminOrManager,
  "project.delete": isAdmin,

  "task.create": (actor, p) => adminOrManager(actor, p) || belongs(actor, p),
  // Note 3: Team Members edit tasks assigned to them or created by them.
  "task.edit": (actor, f) =>
    adminOrManager(actor, f) ||
    (belongs(actor, f) && (f.assigneeId === actor.userId || f.createdBy === actor.userId)),
  "task.assign": (actor, f) => {
    if (adminOrManager(actor, f)) return true;
    // Self-assign an unassigned task in a member project (Roles §5.3).
    return belongs(actor, f) && f.assigneeId === null && f.newAssigneeId === actor.userId;
  },
  "task.delete": adminOrManager,
};

// Overloads keep call sites short: can(actor, "org.update") needs no context.
export function can<A extends Action>(
  actor: Actor,
  action: A,
  ...context: PermissionContext[A] extends undefined ? [] : [PermissionContext[A]]
): boolean;
export function can(actor: Actor, action: Action, context?: unknown): boolean {
  const rule = rules[action] as Rule<Action>;
  return rule(actor, context as never);
}
