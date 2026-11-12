// Cross-tenant harness registry (US-33, NFR-ISO-07).
//
// Every tenant endpoint (/orgs/:orgId/...) is listed here. The cross-tenant suite calls
// each one as a member of Organization A against Organization B and expects 404 —
// so a new endpoint is covered by adding one line. Later sprints extend this list
// (members, invitations, projects, tasks, comments, activity, notifications).

export interface TenantEndpoint {
  method: "get" | "post" | "patch" | "delete";
  path: (orgId: string) => string;
  body?: object;
}

// A syntactically valid ID; the organization check must reject before it is ever used.
const ANY_ID = "665f1c2e9b1d4a0012345678";

const orgDetails = {
  name: "Hijacked",
  type: "product",
  size: "1-10",
  industry: "other",
  country: "IN",
  timezone: "Asia/Kolkata",
};

export const TENANT_ENDPOINTS: TenantEndpoint[] = [
  { method: "get", path: (o) => `/api/v1/orgs/${o}` },
  { method: "patch", path: (o) => `/api/v1/orgs/${o}`, body: orgDetails },
  { method: "post", path: (o) => `/api/v1/orgs/${o}/resubmit` },
  // Sprint 3: members and invitations
  { method: "get", path: (o) => `/api/v1/orgs/${o}/members` },
  { method: "patch", path: (o) => `/api/v1/orgs/${o}/members/${ANY_ID}`, body: { role: "admin" } },
  { method: "delete", path: (o) => `/api/v1/orgs/${o}/members/${ANY_ID}` },
  { method: "post", path: (o) => `/api/v1/orgs/${o}/leave` },
  { method: "get", path: (o) => `/api/v1/orgs/${o}/invitations` },
  {
    method: "post",
    path: (o) => `/api/v1/orgs/${o}/invitations`,
    body: { email: "x@evil.test", role: "admin" },
  },
  {
    method: "post",
    path: (o) => `/api/v1/orgs/${o}/invitations/bulk`,
    body: { emails: ["x@evil.test"], role: "admin" },
  },
  { method: "post", path: (o) => `/api/v1/orgs/${o}/invitations/${ANY_ID}/resend` },
  { method: "post", path: (o) => `/api/v1/orgs/${o}/invitations/${ANY_ID}/revoke` },
];
