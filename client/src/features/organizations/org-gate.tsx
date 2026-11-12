import { useEffect } from "react";
import { Link, Outlet, useOutletContext, useParams } from "react-router";
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
  return <Outlet context={context} />;
}
