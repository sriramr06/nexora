import { LockIcon } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { changePasswordSchema } from "@nexora/shared";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { applyServerErrors } from "@/lib/form-errors";
import { useCurrentUser } from "@/lib/auth-store";
import { useChangePassword } from "@/features/auth/auth-api";
import { ProfileCard } from "./profile-card";
import {
  Field,
  FormError,
  PasswordRules,
  SubmitButton,
} from "@/features/auth/components/form-parts";

const formSchema = changePasswordSchema
  .extend({ confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

const emptyForm = { currentPassword: "", newPassword: "", confirmPassword: "" };

// US-05. Profile and avatar join this page in Sprint 3.
export function AccountPage() {
  const user = useCurrentUser();
  const changePassword = useChangePassword();
  const form = useForm({ resolver: zodResolver(formSchema), defaultValues: emptyForm });
  const { errors, isSubmitting } = form.formState;
  const newPasswordValue = useWatch({ control: form.control, name: "newPassword" });

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      form.reset(emptyForm);
      toast.success("Password changed. Your other sessions were signed out.");
    } catch (error) {
      applyServerErrors(error, form.setError, ["currentPassword", "newPassword"]);
    }
  });

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">
          {user.name} · {user.email}
        </p>
      </div>
      <ProfileCard />
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Other devices will be signed out.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit} noValidate>
          <CardContent className="grid gap-4">
            <Field
              label="Current password"
              icon={LockIcon}
              type="password"
              autoComplete="current-password"
              error={errors.currentPassword?.message}
              {...form.register("currentPassword")}
            />
            <Field
              label="New password"
              icon={LockIcon}
              type="password"
              autoComplete="new-password"
              error={errors.newPassword?.message}
              hint={<PasswordRules value={newPasswordValue ?? ""} />}
              {...form.register("newPassword")}
            />
            <Field
              label="Confirm new password"
              icon={LockIcon}
              type="password"
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              {...form.register("confirmPassword")}
            />
            <FormError message={errors.root?.message} />
          </CardContent>
          <CardFooter className="mt-4">
            <SubmitButton pending={isSubmitting}>Change password</SubmitButton>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
