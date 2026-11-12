import { Navigate } from "react-router";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OrganizationForm } from "../components/organization-form";
import { useUpdateOrganization } from "../org-api";
import { useOrg } from "../org-gate";

// FR-ORG-05: Tenant Admins update details while Active.
export function OrgSettingsPage() {
  const { organization, allows } = useOrg();
  const update = useUpdateOrganization(organization.id);

  // UI hint only; PATCH /orgs/:orgId is authorized on the server (403 for other roles).
  if (!allows("org.update")) return <Navigate to={`/o/${organization.id}`} replace />;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Organization settings</CardTitle>
        <CardDescription>Details shown to your team and the Nexora team.</CardDescription>
      </CardHeader>
      <CardContent>
        <OrganizationForm
          organization={organization}
          submitLabel="Save changes"
          onSubmit={async (values) => {
            await update.mutateAsync(values);
            toast.success("Organization updated.");
          }}
        />
      </CardContent>
    </Card>
  );
}
