import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  OrgStatus,
  PlatformOrganizationDetails,
  PlatformOrganizationSummary,
} from "@nexora/shared";
import { api } from "@/lib/api";

interface ListResponse {
  data: PlatformOrganizationSummary[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface PlatformListParams {
  status?: OrgStatus;
  q?: string;
  page: number;
}

export type Transition = "approve" | "reject" | "suspend" | "reactivate";

const keys = {
  all: ["platform", "organizations"] as const,
  list: (p: PlatformListParams) => ["platform", "organizations", "list", p] as const,
  detail: (id: string) => ["platform", "organizations", id] as const,
};

const platformApi = {
  list: async (params: PlatformListParams) =>
    (await api.get<ListResponse>("/platform/organizations", { params: { ...params, limit: 20 } }))
      .data,
  detail: async (id: string) =>
    (await api.get<{ data: PlatformOrganizationDetails }>(`/platform/organizations/${id}`)).data
      .data,
  transition: async (id: string, transition: Transition, reason?: string) =>
    (
      await api.post<{ data: PlatformOrganizationDetails }>(
        `/platform/organizations/${id}/${transition}`,
        reason ? { reason } : undefined,
      )
    ).data.data,
  rename: async (id: string, name: string) =>
    (
      await api.patch<{ data: PlatformOrganizationDetails }>(`/platform/organizations/${id}`, {
        name,
      })
    ).data.data,
};

export const usePlatformOrganizations = (params: PlatformListParams) =>
  useQuery({
    queryKey: keys.list(params),
    queryFn: () => platformApi.list(params),
    placeholderData: keepPreviousData, // keep the table while the next page loads
  });

export const usePlatformOrganization = (id: string) =>
  useQuery({ queryKey: keys.detail(id), queryFn: () => platformApi.detail(id) });

const useDetailMutation = <TArgs>(
  id: string,
  fn: (args: TArgs) => Promise<PlatformOrganizationDetails>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      queryClient.setQueryData(keys.detail(id), data);
      void queryClient.invalidateQueries({ queryKey: [...keys.all, "list"] });
    },
  });
};

export const useTransition = (id: string) =>
  useDetailMutation(id, ({ transition, reason }: { transition: Transition; reason?: string }) =>
    platformApi.transition(id, transition, reason),
  );

export const useRename = (id: string) =>
  useDetailMutation(id, (name: string) => platformApi.rename(id, name));
