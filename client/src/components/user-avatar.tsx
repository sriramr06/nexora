import { useState } from "react";
import { cn } from "@/lib/utils";

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

const sizes = { sm: "size-7 text-[11px]", md: "size-9 text-xs", lg: "size-20 text-xl" } as const;

// FR-PROF-04: the uploaded avatar, or initials when there is none (or it fails to load).
export function UserAvatar({
  name,
  url,
  size = "md",
  className,
}: {
  name: string;
  url?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = url && failed !== url;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-medium text-secondary-foreground",
        sizes[size],
        className,
      )}
    >
      {showImage ? (
        <img src={url} alt="" className="size-full object-cover" onError={() => setFailed(url)} />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </span>
  );
}
