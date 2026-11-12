// Domain values shared by client and server (docs/phase-3/data-model.md).
// Use the arrays with Mongoose (`enum: ORG_ROLES`) and Zod (`z.enum(ORG_ROLES)`),
// and the derived types in TypeScript.

// Roles
export const PLATFORM_ROLES = ["owner"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const ORG_ROLES = ["admin", "project_manager", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

// Organizations
export const ORG_STATUSES = ["pending_approval", "active", "rejected", "suspended"] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];

export const ORG_TYPES = ["product", "service", "both"] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export const ORG_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;
export type OrgSize = (typeof ORG_SIZES)[number];

export const INDUSTRIES = [
  "it_services",
  "software_product",
  "fintech",
  "healthtech",
  "edtech",
  "ecommerce_retail",
  "media_entertainment",
  "manufacturing",
  "consulting",
  "other",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

// Invitations ("expired" is computed, never stored)
export const INVITATION_STATUSES = ["pending", "accepted", "revoked"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

// Projects
export const PROJECT_STATUSES = ["active", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// Tasks
export const TASK_STATUSES = ["todo", "in_progress", "in_review", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_FLAG_TYPES = ["blocked", "on_hold"] as const;
export type TaskFlagType = (typeof TASK_FLAG_TYPES)[number];
