import { Navigate, Outlet, useLocation, type Location } from "react-router";
import { Loader2Icon } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { VerifyEmailPrompt } from "./layouts";

interface FromState {
  from?: string;
}

// Where to go after login: the page RequireAuth bounced the user from, else home.
export const redirectTarget = (location: Location): string =>
  (location.state as FromState | null)?.from ?? "/";

export function FullPageLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center" role="status">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

// Logged-in routes. Waits for the startup refresh before deciding (§4.5).
export function RequireAuth() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === "pending") return <FullPageLoader />;
  if (status === "anonymous") {
    const from: FromState = { from: location.pathname + location.search };
    return <Navigate to="/login" replace state={from} />;
  }
  return <Outlet />;
}

// Login / register / forgot-password: a logged-in user has no business there.
export function RequireGuest() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === "pending") return <FullPageLoader />;
  if (status === "authenticated") return <Navigate to={redirectTarget(location)} replace />;
  return <Outlet />;
}

// Verified-only routes (FR-AUTH-05), e.g. organization registration. Use inside RequireAuth.
export function RequireVerified() {
  const verified = useAuthStore((s) => s.user?.emailVerified);
  return verified ? <Outlet /> : <VerifyEmailPrompt />;
}
