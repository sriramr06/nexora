import { Link } from "react-router";

// Flat mark + wordmark (UI-1: solid indigo, no gradient). Same mark as public/favicon.svg.
// `compact`: mark only on small screens, so app headers fit at 360 px.
export function Logo({ to = "/", compact = false }: { to?: string; compact?: boolean }) {
  return (
    <Link
      to={to}
      aria-label="Nexora home"
      className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight"
    >
      <span
        aria-hidden
        className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
      >
        N
      </span>
      <span className={compact ? "hidden sm:inline" : undefined}>Nexora</span>
    </Link>
  );
}
