import { z } from "zod";
import * as s from "@nexora/shared";

// OpenAPI 3.1 document generated from the same Zod schemas the routes validate with,
// so the docs cannot drift from the validation. Responses are described in words;
// the request side (bodies, query parameters) is exact.

type Method = "get" | "post" | "put" | "patch" | "delete";
type Access = "public" | "user" | "tenant" | "owner";

interface Op {
  method: Method;
  path: string;
  tag: string;
  summary: string;
  access: Access;
  body?: z.ZodType;
  query?: z.ZodObject;
  status?: number; // success status, default 200
}

const toSchema = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;

const ORG = "/orgs/{orgId}";

const OPS: Op[] = [
  // Auth
  {
    method: "post",
    path: "/auth/register",
    tag: "Auth",
    summary: "Create an account (sends a verification email)",
    access: "public",
    body: s.registerSchema,
    status: 201,
  },
  {
    method: "post",
    path: "/auth/verify-email",
    tag: "Auth",
    summary: "Verify an email address with the emailed token",
    access: "public",
    body: s.verifyEmailSchema,
  },
  {
    method: "post",
    path: "/auth/resend-verification",
    tag: "Auth",
    summary: "Send the verification email again",
    access: "user",
  },
  {
    method: "post",
    path: "/auth/login",
    tag: "Auth",
    summary: "Log in: returns an access token and sets the refresh cookie",
    access: "public",
    body: s.loginSchema,
  },
  {
    method: "post",
    path: "/auth/refresh",
    tag: "Auth",
    summary: "Rotate the refresh cookie and get a new access token",
    access: "public",
  },
  {
    method: "post",
    path: "/auth/logout",
    tag: "Auth",
    summary: "Revoke the refresh token family and clear the cookie",
    access: "public",
    status: 204,
  },
  {
    method: "post",
    path: "/auth/forgot-password",
    tag: "Auth",
    summary: "Email a password reset link (same answer whether or not the email exists)",
    access: "public",
    body: s.forgotPasswordSchema,
  },
  {
    method: "post",
    path: "/auth/reset-password",
    tag: "Auth",
    summary: "Set a new password with the emailed token",
    access: "public",
    body: s.resetPasswordSchema,
  },
  {
    method: "post",
    path: "/auth/change-password",
    tag: "Auth",
    summary: "Change password; other sessions are signed out",
    access: "user",
    body: s.changePasswordSchema,
  },
  // Me
  { method: "get", path: "/me", tag: "Me", summary: "The current user", access: "user" },
  {
    method: "patch",
    path: "/me",
    tag: "Me",
    summary: "Update name",
    access: "user",
    body: s.updateProfileSchema,
  },
  {
    method: "post",
    path: "/me/avatar",
    tag: "Me",
    summary: "Upload an avatar (multipart field `avatar`; JPEG, PNG or WebP up to 2 MB)",
    access: "user",
  },
  { method: "delete", path: "/me/avatar", tag: "Me", summary: "Remove the avatar", access: "user" },
  {
    method: "get",
    path: "/me/organizations",
    tag: "Me",
    summary: "Organizations I belong to (for the switcher)",
    access: "user",
  },
  {
    method: "get",
    path: "/users/{userId}/avatar",
    tag: "Me",
    summary: "A user's avatar image (public, cached by version)",
    access: "public",
  },
  // Organizations
  {
    method: "post",
    path: "/orgs",
    tag: "Organizations",
    summary: "Register an organization (one per user; starts Pending Approval)",
    access: "user",
    body: s.organizationDetailsSchema,
    status: 201,
  },
  {
    method: "get",
    path: ORG,
    tag: "Organizations",
    summary: "Organization details and my role",
    access: "tenant",
  },
  {
    method: "patch",
    path: ORG,
    tag: "Organizations",
    summary: "Update organization details (Tenant Admin)",
    access: "tenant",
    body: s.organizationDetailsSchema,
  },
  {
    method: "post",
    path: `${ORG}/resubmit`,
    tag: "Organizations",
    summary: "Resubmit a rejected organization",
    access: "tenant",
  },
  // Members and invitations
  {
    method: "get",
    path: `${ORG}/members`,
    tag: "Members",
    summary: "List members",
    access: "tenant",
    query: s.membersQuerySchema,
  },
  {
    method: "patch",
    path: `${ORG}/members/{userId}`,
    tag: "Members",
    summary: "Change a member's role (Tenant Admin; keeps at least one admin)",
    access: "tenant",
    body: s.changeRoleSchema,
  },
  {
    method: "delete",
    path: `${ORG}/members/{userId}`,
    tag: "Members",
    summary: "Remove a member (their open tasks are unassigned)",
    access: "tenant",
    status: 204,
  },
  {
    method: "post",
    path: `${ORG}/leave`,
    tag: "Members",
    summary: "Leave the organization",
    access: "tenant",
    status: 204,
  },
  {
    method: "get",
    path: `${ORG}/invitations`,
    tag: "Invitations",
    summary: "List invitations",
    access: "tenant",
    query: s.invitationsQuerySchema,
  },
  {
    method: "post",
    path: `${ORG}/invitations`,
    tag: "Invitations",
    summary: "Invite one person",
    access: "tenant",
    body: s.inviteSchema,
    status: 201,
  },
  {
    method: "post",
    path: `${ORG}/invitations/bulk`,
    tag: "Invitations",
    summary: "Invite several people at once",
    access: "tenant",
    body: s.bulkInviteSchema,
  },
  {
    method: "post",
    path: `${ORG}/invitations/{invitationId}/resend`,
    tag: "Invitations",
    summary: "Resend with a new token",
    access: "tenant",
  },
  {
    method: "post",
    path: `${ORG}/invitations/{invitationId}/revoke`,
    tag: "Invitations",
    summary: "Revoke a pending invitation",
    access: "tenant",
  },
  {
    method: "post",
    path: "/invitations/lookup",
    tag: "Invitations",
    summary: "What an invitation token is for (public)",
    access: "public",
    body: s.invitationTokenSchema,
  },
  {
    method: "post",
    path: "/invitations/register",
    tag: "Invitations",
    summary: "Create an account from an invitation and join",
    access: "public",
    body: s.invitationRegisterSchema,
    status: 201,
  },
  {
    method: "post",
    path: "/invitations/accept",
    tag: "Invitations",
    summary: "Accept an invitation as the logged-in user",
    access: "user",
    body: s.invitationTokenSchema,
  },
  // Projects
  {
    method: "get",
    path: `${ORG}/projects`,
    tag: "Projects",
    summary: "List projects I can see",
    access: "tenant",
    query: s.projectsQuerySchema,
  },
  {
    method: "post",
    path: `${ORG}/projects`,
    tag: "Projects",
    summary: "Create a project",
    access: "tenant",
    body: s.createProjectSchema,
    status: 201,
  },
  {
    method: "get",
    path: `${ORG}/projects/{projectId}`,
    tag: "Projects",
    summary: "Project details",
    access: "tenant",
  },
  {
    method: "patch",
    path: `${ORG}/projects/{projectId}`,
    tag: "Projects",
    summary: "Rename or describe",
    access: "tenant",
    body: s.updateProjectSchema,
  },
  {
    method: "put",
    path: `${ORG}/projects/{projectId}/manager`,
    tag: "Projects",
    summary: "Set the manager (Tenant Admin)",
    access: "tenant",
    body: s.setManagerSchema,
  },
  {
    method: "post",
    path: `${ORG}/projects/{projectId}/members`,
    tag: "Projects",
    summary: "Add members",
    access: "tenant",
    body: s.addProjectMembersSchema,
  },
  {
    method: "delete",
    path: `${ORG}/projects/{projectId}/members/{userId}`,
    tag: "Projects",
    summary: "Remove a member (their open tasks are unassigned)",
    access: "tenant",
  },
  {
    method: "get",
    path: `${ORG}/projects/{projectId}/activity`,
    tag: "Projects",
    summary: "Project activity feed, newest first (cursor)",
    access: "tenant",
    query: s.activityQuerySchema,
  },
  {
    method: "post",
    path: `${ORG}/projects/{projectId}/archive`,
    tag: "Projects",
    summary: "Archive (read-only)",
    access: "tenant",
  },
  {
    method: "post",
    path: `${ORG}/projects/{projectId}/restore`,
    tag: "Projects",
    summary: "Restore an archived project",
    access: "tenant",
  },
  {
    method: "delete",
    path: `${ORG}/projects/{projectId}`,
    tag: "Projects",
    summary: "Delete with its tasks, comments, activity and notifications",
    access: "tenant",
    status: 204,
  },
  // Tasks and board
  {
    method: "get",
    path: `${ORG}/projects/{projectId}/tasks`,
    tag: "Tasks",
    summary: "All tasks in a project",
    access: "tenant",
  },
  {
    method: "post",
    path: `${ORG}/projects/{projectId}/tasks`,
    tag: "Tasks",
    summary: "Create a task",
    access: "tenant",
    body: s.createTaskSchema,
    status: 201,
  },
  {
    method: "get",
    path: `${ORG}/projects/{projectId}/board`,
    tag: "Board",
    summary: "Tasks grouped by status, with filters",
    access: "tenant",
    query: s.boardQuerySchema,
  },
  {
    method: "get",
    path: `${ORG}/projects/{projectId}/summary`,
    tag: "Board",
    summary: "Progress summary (computed, never stored)",
    access: "tenant",
  },
  {
    method: "get",
    path: `${ORG}/projects/{projectId}/blocked-tasks`,
    tag: "Board",
    summary: "Blocked tasks, longest-blocked first",
    access: "tenant",
  },
  {
    method: "get",
    path: `${ORG}/tasks/{taskId}`,
    tag: "Tasks",
    summary: "Task details",
    access: "tenant",
  },
  {
    method: "patch",
    path: `${ORG}/tasks/{taskId}`,
    tag: "Tasks",
    summary: "Edit (optimistic concurrency: send the version you saw; 409 if stale)",
    access: "tenant",
    body: s.updateTaskSchema,
  },
  {
    method: "put",
    path: `${ORG}/tasks/{taskId}/assignee`,
    tag: "Tasks",
    summary: "Assign, reassign or unassign",
    access: "tenant",
    body: s.setAssigneeSchema,
  },
  {
    method: "delete",
    path: `${ORG}/tasks/{taskId}`,
    tag: "Tasks",
    summary: "Delete (history is kept)",
    access: "tenant",
    status: 204,
  },
  {
    method: "post",
    path: `${ORG}/tasks/{taskId}/status`,
    tag: "Workflow",
    summary: "Move to a status (review rule R14 applies)",
    access: "tenant",
    body: s.changeStatusSchema,
  },
  {
    method: "post",
    path: `${ORG}/tasks/{taskId}/request-changes`,
    tag: "Workflow",
    summary: "Send back from In Review with a reason",
    access: "tenant",
    body: s.requestChangesSchema,
  },
  {
    method: "put",
    path: `${ORG}/tasks/{taskId}/flag`,
    tag: "Workflow",
    summary: "Mark Blocked or On hold with a reason",
    access: "tenant",
    body: s.setFlagSchema,
  },
  {
    method: "delete",
    path: `${ORG}/tasks/{taskId}/flag`,
    tag: "Workflow",
    summary: "Clear the flag",
    access: "tenant",
    body: s.versionOnlySchema,
  },
  {
    method: "get",
    path: `${ORG}/tasks/{taskId}/activity`,
    tag: "Tasks",
    summary: "Task history, newest first (cursor)",
    access: "tenant",
    query: s.activityQuerySchema,
  },
  {
    method: "get",
    path: `${ORG}/my-tasks`,
    tag: "Tasks",
    summary: "Tasks assigned to me across projects",
    access: "tenant",
    query: s.myTasksQuerySchema,
  },
  // Comments
  {
    method: "get",
    path: `${ORG}/tasks/{taskId}/comments`,
    tag: "Comments",
    summary: "Comments, oldest first (cursor)",
    access: "tenant",
    query: s.activityQuerySchema,
  },
  {
    method: "post",
    path: `${ORG}/tasks/{taskId}/comments`,
    tag: "Comments",
    summary: "Add a comment (plain text)",
    access: "tenant",
    body: s.commentBodySchema,
    status: 201,
  },
  {
    method: "patch",
    path: `${ORG}/comments/{commentId}`,
    tag: "Comments",
    summary: "Edit my comment",
    access: "tenant",
    body: s.commentBodySchema,
  },
  {
    method: "delete",
    path: `${ORG}/comments/{commentId}`,
    tag: "Comments",
    summary: "Delete (author, project manager or admin)",
    access: "tenant",
    status: 204,
  },
  // Notifications
  {
    method: "get",
    path: `${ORG}/notifications`,
    tag: "Notifications",
    summary: "My notifications, newest first (cursor)",
    access: "tenant",
    query: s.activityQuerySchema,
  },
  {
    method: "get",
    path: `${ORG}/notifications/unread-count`,
    tag: "Notifications",
    summary: "Unread count (polled every 30 s)",
    access: "tenant",
  },
  {
    method: "post",
    path: `${ORG}/notifications/{notificationId}/read`,
    tag: "Notifications",
    summary: "Mark one as read",
    access: "tenant",
    status: 204,
  },
  {
    method: "post",
    path: `${ORG}/notifications/read-all`,
    tag: "Notifications",
    summary: "Mark all as read",
    access: "tenant",
    status: 204,
  },
  // Platform (Application Owner)
  {
    method: "get",
    path: "/platform/organizations",
    tag: "Platform",
    summary: "All organizations, filter by status, search by name",
    access: "owner",
    query: s.platformOrganizationsQuerySchema,
  },
  {
    method: "get",
    path: "/platform/organizations/{id}",
    tag: "Platform",
    summary: "Organization metadata (never projects or tasks)",
    access: "owner",
  },
  {
    method: "patch",
    path: "/platform/organizations/{id}",
    tag: "Platform",
    summary: "Rename",
    access: "owner",
    body: s.renameOrganizationSchema,
  },
  {
    method: "post",
    path: "/platform/organizations/{id}/approve",
    tag: "Platform",
    summary: "Approve a pending organization",
    access: "owner",
  },
  {
    method: "post",
    path: "/platform/organizations/{id}/reject",
    tag: "Platform",
    summary: "Reject with a reason (emailed to its admins)",
    access: "owner",
    body: s.statusReasonSchema,
  },
  {
    method: "post",
    path: "/platform/organizations/{id}/suspend",
    tag: "Platform",
    summary: "Suspend with a reason (members lose access)",
    access: "owner",
    body: s.statusReasonSchema,
  },
  {
    method: "post",
    path: "/platform/organizations/{id}/reactivate",
    tag: "Platform",
    summary: "Reactivate a suspended organization",
    access: "owner",
  },
  // System
  {
    method: "get",
    path: "/health",
    tag: "System",
    summary: "Liveness, database state and deployed version",
    access: "public",
  },
];

