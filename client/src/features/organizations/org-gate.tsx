import { useEffect } from "react";
import { Link, NavLink, Outlet, useOutletContext, useParams } from "react-router";
import { can, type Action, type Organization, type OrgRole } from "@nexora/shared";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toApiError } from "@/lib/api-error";
import { useCurrentUser } from "@/lib/auth-store";
import { rememberLastOrg } from "./last-org";
import { useOrganization } from "./org-api";
import { OrgStatusPage } from "./pages/org-status-page";

export interface OrgContext {
  organization: Organization;
  role: OrgRole;
  // can() bound to the current member, for hiding UI (the server still enforces).
  allows: (action: Action) => boolean;
}

export const useOrg = () => useOutletContext<OrgContext>();

// FE §5: loads the organization and the caller's membership for /o/:orgId/*.
// Non-active organizations show their status page instead of tenant content (R9).
export function OrgGate() {
  const { orgId = "" } = useParams();
  const user = useCurrentUser();
  const query = useOrganization(orgId);
  const status = query.data?.organization.status;

  useEffect(() => {
    if (query.data) rememberLastOrg(user.id, orgId);
  }, [query.data, user.id, orgId]);

  if (query.isPending) {
    return (
      <div className="grid gap-3" role="status" aria-label="Loading organization">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full max-w-2xl" />
      </div>
    );
  }

  if (query.isError) {
    const notFound = toApiError(query.error).status === 404;
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{notFound ? "Organization not found" : "Something went wrong"}</CardTitle>
          <CardDescription>
            {notFound
              ? "It does not exist, or you are not a member of it."
              : toApiError(query.error).message}{" "}
            <Link to="/" className="text-foreground underline underline-offset-4">
              Go home
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { organization, role } = query.data;
  if (status !== "active") return <OrgStatusPage organization={organization} role={role} />;

  const context: OrgContext = {
    organization,
    role,
    allows: (action) =>
      (can as (a: { userId: string; role: OrgRole }, x: Action) => boolean)(
        { userId: user.id, role },
        action,
      ),
  };
  return (
    <div className="grid gap-6">
      <OrgNav orgId={organization.id} allows={context.allows} />
      <Outlet context={context} />
    </div>
  );
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? "border-b-2 border-primary pb-2 text-foreground"
    : "border-b-2 border-transparent pb-2 text-muted-foreground hover:text-foreground";

// Tabs shown to each role (Roles §5.1); the API enforces the same rules.
function OrgNav({ orgId, allows }: { orgId: string; allows: OrgContext["allows"] }) {
  const tabs = [
    { to: `/o/${orgId}`, label: "Overview", end: true, show: true },
    { to: `/o/${orgId}/members`, label: "Members", end: false, show: allows("member.view") },
    {
      to: `/o/${orgId}/invitations`,
      label: "Invitations",
      end: false,
      show: allows("invitation.view"),
    },
    { to: `/o/${orgId}/settings`, label: "Settings", end: false, show: allows("org.update") },
  ];
  return (
    <nav aria-label="Organization" className="-mb-2 flex gap-5 overflow-x-auto border-b text-sm">
      {tabs
        .filter((t) => t.show)
        .map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={tabClass}>
            {t.label}
          </NavLink>
        ))}
    </nav>
  );
}
