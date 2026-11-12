import { LockIcon } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { toast } from "sonner";
import { passwordSchema } from "@nexora/shared";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { clearSession } from "@/lib/api";
import { applyServerErrors } from "@/lib/form-errors";
import { authApi } from "../auth-api";
import { Field, FormError, PasswordRules, SubmitButton } from "../components/form-parts";

const formSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const passwordValue = useWatch({ control: form.control, name: "password" });

  const onSubmit = form.handleSubmit(async ({ password }) => {
    try {
      await authApi.resetPassword({ token: token!, password });
      clearSession(); // the server signed out every session, including this one
      toast.success("Password updated. Please log in with your new password.");
      navigate("/login", { replace: true });
    } catch (error) {
      applyServerErrors(error, form.setError, ["password"]);
    }
  });

  if (!token) {
    return (
      <CardHeader>
        <CardTitle>Invalid link</CardTitle>
        <CardDescription>
          This reset link is incomplete.{" "}
          <Link to="/forgot-password" className="text-foreground underline underline-offset-4">
            Request a new one
          </Link>
          .
        </CardDescription>
      </CardHeader>
    );
  }

  return (
    <>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>You will be signed out on all devices.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="grid gap-4">
          <Field
            label="New password"
            icon={LockIcon}
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            hint={<PasswordRules value={passwordValue ?? ""} />}
            {...form.register("password")}
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
          {errors.root && (
            <Link to="/forgot-password" className="text-sm underline underline-offset-4">
              Request a new reset link
            </Link>
          )}
        </CardContent>
        <CardFooter className="mt-4">
          <SubmitButton pending={isSubmitting}>Update password</SubmitButton>
        </CardFooter>
      </form>
    </>
  );
}
