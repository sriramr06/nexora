import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ActivityEntry,
  CreateProjectInput,
  CreateTaskInput,
  CursorPage,
  Project,
  ProjectStatus,
  ProjectSummaryItem,
  Task,
  TaskStatus,
  UpdateProjectInput,
  UpdateTaskInput,
} from "@nexora/shared";
import { api } from "@/lib/api";

interface Page<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// Keys start with the organization (FE §3).
export const projectKeys = {
  all: (orgId: string) => ["orgs", orgId, "projects"] as const,
  list: (orgId: string, status?: ProjectStatus) =>
    ["orgs", orgId, "projects", "list", status ?? "all"] as const,
  detail: (orgId: string, id: string) => ["orgs", orgId, "projects", id] as const,
  tasks: (orgId: string, projectId: string) =>
    ["orgs", orgId, "projects", projectId, "tasks"] as const,
  task: (orgId: string, taskId: string) => ["orgs", orgId, "tasks", taskId] as const,
  taskActivity: (orgId: string, taskId: string) =>
    ["orgs", orgId, "tasks", taskId, "activity"] as const,
  myTasks: (orgId: string, status?: TaskStatus) =>
    ["orgs", orgId, "my-tasks", status ?? "all"] as const,
};

const base = (orgId: string) => `/orgs/${orgId}`;

// ---------- projects ----------

export const useProjects = (orgId: string, status?: ProjectStatus) =>
  useQuery({
    queryKey: projectKeys.list(orgId, status),
    queryFn: async () =>
      (
        await api.get<Page<ProjectSummaryItem>>(`${base(orgId)}/projects`, {
          params: { status, limit: 100 },
        })
      ).data,
  });

export const useProject = (orgId: string, projectId: string) =>
  useQuery({
    queryKey: projectKeys.detail(orgId, projectId),
    queryFn: async () =>
      (await api.get<{ data: Project }>(`${base(orgId)}/projects/${projectId}`)).data.data,
  });

// Every project change refreshes this project, the lists and the task lists below it.
const useProjectMutation = <TArgs>(orgId: string, fn: (args: TArgs) => Promise<Project>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (project) => {
      qc.setQueryData(projectKeys.detail(orgId, project.id), project);
      void qc.invalidateQueries({ queryKey: projectKeys.all(orgId) });
      void qc.invalidateQueries({ queryKey: ["orgs", orgId, "my-tasks"] });
    },
  });
};

export const useCreateProject = (orgId: string) =>
  useProjectMutation(
    orgId,
    async (input: CreateProjectInput) =>
      (await api.post<{ data: Project }>(`${base(orgId)}/projects`, input)).data.data,
  );

export const useUpdateProject = (orgId: string, projectId: string) =>
  useProjectMutation(
    orgId,
    async (input: UpdateProjectInput) =>
      (await api.patch<{ data: Project }>(`${base(orgId)}/projects/${projectId}`, input)).data.data,
  );

export const useSetManager = (orgId: string, projectId: string) =>
  useProjectMutation(
    orgId,
    async (userId: string) =>
      (await api.put<{ data: Project }>(`${base(orgId)}/projects/${projectId}/manager`, { userId }))
        .data.data,
  );

export const useAddProjectMembers = (orgId: string, projectId: string) =>
  useProjectMutation(
    orgId,
    async (userIds: string[]) =>
      (
        await api.post<{ data: Project }>(`${base(orgId)}/projects/${projectId}/members`, {
          userIds,
        })
      ).data.data,
  );

export const useRemoveProjectMember = (orgId: string, projectId: string) =>
  useProjectMutation(
    orgId,
    async (userId: string) =>
      (
        await api.delete<{ data: Project }>(
          `${base(orgId)}/projects/${projectId}/members/${userId}`,
        )
      ).data.data,
  );