const ACCESS_NOTE: Record<Access, string> = {
  public: "No login needed.",
  user: "Logged-in user.",
  tenant:
    "Member of the organization. Another organization's IDs answer 404, never 403 (tenant isolation). Role rules are listed in the summary.",
  owner: "Application Owner only.",
};

const pathParams = (path: string) =>
  [...path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string", pattern: "^[a-f0-9]{24}$" },
  }));

const queryParams = (query?: z.ZodObject) => {
  if (!query) return [];
  const json = toSchema(query) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  return Object.entries(json.properties ?? {}).map(([name, schema]) => ({
    name,
    in: "query",
    required: json.required?.includes(name) ?? false,
    schema,
  }));
};

const responses = (op: Op) => {
  const ok = op.status ?? 200;
  return {
    [ok]: { description: ok === 204 ? "Done (no content)" : "Success: `{ data }`" },
    "400": { description: "Validation failed: `{ error: { code, message, details } }`" },
    ...(op.access !== "public" ? { "401": { description: "Not logged in" } } : {}),
    ...(op.access !== "public" ? { "403": { description: "Not allowed (with a reason)" } } : {}),
    "404": { description: "Not found — also any other organization's resource" },
    "409": { description: "Conflict (duplicate, or stale version)" },
  };
};

let cached: object | undefined;

export const openApiDocument = () =>
  (cached ??= {
    openapi: "3.1.0",
    info: {
      title: "Nexora API",
      version: "1.0.0",
      description:
        "Multi-tenant project management. Every tenant route is under `/orgs/{orgId}`. " +
        "Send the access token as `Authorization: Bearer …`; the refresh token lives in an " +
        "httpOnly cookie. Errors are `{ error: { code, message } }`.",
    },
    servers: [{ url: "/api/v1" }],
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    },
    paths: OPS.reduce<Record<string, Record<string, object>>>((paths, op) => {
      (paths[op.path] ??= {})[op.method] = {
        tags: [op.tag],
        summary: op.summary,
        description: ACCESS_NOTE[op.access],
        ...(op.access === "public" ? {} : { security: [{ bearer: [] }] }),
        parameters: [...pathParams(op.path), ...queryParams(op.query)],
        ...(op.body
          ? {
              requestBody: {
                required: true,
                content: { "application/json": { schema: toSchema(op.body) } },
              },
            }
          : {}),
        responses: responses(op),
      };
      return paths;
    }, {}),
  });

export const OPERATION_COUNT = OPS.length;
