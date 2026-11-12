import { NavLink, Outlet, useMatch } from "react-router";
import { LogOutIcon, MailWarningIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCurrentUser } from "@/lib/auth-store";
import { useLogout } from "@/features/auth/auth-api";
import { ResendVerificationButton } from "@/features/auth/components/resend-verification-button";
import { OrgSwitcher } from "@/features/organizations/components/org-switcher";

// Centered card for login, register and the email-link pages.
export function AuthLayout() {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
      <Logo />
      <Card className="w-full max-w-sm">
        <Outlet />
      </Card>
    </main>
  );
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground";

// Shell for logged-in pages: organization switcher for members, platform nav for the Owner.
export function AppLayout() {
  const user = useCurrentUser();
  const logout = useLogout();
  const isOwner = user.platformRole === "owner";
  const orgMatch = useMatch("/o/:orgId/*");

  return (
    <div className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:gap-4">
          <Logo compact />
          {!isOwner && <OrgSwitcher currentOrgId={orgMatch?.params.orgId} />}
          <nav className="flex gap-4 text-sm">
            {isOwner && (
              <NavLink to="/platform/organizations" className={navLinkClass}>
                Organizations
              </NavLink>
            )}
            <NavLink to="/account" className={navLinkClass}>
              Account
            </NavLink>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
              aria-label="Log out"
            >
              <LogOutIcon aria-hidden /> <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-6 p-4">
        {!user.emailVerified && (
          <Alert>
            <MailWarningIcon aria-hidden />
            <AlertTitle>Verify your email</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              We sent a link to {user.email}. You need to verify before registering an organization.
              <ResendVerificationButton />
            </AlertDescription>
          </Alert>
        )}
        <Outlet />
      </main>
    </div>
  );
}

// Shown by RequireVerified (US-02: "asked to verify first").
export function VerifyEmailPrompt() {
  const user = useCurrentUser();
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Verify your email first</CardTitle>
        <CardDescription>
          Open the link we sent to {user.email} to continue. Links expire after 24 hours.
        </CardDescription>
      </CardHeader>
      <CardFooter className="mt-2">
        <ResendVerificationButton />
      </CardFooter>
    </Card>
  );
}