export const useArchiveProject = (orgId: string, projectId: string) =>
  useProjectMutation(
    orgId,
    async (archived: boolean) =>
      (
        await api.post<{ data: Project }>(
          `${base(orgId)}/projects/${projectId}/${archived ? "archive" : "restore"}`,
        )
      ).data.data,
  );

export const useDeleteProject = (orgId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      await api.delete(`${base(orgId)}/projects/${projectId}`);
      return projectId;
    },
    onSuccess: (projectId) => {
      qc.removeQueries({ queryKey: projectKeys.detail(orgId, projectId) });
      void qc.invalidateQueries({ queryKey: projectKeys.all(orgId) });
      void qc.invalidateQueries({ queryKey: ["orgs", orgId, "my-tasks"] });
    },
  });
};

// ---------- tasks ----------

export const useProjectTasks = (orgId: string, projectId: string) =>
  useQuery({
    queryKey: projectKeys.tasks(orgId, projectId),
    queryFn: async () =>
      (await api.get<{ data: Task[] }>(`${base(orgId)}/projects/${projectId}/tasks`)).data.data,
  });

export const useTask = (orgId: string, taskId: string) =>
  useQuery({
    queryKey: projectKeys.task(orgId, taskId),
    queryFn: async () =>
      (await api.get<{ data: Task }>(`${base(orgId)}/tasks/${taskId}`)).data.data,
    retry: false,
  });

export const useTaskActivity = (orgId: string, taskId: string) =>
  useQuery({
    queryKey: projectKeys.taskActivity(orgId, taskId),
    queryFn: async () =>
      (await api.get<CursorPage<ActivityEntry>>(`${base(orgId)}/tasks/${taskId}/activity`)).data,
  });

export const useMyTasks = (orgId: string, status?: TaskStatus) =>
  useQuery({
    queryKey: projectKeys.myTasks(orgId, status),
    queryFn: async () =>
      (await api.get<Page<Task>>(`${base(orgId)}/my-tasks`, { params: { status, limit: 100 } }))
        .data,
  });

// After a task changes: update it in place, refresh lists and its history.
const useTaskMutation = <TArgs>(orgId: string, fn: (args: TArgs) => Promise<Task>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (task) => {
      qc.setQueryData(projectKeys.task(orgId, task.id), task);
      void qc.invalidateQueries({ queryKey: projectKeys.tasks(orgId, task.projectId) });
      void qc.invalidateQueries({ queryKey: projectKeys.taskActivity(orgId, task.id) });
      void qc.invalidateQueries({ queryKey: ["orgs", orgId, "my-tasks"] });
      void qc.invalidateQueries({ queryKey: projectKeys.list(orgId) });
    },
  });
};

export const useCreateTask = (orgId: string, projectId: string) =>
  useTaskMutation(
    orgId,
    async (input: CreateTaskInput) =>
      (await api.post<{ data: Task }>(`${base(orgId)}/projects/${projectId}/tasks`, input)).data
        .data,
  );

export const useUpdateTask = (orgId: string, taskId: string) =>
  useTaskMutation(
    orgId,
    async (input: UpdateTaskInput) =>
      (await api.patch<{ data: Task }>(`${base(orgId)}/tasks/${taskId}`, input)).data.data,
  );

export const useSetAssignee = (orgId: string, taskId: string) =>
  useTaskMutation(
    orgId,
    async (body: { assigneeId: string | null; version: number }) =>
      (await api.put<{ data: Task }>(`${base(orgId)}/tasks/${taskId}/assignee`, body)).data.data,
  );

export const useDeleteTask = (orgId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Task) => {
      await api.delete(`${base(orgId)}/tasks/${task.id}`);
      return task;
    },
    onSuccess: (task) => {
      qc.removeQueries({ queryKey: projectKeys.task(orgId, task.id) });
      void qc.invalidateQueries({ queryKey: projectKeys.tasks(orgId, task.projectId) });
      void qc.invalidateQueries({ queryKey: ["orgs", orgId, "my-tasks"] });
    },
  });
};
