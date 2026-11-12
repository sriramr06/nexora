import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AuthSessionData,
  BulkInviteResult,
  Invitation,
  InvitationListStatus,
  InvitationLookup,
  InvitationRegisterInput,
  InviteResult,
  Member,
  OrgRole,
} from "@nexora/shared";
import { api } from "@/lib/api";
import { orgKeys } from "@/features/organizations/org-api";

interface Page<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// Keys start with the organization (FE §3).
export const memberKeys = {
  members: (orgId: string) => ["orgs", orgId, "members"] as const,
  invitations: (orgId: string) => ["orgs", orgId, "invitations"] as const,
};

// ---------- members ----------

export const useMembers = (orgId: string) =>
  useQuery({
    queryKey: memberKeys.members(orgId),
    queryFn: async () =>
      (await api.get<Page<Member>>(`/orgs/${orgId}/members`, { params: { limit: 100 } })).data,
  });

export const useChangeRole = (orgId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: OrgRole }) =>
      (await api.patch<{ data: Member }>(`/orgs/${orgId}/members/${userId}`, { role })).data.data,
    onSettled: () => qc.invalidateQueries({ queryKey: ["orgs", orgId] }),
  });
};

export const useRemoveMember = (orgId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/orgs/${orgId}/members/${userId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: memberKeys.members(orgId) }),
  });
};

export const useLeaveOrganization = (orgId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post(`/orgs/${orgId}/leave`);
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["orgs", orgId] });
      void qc.invalidateQueries({ queryKey: orgKeys.mine });
    },
  });
};

// ---------- invitations (tenant side) ----------

export const useInvitations = (orgId: string, status?: InvitationListStatus, enabled = true) =>
  useQuery({
    enabled,
    queryKey: [...memberKeys.invitations(orgId), status ?? "all"],
    queryFn: async () =>
      (
        await api.get<Page<Invitation>>(`/orgs/${orgId}/invitations`, {
          params: { status, limit: 100 },
        })
      ).data,
    placeholderData: keepPreviousData,
  });

const useInvitationMutation = <TArgs, TResult>(
  orgId: string,
  fn: (args: TArgs) => Promise<TResult>,
) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ queryKey: memberKeys.invitations(orgId) }),
  });
};

export const useInvite = (orgId: string) =>
  useInvitationMutation(
    orgId,
    async (body: { email: string; role: OrgRole }) =>
      (await api.post<{ data: InviteResult }>(`/orgs/${orgId}/invitations`, body)).data.data,
  );

export const useBulkInvite = (orgId: string) =>
  useInvitationMutation(
    orgId,
    async (body: { emails: string[]; role: OrgRole }) =>
      (await api.post<{ data: BulkInviteResult[] }>(`/orgs/${orgId}/invitations/bulk`, body)).data
        .data,
  );

export const useResendInvitation = (orgId: string) =>
  useInvitationMutation(
    orgId,
    async (id: string) =>
      (await api.post<{ data: InviteResult }>(`/orgs/${orgId}/invitations/${id}/resend`)).data.data,
  );

export const useRevokeInvitation = (orgId: string) =>
  useInvitationMutation(
    orgId,
    async (id: string) =>
      (await api.post<{ data: Invitation }>(`/orgs/${orgId}/invitations/${id}/revoke`)).data.data,
  );

// ---------- invitations (public side) ----------

export const publicInvitationApi = {
  lookup: async (token: string) =>
    (await api.post<{ data: InvitationLookup }>("/invitations/lookup", { token })).data.data,
  register: async (input: InvitationRegisterInput) =>
    (
      await api.post<{ data: AuthSessionData & { organizationId: string } }>(
        "/invitations/register",
        input,
      )
    ).data.data,
  accept: async (token: string) =>
    (await api.post<{ data: { organizationId: string } }>("/invitations/accept", { token })).data
      .data,
};
