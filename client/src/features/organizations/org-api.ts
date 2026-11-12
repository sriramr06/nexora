import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  MyOrganization,
  OrganizationDetailsInput,
  OrganizationWithRole,
} from "@nexora/shared";
import { api } from "@/lib/api";

interface Envelope<T> {
  data: T;
}

// Query keys start with the organization ID (FE §3), so switching never shows another
// tenant's cached data.
export const orgKeys = {
  mine: ["me", "organizations"] as const,
  detail: (orgId: string) => ["orgs", orgId] as const,
};

export const orgApi = {
  mine: async () => (await api.get<Envelope<MyOrganization[]>>("/me/organizations")).data.data,
  get: async (orgId: string) =>
    (await api.get<Envelope<OrganizationWithRole>>(`/orgs/${orgId}`)).data.data,
  register: async (input: OrganizationDetailsInput) =>
    (await api.post<Envelope<OrganizationWithRole>>("/orgs", input)).data.data,
  update: async (orgId: string, input: OrganizationDetailsInput) =>
    (await api.patch<Envelope<OrganizationWithRole>>(`/orgs/${orgId}`, input)).data.data,
  resubmit: async (orgId: string) =>
    (await api.post<Envelope<OrganizationWithRole>>(`/orgs/${orgId}/resubmit`)).data.data,
};

export const useMyOrganizations = (enabled = true) =>
  useQuery({ queryKey: orgKeys.mine, queryFn: orgApi.mine, enabled });

export const useOrganization = (orgId: string) =>
  useQuery({ queryKey: orgKeys.detail(orgId), queryFn: () => orgApi.get(orgId) });

// After any change: refresh this organization and the switcher list.
const useOrgMutation = <TArgs>(fn: (args: TArgs) => Promise<OrganizationWithRole>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      queryClient.setQueryData(orgKeys.detail(data.organization.id), data);
      void queryClient.invalidateQueries({ queryKey: orgKeys.mine });
    },
  });
};

export const useRegisterOrganization = () => useOrgMutation(orgApi.register);

export const useUpdateOrganization = (orgId: string) =>
  useOrgMutation((input: OrganizationDetailsInput) => orgApi.update(orgId, input));

export const useResubmitOrganization = (orgId: string) =>
  useOrgMutation(() => orgApi.resubmit(orgId));
