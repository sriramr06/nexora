import { Link, NavLink, Outlet, useMatch } from "react-router";
import { LogOutIcon, MailWarningIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserAvatar } from "@/components/user-avatar";
import { useCurrentUser } from "@/lib/auth-store";
import { useLogout } from "@/features/auth/auth-api";
import { ResendVerificationButton } from "@/features/auth/components/resend-verification-button";
import { OrgSwitcher } from "@/features/organizations/components/org-switcher";

// Decorative mini board for the brand panel.
function BrandBoard() {
  const columns = [3, 2, 3];
  return (
    <div className="grid max-w-sm grid-cols-3 gap-2" aria-hidden>
      {columns.map((count, i) => (
        <div key={i} className="grid content-start gap-2">
          <span className="h-1.5 w-1/2 rounded-full bg-brand-foreground/50" />
          {Array.from({ length: count }, (_, j) => (
            <span key={j} className="h-9 rounded-md bg-brand-tile" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Login, register and the email-link pages: solid brand panel beside the form on wide
// screens (UI-8); the form alone on phones. Flat colour only (UI-7).
export function AuthLayout() {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between gap-10 bg-brand p-10 text-brand-foreground lg:flex">
        <Logo onBrand />
        <div className="grid max-w-md gap-3">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Plan, track and approve work in one place.
          </h2>
          <p className="text-brand-foreground/80">
            Workspaces, Kanban boards and review steps for growing teams.
          </p>
        </div>
        <BrandBoard />
      </aside>
      <main className="relative flex flex-col items-center justify-center gap-8 px-4 py-16 sm:px-8">
        <div className="absolute top-3 right-3">
          <ThemeToggle />
        </div>
        <div className="lg:hidden">
          <Logo />
        </div>
        <Card className="w-full max-w-sm gap-6 bg-transparent py-0 ring-0 [--card-spacing:0px] [&_[data-slot=card-footer]]:border-0 [&_[data-slot=card-footer]]:bg-transparent [&_[data-slot=card-title]]:text-2xl [&_[data-slot=card-title]]:font-semibold [&_[data-slot=card-title]]:tracking-tight">
          <Outlet />
        </Card>
      </main>
    </div>
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
            <Link
              to="/account"
              className="flex items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground"
              aria-label={`Account: ${user.name}`}
            >
              <UserAvatar name={user.name} url={user.avatar?.url} size="sm" />
              <span className="hidden md:inline">{user.name}</span>
            </Link>
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
