import { Link } from "react-router";

// Flat mark + wordmark (UI-1: solid indigo, no gradient). Same mark as public/favicon.svg.
export function Logo({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 text-lg font-semibold tracking-tight">
      <span
        aria-hidden
        className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
      >
        N
      </span>
      Nexora
    </Link>
  );
}
