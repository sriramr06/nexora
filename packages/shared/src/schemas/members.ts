import { z } from "zod";
import { ORG_ROLES, type OrgRole } from "../constants";
import { emailSchema, nameSchema, passwordSchema, tokenSchema } from "./auth";

// ---------- invitations (FR-INV) ----------

export const INVITATION_LIST_STATUSES = ["pending", "accepted", "revoked", "expired"] as const;
export type InvitationListStatus = (typeof INVITATION_LIST_STATUSES)[number];

const projectIdsSchema = z
  .array(z.string().regex(/^[a-f0-9]{24}$/i, "Invalid project."))
  .max(50)
  .default([]);

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(ORG_ROLES, "Select a role."),
  projectIds: projectIdsSchema, // R13: added on acceptance if still active
});
export type InviteInput = z.input<typeof inviteSchema>;

// FR-INV-12: up to 20 addresses, one role. Each address is validated on its own, so one
// bad address is reported instead of failing the whole request.
export const bulkInviteSchema = z.object({
  emails: z
    .array(z.string().trim().min(1))
    .min(1, "Enter at least one email address.")
    .max(20, "You can invite up to 20 people at a time."),
  role: z.enum(ORG_ROLES, "Select a role."),
  projectIds: projectIdsSchema,
});
export type BulkInviteInput = z.input<typeof bulkInviteSchema>;

export const invitationsQuerySchema = z.object({
  status: z.enum(INVITATION_LIST_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const invitationTokenSchema = z.object({ token: tokenSchema });

export const invitationRegisterSchema = z.object({
  token: tokenSchema,
  name: nameSchema,
  password: passwordSchema,
});
export type InvitationRegisterInput = z.input<typeof invitationRegisterSchema>;

export interface Invitation {
  id: string;
  email: string;
  role: OrgRole;
  status: InvitationListStatus; // "expired" is computed, never stored
  invitedBy: { id: string; name: string } | null;
  projects: { id: string; name: string }[]; // pre-selected (R13)
  lastSentAt: string;
  expiresAt: string;
  createdAt: string;
}

export interface InviteResult {
  invitation: Invitation;
  emailSent: boolean; // false → the UI offers "Resend" (integrations: email failure)
}

export type BulkInviteOutcome = "sent" | "email_failed" | "skipped";

export interface BulkInviteResult {
  email: string;
  outcome: BulkInviteOutcome;
  reason?: string;
}

// POST /invitations/lookup — what the invited person sees before accepting.
export type InvitationState =
  "valid" | "expired" | "revoked" | "accepted" | "organization_inactive";

export interface InvitationLookup {
  organizationName: string;
  email: string;
  role: OrgRole;
  invitedBy: string | null;
  state: InvitationState;
  accountExists: boolean; // register vs. "log in to accept"
}

// ---------- members (FR-MEM) ----------

export const membersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const changeRoleSchema = z.object({ role: z.enum(ORG_ROLES, "Select a role.") });

export interface Member {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: OrgRole;
  joinedAt: string;
}

// ---------- profile (FR-PROF) ----------

export const updateProfileSchema = z.object({ name: nameSchema });

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
