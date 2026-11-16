import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OrganizationForm } from "../components/organization-form";
import { createdOrganizationOf } from "../components/org-switcher";
import { useMyOrganizations, useRegisterOrganization } from "../org-api";

// US-06 (behind RequireVerified, FR-AUTH-05). Centred like a dialog: it is the only
// thing on the page.
export function NewOrganizationPage() {
  const navigate = useNavigate();
  const register = useRegisterOrganization();
  const mine = useMyOrganizations();
  const created = createdOrganizationOf(mine.data ?? []);

  if (mine.isPending) return <Skeleton className="mx-auto h-96 w-full max-w-2xl" />;

  // FR-ORG-09: one organization per user (the server enforces it too).
  if (created) {
    return (
      <Card className="mx-auto mt-8 w-full max-w-lg text-center sm:mt-16">
        <CardHeader>
          <CardTitle>You have already registered an organization</CardTitle>
          <CardDescription>
            Each account can register one organization. You can still be invited to others.
          </CardDescription>
        </CardHeader>
        <CardFooter className="mt-2 justify-center">
          <Link to={`/o/${created.id}`} className={buttonVariants()}>
            Open {created.name}
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-2xl shadow-sm sm:mt-6">
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
