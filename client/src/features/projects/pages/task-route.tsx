import { useLocation, useNavigate, useParams } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { toApiError } from "@/lib/api-error";
import { useOrg } from "@/features/organizations/org-gate";
import { TaskSheet } from "../components/task-sheet";
import { useTask } from "../projects-api";
import { ProjectPage } from "./project-page";

// /o/:orgId/tasks/:taskId — the task panel over its project (FE §5), so a shared link
// opens the task in context. Closing returns to where the user came from.
export function TaskRoute() {
  const { taskId = "" } = useParams();
  const { organization } = useOrg();
  const navigate = useNavigate();
  const location = useLocation();
  const task = useTask(organization.id, taskId);
  const from = (location.state as { from?: string } | null)?.from;

  const close = () =>
    navigate(
      from ??
        (task.data
          ? `/o/${organization.id}/projects/${task.data.projectId}`
          : `/o/${organization.id}/my-tasks`),
    );

  if (task.isPending) return <Skeleton className="h-64 w-full" />;
  if (task.isError) {
    return <p className="text-sm text-destructive">{toApiError(task.error).message}</p>;
  }
  return (
    <ProjectPage projectId={task.data.projectId}>
      <TaskSheet taskId={taskId} onClose={close} />
    </ProjectPage>
  );
}
