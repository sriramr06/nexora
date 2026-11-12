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
  "invitation.viewAll": undefined;
  "invitation.manage": { invitedBy: string };
  "member.changeRole": undefined; // last-admin rule (R1) is checked in the transaction
  "member.remove": undefined;
  "org.leave": undefined;
}

export type Action = keyof PermissionContext;

type Rule<A extends Action> = (actor: Actor, context: PermissionContext[A]) => boolean;

const isAdmin = (actor: Actor) => actor.role === "admin";
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
  "invitation.viewAll": isAdmin,
  "invitation.manage": (actor, { invitedBy }) =>
    isAdmin(actor) || (actor.role === "project_manager" && invitedBy === actor.userId),
  "member.changeRole": isAdmin,
  "member.remove": isAdmin,
  "org.leave": anyRole,
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
