import { Link, useNavigate, useSearchParams } from "react-router";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, LockIcon, UserIcon } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import {
  nameSchema,
  ORG_ROLE_LABELS,
  passwordSchema,
  type InvitationLookup,
  type InvitationState,
} from "@nexora/shared";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { clearSession } from "@/lib/api";
import { toApiError } from "@/lib/api-error";
import { useAuthStore } from "@/lib/auth-store";
import { applyServerErrors } from "@/lib/form-errors";
import { orgKeys } from "@/features/organizations/org-api";
import {
  Field,
  FormError,
  PasswordRules,
  SubmitButton,
} from "@/features/auth/components/form-parts";
import { publicInvitationApi } from "../members-api";

const CLOSED: Record<Exclude<InvitationState, "valid">, string> = {
  accepted: "This invitation has already been used.",
  revoked: "This invitation was revoked. Ask the person who invited you for a new one.",
  expired: "This invitation has expired. Ask the person who invited you to resend it.",
  organization_inactive: "This organization is not accepting new members right now.",
};

const registerSchema = z.object({ name: nameSchema, password: passwordSchema });

// FR-INV-06: no account yet — register; the email is verified by the link itself.
function RegisterThroughInvitation({ token, invite }: { token: string; invite: InvitationLookup }) {
  const navigate = useNavigate();
  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const password = useWatch({ control: form.control, name: "password" });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const { organizationId, ...session } = await publicInvitationApi.register({
        token,
        ...values,
      });
      useAuthStore.getState().setSession(session);
      toast.success(`Welcome to ${invite.organizationName}!`);
      navigate(`/o/${organizationId}`, { replace: true });
    } catch (error) {
      applyServerErrors(error, form.setError, ["name", "password"]);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <CardContent className="grid gap-4">
        <div className="grid gap-1 rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">Your email</span>
          <span className="font-medium">{invite.email}</span>
        </div>
        <Field
          label="Name"
          icon={UserIcon}
          autoComplete="name"
          error={errors.name?.message}
          {...form.register("name")}
        />
        <Field
          label="Password"
          icon={LockIcon}
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          hint={<PasswordRules value={password ?? ""} />}
          {...form.register("password")}
        />
        <FormError message={errors.root?.message} />
      </CardContent>
      <CardFooter className="mt-4">
        <SubmitButton pending={isSubmitting}>Create account and join</SubmitButton>
      </CardFooter>
    </form>
  );
}

// US-13 / US-14: everything an invitation link can lead to.
export function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  const lookup = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => publicInvitationApi.lookup(token),
    enabled: Boolean(token),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => publicInvitationApi.accept(token),
    onSuccess: ({ organizationId }) => {
      void qc.invalidateQueries({ queryKey: orgKeys.mine });
      toast.success(`You joined ${lookup.data?.organizationName}.`);
      navigate(`/o/${organizationId}`, { replace: true });
    },
    onError: (e) => toast.error(toApiError(e).message),
  });

  if (!token || lookup.isError) {
    return (
      <CardHeader>
        <CardTitle>Invitation not found</CardTitle>
        <CardDescription>
          {lookup.error ? toApiError(lookup.error).message : "This link is incomplete."} Check that
          you opened the full link from the email.
        </CardDescription>
      </CardHeader>
    );
  }

  if (lookup.isPending || status === "pending") {
    return (
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2Icon className="size-4 animate-spin" aria-hidden /> Opening invitation…
        </CardTitle>
      </CardHeader>
    );
  }

  const invite = lookup.data;
  const header = (
    <CardHeader>
      <CardTitle>Join {invite.organizationName}</CardTitle>
      <CardDescription>
        {invite.invitedBy ?? "A team member"} invited you as {ORG_ROLE_LABELS[invite.role]}.
      </CardDescription>
    </CardHeader>
  );

  if (invite.state !== "valid") {
    return (
      <>
        {header}
        <CardContent>
          <p className="text-sm">{CLOSED[invite.state]}</p>
        </CardContent>
      </>
    );
  }

  // Logged in: accept as yourself, if you are the invited person (FR-INV-07).
  if (status === "authenticated" && user) {
    const matches = user.email === invite.email;
    return (
      <>
        {header}
        <CardContent className="grid gap-3 text-sm">
          {matches ? (
            <p>You are logged in as {user.email}.</p>
          ) : (
            <p>
              This invitation is for <strong>{invite.email}</strong>, but you are logged in as{" "}
              {user.email}. Log out and log in with the invited email to accept it.
            </p>
          )}
        </CardContent>
        <CardFooter className="mt-4">
          {matches ? (
            <Button
              className="h-10 w-full"
              disabled={accept.isPending}
              onClick={() => accept.mutate()}
            >
              Accept invitation
            </Button>
          ) : (
            <Button variant="outline" className="h-10 w-full" onClick={() => clearSession()}>
              Log out
            </Button>
          )}
        </CardFooter>
      </>
    );
  }

  // Logged out with an existing account: log in first, then come back here.
  if (invite.accountExists) {
    return (
      <>
        {header}
        <CardContent className="text-sm">
          <p>
            You already have a Nexora account for <strong>{invite.email}</strong>. Log in to accept
            the invitation.
          </p>
        </CardContent>
        <CardFooter className="mt-4">
          <Link
            to="/login"
            state={{ from: `/invite?token=${encodeURIComponent(token)}` }}
            className={buttonVariants({ className: "h-10 w-full" })}
          >
            Log in to accept
          </Link>
        </CardFooter>
      </>
    );
  }

  return (
    <>
      {header}
      <RegisterThroughInvitation token={token} invite={invite} />
    </>
  );
}
