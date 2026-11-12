import { useState } from "react";
import { OctagonAlertIcon, PauseIcon } from "lucide-react";
import { toast } from "sonner";
import {
  clearFlag,
  requestChanges,
  setFlag,
  statusChange,
  TASK_STATUSES,
  type Project,
  type Task,
  type TaskFlagType,
  type TaskStatus,
} from "@nexora/shared";
import { Button } from "@/components/ui/button";
import { toApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/features/organizations/labels";
import { useOrg } from "@/features/organizations/org-gate";
import { useChangeStatus, useClearFlag, useRequestChanges, useSetFlag } from "../projects-api";
import { workflowFactsOf } from "./board";
import { ReasonDialog } from "./reason-dialog";

// Action names say what happens, in the review workflow's words (R14).
const actionLabel = (from: TaskStatus, to: TaskStatus): string => {
  if (to === "done") return from === "in_review" ? "Approve" : "Mark done";
  if (to === "in_review") return "Submit for review";
  if (from === "done") return to === "todo" ? "Reopen to To do" : "Reopen";
  if (from === "in_review" && to === "in_progress") return "Withdraw from review";
  if (to === "in_progress") return "Start work";
  return "Move to To do";
};

const errorMessage = (e: unknown) => {
  const err = toApiError(e);
  return err.code === "VERSION_CONFLICT"
    ? "Someone changed this task meanwhile. Try again."
    : err.message;
};

// US-25, US-36, US-37, US-38 — in the task panel (the non-drag path, FR-BOARD-04).
export function TaskWorkflow({ task, project }: { task: Task; project: Project }) {
  const { organization, actor } = useOrg();
  const facts = workflowFactsOf(project, task);
  const change = useChangeStatus(organization.id);
  const sendBack = useRequestChanges(organization.id);
  const flag = useSetFlag(organization.id);
  const unflag = useClearFlag(organization.id);
  const [dialog, setDialog] = useState<"changes" | TaskFlagType | null>(null);
  const archived = project.status === "archived";
  const pending = change.isPending || sendBack.isPending || flag.isPending || unflag.isPending;

  const moves = TASK_STATUSES.filter((s) => statusChange(actor, facts, s).ok);
  const canSendBack = requestChanges(actor, facts).ok;
  const flagOptions = (["blocked", "on_hold"] as const).filter((t) => setFlag(actor, facts, t).ok);
  const canClear = clearFlag(actor, facts).ok;
  const blocked = task.flag?.type === "blocked";

  if (archived) return null;

  return (
    <section aria-labelledby="workflow-heading" className="grid gap-3">
      <h3 id="workflow-heading" className="sr-only">
        Status and flags
      </h3>

      {task.flag && (
        <div
          className={cn(
            "grid gap-1 rounded-lg border p-3 text-sm",
            blocked ? "border-destructive/40 bg-destructive/5" : "border-chart-3/40 bg-chart-3/10",
          )}
        >
          <p className="flex items-center gap-1.5 font-medium">
            {blocked ? (
              <OctagonAlertIcon className="size-4 text-destructive" aria-hidden />
            ) : (
              <PauseIcon className="size-4" aria-hidden />
            )}
            {blocked ? "Blocked" : "On hold"}
          </p>
          <p>{task.flag.reason}</p>
          <p className="text-xs text-muted-foreground">
            {task.flag.setBy?.name ?? "A former member"} · {formatDateTime(task.flag.setAt)}
          </p>
          {canClear && (
            <Button
              size="sm"
              variant="outline"
              className="mt-1 w-fit"
              disabled={pending}
              onClick={() =>
                unflag.mutate(task, {
                  onSuccess: () => toast.success(blocked ? "Blocker cleared." : "Hold cleared."),
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              {blocked ? "Clear blocker" : "Clear hold"}
            </Button>
          )}
          {blocked && !canClear && (
            <p className="text-xs text-muted-foreground">
              Only the project's manager can clear a blocker.
            </p>
          )}
        </div>
      )}

      {(moves.length > 0 || canSendBack || flagOptions.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {moves.map((to) => (
            <Button
              key={to}
              size="sm"
              variant={to === "done" || to === "in_review" ? "default" : "outline"}
              disabled={pending}
              onClick={() =>
                change.mutate(
                  { task, status: to },
                  { onError: (e) => toast.error(errorMessage(e)) },
                )
              }
            >
              {actionLabel(task.status, to)}
            </Button>
          ))}
          {canSendBack && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setDialog("changes")}
            >
              Request changes
            </Button>
          )}
          {flagOptions.map((type) => (
            <Button
              key={type}
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setDialog(type)}
            >
              {type === "blocked" ? "Mark blocked" : "Put on hold"}
            </Button>
          ))}
        </div>
      )}

      <ReasonDialog
        open={dialog === "changes"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Request changes"
        description="The task returns to In Progress. The reason is saved in its history."
        confirmLabel="Send back"
        pending={sendBack.isPending}
        onConfirm={(reason) =>
          sendBack.mutate(
            { task, reason },
            {
              onSuccess: () => {
                toast.success("Sent back to In Progress.");
                setDialog(null);
              },
              onError: (e) => toast.error(errorMessage(e)),
            },
          )
        }
      />
      <ReasonDialog
        open={dialog === "blocked" || dialog === "on_hold"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog === "blocked" ? "Mark as blocked" : "Put on hold"}
        description={
          dialog === "blocked"
            ? "The card stays in its column with a Blocked badge. Only the project's manager can clear it."
            : "The card stays in its column with an On hold badge."
        }
        confirmLabel={dialog === "blocked" ? "Mark blocked" : "Put on hold"}
        pending={flag.isPending}
        onConfirm={(reason) =>
          (dialog === "blocked" || dialog === "on_hold") &&
          flag.mutate(
            { task, type: dialog, reason },
            {
              onSuccess: () => {
                toast.success(dialog === "blocked" ? "Marked as blocked." : "Put on hold.");
                setDialog(null);
              },
              onError: (e) => toast.error(errorMessage(e)),
            },
          )
        }
      />
    </section>
  );
}
