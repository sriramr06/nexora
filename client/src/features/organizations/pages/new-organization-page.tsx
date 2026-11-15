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
import { openRegistrationOf } from "../components/org-switcher";
import { useMyOrganizations, useRegisterOrganization } from "../org-api";

// US-06 (behind RequireVerified, FR-AUTH-05). Centred like a dialog: it is the only
// thing on the page.
export function NewOrganizationPage() {
  const navigate = useNavigate();
  const register = useRegisterOrganization();
  const mine = useMyOrganizations();
  const open = openRegistrationOf(mine.data ?? []);

  if (mine.isPending) return <Skeleton className="mx-auto h-96 w-full max-w-2xl" />;

  // FR-ORG-09: one Pending / Rejected registration at a time (the server enforces it too).
  if (open) {
    return (
      <Card className="mx-auto mt-8 w-full max-w-lg text-center sm:mt-16">
        <CardHeader>
          <CardTitle>You already have a registration in progress</CardTitle>
          <CardDescription>
            “{open.name}” is {open.status === "rejected" ? "rejected" : "awaiting approval"}. You
            can register another organization once it is approved.
          </CardDescription>
        </CardHeader>
        <CardFooter className="mt-2 justify-center">
          <Link to={`/o/${open.id}`} className={buttonVariants()}>
            Open {open.name}
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
