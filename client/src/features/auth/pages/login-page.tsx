import { LockIcon, MailIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate } from "react-router";
import { loginSchema } from "@nexora/shared";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { applyServerErrors } from "@/lib/form-errors";
import { redirectTarget } from "@/app/guards";
import { useLogin } from "../auth-api";
import { Field, FormError, SubmitButton } from "../components/form-parts";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      navigate(redirectTarget(location), { replace: true });
    } catch (error) {
      applyServerErrors(error, form.setError, ["email", "password"]);
    }
  });

  return (
    <>
      <CardHeader>
        <CardTitle>Log in</CardTitle>
        <CardDescription>Welcome back to Nexora.</CardDescription>
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
          <Field
            label="Password"
            icon={LockIcon}
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            hint={
              <Link to="/forgot-password" className="underline underline-offset-4">
                Forgot your password?
              </Link>
            }
            {...form.register("password")}
          />
          <FormError message={errors.root?.message} />
        </CardContent>
        <CardFooter className="mt-4 flex-col gap-3">
          <SubmitButton pending={isSubmitting}>Log in</SubmitButton>
          <p className="text-sm text-muted-foreground">
            No account?{" "}
            <Link to="/register" className="text-foreground underline underline-offset-4">
              Register
            </Link>
          </p>
        </CardFooter>
      </form>
    </>
  );
}
