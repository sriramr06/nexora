import { useId, useState } from "react";
import { toast } from "sonner";
import { ORG_STATUS_LABELS, statusReasonSchema, type OrgStatus } from "@nexora/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toApiError } from "@/lib/api-error";
import { useTransition, type Transition } from "../platform-api";

export const ACTIONS: Record<
  Transition,
  { label: string; needsReason: boolean; variant: "default" | "outline" | "destructive" }
> = {
  approve: { label: "Approve", needsReason: false, variant: "default" },
  reject: { label: "Reject", needsReason: true, variant: "destructive" },
  suspend: { label: "Suspend", needsReason: true, variant: "destructive" },
  reactivate: { label: "Reactivate", needsReason: false, variant: "default" },
};

export const available = (org: { status: OrgStatus }): Transition[] =>
  ({
    pending_approval: ["approve", "reject"] as Transition[],
    active: ["suspend"] as Transition[],
    suspended: ["reactivate"] as Transition[],
    rejected: [] as Transition[],
  })[org.status];

// Reject / suspend need a reason (FR-PLAT-05, 06); it is emailed to the admins.
export function ReasonDialog({
  transition,
  orgName,
  pending,
  onClose,
  onConfirm,
}: {
  transition: Transition | null;
  orgName: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const id = useId();
  const verb = transition === "reject" ? "Reject" : "Suspend";

  return (
    <Dialog
      open={transition !== null}
      onOpenChange={(open) => {
        if (!open) {
          setReason("");
          setError(undefined);
          onClose();
        }
      }}
    >
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = statusReasonSchema.safeParse({ reason });
            if (!parsed.success) return setError(parsed.error.issues[0]?.message);
            onConfirm(parsed.data.reason);
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {verb} {orgName}?
            </DialogTitle>
            <DialogDescription>
              The reason is shown to the organization and emailed to its admins.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={id}>Reason</Label>
            <Textarea
              id={id}
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(undefined);
              }}
              aria-invalid={error ? true : undefined}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {verb}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// The lifecycle buttons (US-10, US-11), used on the list rows and the detail page.
export function OrgActions({
  org,
  size = "sm",
}: {
  org: { id: string; name: string; status: OrgStatus };
  size?: "sm" | "xs";
}) {
  const transition = useTransition(org.id);
  const [reasonFor, setReasonFor] = useState<Transition | null>(null);

  const run = (t: Transition, reason?: string) =>
    transition.mutate(
      { transition: t, reason },
      {
        onSuccess: (updated) => {
          toast.success(
            `${updated.name} is now ${ORG_STATUS_LABELS[updated.status].toLowerCase()}.`,
          );
          setReasonFor(null);
        },
        onError: (err) => toast.error(toApiError(err).message),
      },
    );

  return (
    <>
      {available(org).map((t) => (
        <Button
          key={t}
          size={size}
          variant={ACTIONS[t].variant}
          disabled={transition.isPending}
          aria-label={`${ACTIONS[t].label} ${org.name}`}
          onClick={() => (ACTIONS[t].needsReason ? setReasonFor(t) : run(t))}
        >
          {ACTIONS[t].label}
        </Button>
      ))}
      <ReasonDialog
        transition={reasonFor}
        orgName={org.name}
        pending={transition.isPending}
        onClose={() => setReasonFor(null)}
        onConfirm={(reason) => reasonFor && run(reasonFor, reason)}
      />
    </>
  );
}
