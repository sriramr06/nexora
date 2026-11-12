import { NavLink, Outlet } from "react-router";
import { LogOutIcon, MailWarningIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCurrentUser } from "@/lib/auth-store";
import { useLogout } from "@/features/auth/auth-api";
import { ResendVerificationButton } from "@/features/auth/components/resend-verification-button";

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

// Shell for logged-in pages. Grows a sidebar with organizations in Sprint 2.
export function AppLayout() {
  const user = useCurrentUser();
  const logout = useLogout();

  return (
    <div className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <Logo />
          <nav className="flex gap-4 text-sm">
            <NavLink to="/account" className={navLinkClass}>
              Account
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              <LogOutIcon aria-hidden /> Log out
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
