import { ClockIcon, PauseCircleIcon, XCircleIcon } from "lucide-react";
import { toast } from "sonner";
import type { Organization, OrgRole } from "@nexora/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toApiError } from "@/lib/api-error";
import { OrganizationForm } from "../components/organization-form";
import { OrgStatusBadge } from "../components/status-badge";
import { useResubmitOrganization, useUpdateOrganization } from "../org-api";

function Reason({ text }: { text?: string }) {
  if (!text) return null;
  return <blockquote className="mt-3 border-l-2 pl-3 text-sm text-foreground">{text}</blockquote>;
}

// US-07: a Tenant Admin fixes the details, then resubmits.
function FixAndResubmit({ organization }: { organization: Organization }) {
  const update = useUpdateOrganization(organization.id);
  const resubmit = useResubmitOrganization(organization.id);

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Update and resubmit</CardTitle>
        <CardDescription>
          Save your changes, then send the organization for review again.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <OrganizationForm
          organization={organization}
          submitLabel="Save changes"
          onSubmit={async (values) => {
            await update.mutateAsync(values);
            toast.success("Changes saved.");
          }}
        />
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <Button
            disabled={resubmit.isPending}
            onClick={() =>
              resubmit.mutate(undefined, {
                onSuccess: () => toast.success("Resubmitted for approval."),
                onError: (e) => toast.error(toApiError(e).message),
              })
            }
          >
            Resubmit for approval
          </Button>
          <span className="text-sm text-muted-foreground">Status returns to Pending approval.</span>
        </div>
      </CardContent>
    </Card>
  );
}

// FR-ORG-03 / R9: shown instead of tenant content while the organization is not active.
export function OrgStatusPage({
  organization,
  role,
}: {
  organization: Organization;
  role: OrgRole;
}) {
  const isAdmin = role === "admin";

  const content = {
    pending_approval: {
      Icon: ClockIcon,
      title: "Awaiting approval",
      text: "The Nexora team is reviewing this organization. We will email the Tenant Admin when a decision is made.",
    },
    rejected: {
      Icon: XCircleIcon,
      title: "Not approved",
      text: isAdmin
        ? "This organization was not approved. Review the reason, update the details below and resubmit."
        : "This organization was not approved. Its Tenant Admin can update the details and resubmit.",
    },
    suspended: {
      Icon: PauseCircleIcon,
      title: "Suspended",
      text: "This organization has been suspended, so its projects are unavailable. Contact your Tenant Admin for details.",
    },
    active: { Icon: ClockIcon, title: "", text: "" },
  }[organization.status];

  return (
    <div className="grid gap-6">
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <content.Icon className="size-5 text-muted-foreground" aria-hidden />
            <CardTitle>
              {organization.name} · {content.title}
            </CardTitle>
            <OrgStatusBadge status={organization.status} />
          </div>
          <CardDescription>
            {content.text}
            <Reason text={organization.statusReason} />
          </CardDescription>
        </CardHeader>
      </Card>
      {organization.status === "rejected" && isAdmin && (
        <FixAndResubmit organization={organization} />
      )}
    </div>
  );
}
