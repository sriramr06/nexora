import { createBrowserRouter, Navigate } from "react-router";
import { AccountPage } from "@/features/account/account-page";
import { ForgotPasswordPage } from "@/features/auth/pages/forgot-password-page";
import { LoginPage } from "@/features/auth/pages/login-page";
import { RegisterPage } from "@/features/auth/pages/register-page";
import { ResetPasswordPage } from "@/features/auth/pages/reset-password-page";
import { VerifyEmailPage } from "@/features/auth/pages/verify-email-page";
import { RequireAuth, RequireGuest, RequireVerified } from "./guards";
import { AppLayout, AuthLayout } from "./layouts";
import { NewOrganizationPage, NotFoundPage, WelcomePage } from "./placeholder-pages";

// Routes from the frontend architecture §5 (auth part; the rest arrives per sprint).
export const router = createBrowserRouter([
  {
    element: <RequireGuest />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/register", element: <RegisterPage /> },
          { path: "/forgot-password", element: <ForgotPasswordPage /> },
        ],
      },
    ],
  },
  {
    // Email-link pages work whether or not the user is logged in.
    element: <AuthLayout />,
    children: [
      { path: "/verify-email", element: <VerifyEmailPage /> },
      { path: "/reset-password", element: <ResetPasswordPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <Navigate to="/welcome" replace /> },
          { path: "/welcome", element: <WelcomePage /> },
          { path: "/account", element: <AccountPage /> },
          {
            element: <RequireVerified />,
            children: [{ path: "/organizations/new", element: <NewOrganizationPage /> }],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
