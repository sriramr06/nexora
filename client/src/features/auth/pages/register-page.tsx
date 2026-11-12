import { LockIcon, MailIcon, UserIcon } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { registerSchema } from "@nexora/shared";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toApiError } from "@/lib/api-error";
import { applyServerErrors } from "@/lib/form-errors";
import { authApi } from "../auth-api";
import { Field, FormError, PasswordRules, SubmitButton } from "../components/form-parts";

export function RegisterPage() {
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const register = useMutation({ mutationFn: authApi.register });
  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const passwordValue = useWatch({ control: form.control, name: "password" });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const user = await register.mutateAsync(values);
      setRegisteredEmail(user.email);
    } catch (error) {
      if (toApiError(error).code === "DUPLICATE") {
        form.setError("email", { message: "An account with this email already exists." });
        return;
      }
      applyServerErrors(error, form.setError, ["name", "email", "password"]);
    }
  });

  if (registeredEmail) {
    return (
      <>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a verification link to <strong>{registeredEmail}</strong>. It expires in 24
            hours.
          </CardDescription>
        </CardHeader>
        <CardFooter className="mt-2">
          <Link to="/login" className="text-sm underline underline-offset-4">
            Continue to log in
          </Link>
        </CardFooter>
      </>
    );
  }

  return (
    <>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Start managing projects with your team.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="grid gap-4">
          <Field
            label="Name"
            icon={UserIcon}
            autoComplete="name"
            error={errors.name?.message}
            {...form.register("name")}
          />
          <Field
            label="Email"
            icon={MailIcon}
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...form.register("email")}
          />
          <Field
            label="Password"
            icon={LockIcon}
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            hint={<PasswordRules value={passwordValue ?? ""} />}
            {...form.register("password")}
          />
          <FormError message={errors.root?.message} />
        </CardContent>
        <CardFooter className="mt-4 flex-col gap-3">
          <SubmitButton pending={isSubmitting}>Create account</SubmitButton>
          <p className="text-sm text-muted-foreground">
            Already registered?{" "}
            <Link to="/login" className="text-foreground underline underline-offset-4">
              Log in
            </Link>
          </p>
        </CardFooter>
      </form>
    </>
  );
}
