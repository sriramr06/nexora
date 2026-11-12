import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OrganizationForm } from "../components/organization-form";
import { useRegisterOrganization } from "../org-api";

// US-06 (behind RequireVerified, FR-AUTH-05).
export function NewOrganizationPage() {
  const navigate = useNavigate();
  const register = useRegisterOrganization();

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Register your organization</CardTitle>
        <CardDescription>
          Nexora reviews every new organization. You will be its Tenant Admin, and we will email you
          once it is approved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <OrganizationForm
          submitLabel="Submit for approval"
          onSubmit={async (values) => {
            const { organization } = await register.mutateAsync(values);
            toast.success("Organization submitted for approval.");
            navigate(`/o/${organization.id}`, { replace: true });
          }}
        />
      </CardContent>
    </Card>
  );
}
