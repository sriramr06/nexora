import { createBrowserRouter, Navigate } from "react-router";
import { AccountPage } from "@/features/account/account-page";
import { ForgotPasswordPage } from "@/features/auth/pages/forgot-password-page";
import { LoginPage } from "@/features/auth/pages/login-page";
import { RegisterPage } from "@/features/auth/pages/register-page";
import { ResetPasswordPage } from "@/features/auth/pages/reset-password-page";
import { VerifyEmailPage } from "@/features/auth/pages/verify-email-page";
import { LandingPage } from "@/features/landing/landing-page";
import { useAuthStore } from "@/lib/auth-store";
import { FullPageLoader, RequireAuth, RequireGuest, RequireVerified } from "./guards";
import { AppLayout, AuthLayout } from "./layouts";
import { NewOrganizationPage, NotFoundPage, WelcomePage } from "./placeholder-pages";

// "/": landing page for visitors; logged-in users go straight into the app
// (later: their last organization, frontend architecture §5).
function HomeRoute() {
  const status = useAuthStore((s) => s.status);
  if (status === "pending") return <FullPageLoader />;
  if (status === "authenticated") return <Navigate to="/welcome" replace />;
  return <LandingPage />;
}

// Routes from the frontend architecture §5 (auth part; the rest arrives per sprint).
export const router = createBrowserRouter([
  { path: "/", element: <HomeRoute /> },
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
