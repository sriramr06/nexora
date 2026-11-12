import { Link } from "react-router";

// Flat mark + wordmark (UI-1: solid indigo, no gradient). Same mark as public/favicon.svg.
interface LogoProps {
  to?: string;
  // Mark only on small screens, so app headers fit at 360 px.
  compact?: boolean;
  // Inverted mark for the solid brand panel.
  onBrand?: boolean;
}

export function Logo({ to = "/", compact = false, onBrand = false }: LogoProps) {
  return (
    <Link
      to={to}
      aria-label="Nexora home"
      className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight"
    >
      <span
        aria-hidden
        className={
          onBrand
            ? "flex size-7 items-center justify-center rounded-md bg-brand-foreground text-sm font-bold text-brand"
            : "flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
        }
      >
        N
      </span>
      <span className={compact ? "hidden sm:inline" : undefined}>Nexora</span>
    </Link>
  );
}
