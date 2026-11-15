import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import type { CursorPage, Notification } from "@nexora/shared";
import { api } from "@/lib/api";

export const notificationKeys = {
  all: (orgId: string) => ["orgs", orgId, "notifications"] as const,
  unread: (orgId: string) => ["orgs", orgId, "notifications", "unread"] as const,
  list: (orgId: string, limit: number) => ["orgs", orgId, "notifications", "list", limit] as const,
};

const base = (orgId: string) => `/orgs/${orgId}/notifications`;

// NFR-PERF-05: every 30 s, only while the tab is visible (TanStack Query pauses
// interval refetches in hidden tabs unless refetchIntervalInBackground is set).
export const useUnreadCount = (orgId: string) =>
  useQuery({
    queryKey: notificationKeys.unread(orgId),
    queryFn: async () =>
      (await api.get<{ data: { count: number } }>(`${base(orgId)}/unread-count`)).data.data.count,
    refetchInterval: 30_000,
    retry: false,
  });

// Newest first, cursor-paged (FR-NOT-04).
export const useNotifications = (orgId: string, limit = 20, enabled = true) =>
  useInfiniteQuery({
    queryKey: notificationKeys.list(orgId, limit),
    queryFn: async ({ pageParam }) =>
      (
        await api.get<CursorPage<Notification>>(base(orgId), {
          params: { limit, cursor: pageParam ?? undefined },
        })
      ).data,
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.pagination.nextCursor,
    enabled,
  });

export const useMarkRead = (orgId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`${base(orgId)}/${id}/read`),
    onMutate: (id) => {
      // Optimistic: the item looks read and the badge drops at once.
      qc.setQueriesData<InfiniteData<CursorPage<Notification>>>(
        { queryKey: [...notificationKeys.all(orgId), "list"] },
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((p) => ({
              ...p,
              data: p.data.map((n) => (n.id === id ? { ...n, read: true } : n)),
            })),
          },
      );
      qc.setQueryData<number>(notificationKeys.unread(orgId), (c) => Math.max(0, (c ?? 1) - 1));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all(orgId) }),
  });
};

export const useMarkAllRead = (orgId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`${base(orgId)}/read-all`),
    onSuccess: () => qc.setQueryData(notificationKeys.unread(orgId), 0),
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all(orgId) }),
  });
};
