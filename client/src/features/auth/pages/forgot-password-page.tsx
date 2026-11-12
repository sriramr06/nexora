import { MailIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router";
import { forgotPasswordSchema } from "@nexora/shared";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { applyServerErrors } from "@/lib/form-errors";
import { authApi } from "../auth-api";
import { Field, FormError, SubmitButton } from "../components/form-parts";

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ email }) => {
    try {
      await authApi.forgotPassword(email);
      setSentTo(email);
    } catch (error) {
      applyServerErrors(error, form.setError, ["email"]);
    }
  });

  if (sentTo) {
    // Same message whether or not the account exists (FR-AUTH-10).
    return (
      <>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If an account exists for <strong>{sentTo}</strong>, we sent a link to reset your
            password. It expires in 1 hour.
          </CardDescription>
        </CardHeader>
        <CardFooter className="mt-2">
          <Link to="/login" className="text-sm underline underline-offset-4">
            Back to log in
          </Link>
        </CardFooter>
      </>
    );
  }

  return (
    <>
      <CardHeader>
        <CardTitle>Forgot your password?</CardTitle>
        <CardDescription>Enter your email and we will send you a reset link.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="grid gap-4">
          <Field
            label="Email"
            icon={MailIcon}
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...form.register("email")}
          />
          <FormError message={errors.root?.message} />
        </CardContent>
        <CardFooter className="mt-4 flex-col gap-3">
          <SubmitButton pending={isSubmitting}>Send reset link</SubmitButton>
          <Link to="/login" className="text-sm underline underline-offset-4">
            Back to log in
          </Link>
        </CardFooter>
      </form>
    </>
  );
}
