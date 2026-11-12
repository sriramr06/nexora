import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/lib/auth-store";

// Interim pages until Sprint 2 adds organizations.

export function WelcomePage() {
  const user = useCurrentUser();
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Welcome, {user.name}</CardTitle>
        <CardDescription>
          You are not part of an organization yet. Register your company, or wait for an invitation
          from your team.
        </CardDescription>
      </CardHeader>
      <CardFooter className="mt-2">
        <Link to="/organizations/new" className={buttonVariants()}>
          Register your organization
        </Link>
      </CardFooter>
    </Card>
  );
}

export function NotFoundPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-4 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="text-sm underline underline-offset-4">
        Go home
      </Link>
    </main>
  );
}
