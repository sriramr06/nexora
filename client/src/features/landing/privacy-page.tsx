import type { ReactNode } from "react";
import { Link } from "react-router";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const UPDATED = "17 November 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="grid gap-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

// Public privacy policy (also the URL Google asks for on the OAuth consent screen).
export function PrivacyPage() {
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Logo />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto grid max-w-3xl gap-8 px-4 py-10">
        <div className="grid gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Privacy policy</h1>
          <p className="text-sm text-muted-foreground">Last updated {UPDATED}</p>
        </div>

        <p className="text-sm leading-relaxed">
          Nexora is a project-management app built as a portfolio project. This page explains what
          it stores about you, why, and how to have it removed.
        </p>

        <Section title="What we store">
          <ul className="list-disc space-y-1 pl-5">
            <li>Your name, email address and a hashed password (never the password itself).</li>
            <li>An avatar image, if you upload one.</li>
            <li>
              The work you and your team enter: organizations, projects, tasks, comments, activity
              history and notifications.
            </li>
          </ul>
        </Section>

        <Section title="Why">
          <p>
            Only to run the service: signing you in, showing your organization's work to its
            members, and sending emails you need (verifying your address, invitations, password
            resets and changes to your organization's status).
          </p>
        </Section>

        <Section title="Email">
          <p>
            Emails are sent from the project's Gmail account through Google's Gmail API, with
            permission only to send messages. Nexora cannot read any mailbox.
          </p>
        </Section>

        <Section title="Cookies and storage">
          <p>
            One essential cookie keeps you signed in (an httpOnly refresh token). Your browser
            remembers your theme and last organization locally. There are no analytics, advertising
            or tracking cookies.
          </p>
        </Section>

        <Section title="Sharing">
          <p>
            Your data is never sold or shared for marketing. It is processed only by the services
            that host Nexora: Vercel (website), Render (server) and MongoDB Atlas (database).
            Notifications are kept for 90 days.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            You can change your name and avatar on the Account page. To have your account and data
            deleted, open a request on the project's{" "}
            <a
              href="https://github.com/sriramr06/nexora/issues"
              className="text-foreground underline underline-offset-4"
              target="_blank"
              rel="noreferrer noopener"
            >
              GitHub page
            </a>
            .
          </p>
        </Section>

        <Link to="/" className="w-fit text-sm underline underline-offset-4">
          Back to Nexora
        </Link>
      </main>
    </div>
  );
}
