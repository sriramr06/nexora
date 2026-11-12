import { useId, useState, type ComponentProps, type ReactNode } from "react";
import {
  CheckIcon,
  CircleIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  type LucideIcon,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps extends ComponentProps<typeof Input> {
  label: string;
  error?: string;
  hint?: ReactNode;
  // Leading icon (auth forms). Fields with an icon use the taller 40 px control.
  icon?: LucideIcon;
}

// Label + input + hint / error, wired up for screen readers. Password fields get a
// show / hide toggle automatically.
export function Field({
  label,
  error,
  hint,
  id,
  icon: Icon,
  type,
  className,
  ...inputProps
}: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;
  const isPassword = type === "password";
  const [visible, setVisible] = useState(false);

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        )}
        <Input
          id={inputId}
          type={isPassword && visible ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={cn(Icon && "h-10 pl-9", isPassword && "pr-10", className)}
          {...inputProps}
        />
        {isPassword && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            aria-controls={inputId}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
          </Button>
        )}
      </div>
      {message && (
        <div
          id={messageId}
          className={error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
        >
          {message}
        </div>
      )}
    </div>
  );
}

// FR-AUTH-03, shown live under "new password" fields (same rules as the shared schema).
const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "A letter", test: (v: string) => /[A-Za-z]/.test(v) },
  { label: "A number", test: (v: string) => /[0-9]/.test(v) },
];

export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="grid gap-1 text-sm" aria-label="Password requirements">
      {PASSWORD_RULES.map(({ label, test }) => {
        const met = test(value);
        const Icon = met ? CheckIcon : CircleIcon;
        return (
          <li
            key={label}
            className={cn(
              "flex items-center gap-2",
              met ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className={cn("shrink-0", met ? "size-4" : "size-3 mx-0.5")} aria-hidden />
            {label}
            <span className="sr-only">{met ? "(met)" : "(not met)"}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" className="h-10 w-full" disabled={pending}>
      {pending && <Loader2Icon className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
