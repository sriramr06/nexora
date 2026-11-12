import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";
import { CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toApiError } from "@/lib/api-error";
import { useAuthStore } from "@/lib/auth-store";
import { authApi } from "../auth-api";
import { ResendVerificationButton } from "../components/resend-verification-button";

const verify = async (token: string) => {
  await authApi.verifyEmail(token);
  const { user, setUser } = useAuthStore.getState();
  if (user) setUser({ ...user, emailVerified: true });
  return true;
};

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const status = useAuthStore((s) => s.status);

  // A query, not an effect + mutation: the cache de-duplicates the call, so React
  // StrictMode's double mount cannot use the one-time token twice.
  const result = useQuery({
    queryKey: ["verify-email", token],
    queryFn: () => verify(token!),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  if (token && result.isPending) {
    return (
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2Icon className="size-4 animate-spin" aria-hidden /> Verifying your email…
        </CardTitle>
      </CardHeader>
    );
  }

  if (result.isSuccess) {
    return (
      <>
        <CardHeader>
          <CardTitle>Email verified</CardTitle>
          <CardDescription>You can now register your organization.</CardDescription>
        </CardHeader>
        <CardFooter className="mt-2">
          <Link to={status === "authenticated" ? "/" : "/login"} className="text-sm underline">
            {status === "authenticated" ? "Continue" : "Log in"}
          </Link>
        </CardFooter>
      </>
    );
  }

  const message = result.error
    ? toApiError(result.error).message
    : "This link is invalid or has expired.";

  return (
    <>
      <CardHeader>
        <CardTitle>Verification failed</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardFooter className="mt-2">
        {status === "authenticated" ? (
          <ResendVerificationButton />
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link to="/login" className="text-foreground underline underline-offset-4">
              Log in
            </Link>{" "}
            to request a new link.
          </p>
        )}
      </CardFooter>
    </>
  );
}
