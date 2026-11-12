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
];
