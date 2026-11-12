import { createBrowserRouter } from "react-router";
import { AccountPage } from "@/features/account/account-page";
import { ForgotPasswordPage } from "@/features/auth/pages/forgot-password-page";
import { LoginPage } from "@/features/auth/pages/login-page";
import { RegisterPage } from "@/features/auth/pages/register-page";
import { ResetPasswordPage } from "@/features/auth/pages/reset-password-page";
import { VerifyEmailPage } from "@/features/auth/pages/verify-email-page";
import { LandingPage } from "@/features/landing/landing-page";
import { OrgGate } from "@/features/organizations/org-gate";
import { NewOrganizationPage } from "@/features/organizations/pages/new-organization-page";
import { OrgHomePage } from "@/features/organizations/pages/org-home-page";
import { OrgSettingsPage } from "@/features/organizations/pages/org-settings-page";
import { PlatformOrgDetailPage } from "@/features/platform/pages/platform-org-detail-page";
import { PlatformOrgsPage } from "@/features/platform/pages/platform-orgs-page";
import { useAuthStore } from "@/lib/auth-store";
import {
  AppHomeRedirect,
  FullPageLoader,
  RequireAuth,
  RequireGuest,
  RequireOwner,
  RequireTenantUser,
  RequireVerified,
} from "./guards";
import { AppLayout, AuthLayout } from "./layouts";
import { NotFoundPage, WelcomePage } from "./placeholder-pages";

// "/": landing page for visitors; logged-in users go straight into the app (FE §5).
function HomeRoute() {
  const status = useAuthStore((s) => s.status);
  if (status === "pending") return <FullPageLoader />;
  if (status === "authenticated") return <AppHomeRedirect />;
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
          { path: "/account", element: <AccountPage /> },
          {
            element: <RequireTenantUser />,
            children: [
              { path: "/welcome", element: <WelcomePage /> },
              {
                element: <RequireVerified />,
                children: [{ path: "/organizations/new", element: <NewOrganizationPage /> }],
              },
              {
                path: "/o/:orgId",
                element: <OrgGate />,
                children: [
                  { index: true, element: <OrgHomePage /> },
                  { path: "settings", element: <OrgSettingsPage /> },
                ],
              },
            ],
          },
          {
            element: <RequireOwner />,
            children: [
              { path: "/platform/organizations", element: <PlatformOrgsPage /> },
              { path: "/platform/organizations/:id", element: <PlatformOrgDetailPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
