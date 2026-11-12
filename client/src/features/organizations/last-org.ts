import type { MyOrganization } from "@nexora/shared";

// Sprint 2 decision Q3: the last used organization lives in localStorage (per user),
// a UI convenience only. Never trusted for access — the server checks membership.

const key = (userId: string) => `nexora.lastOrg.${userId}`;

export const rememberLastOrg = (userId: string, orgId: string): void => {
  try {
    localStorage.setItem(key(userId), orgId);
  } catch {
    // Storage blocked (private mode): just don't remember.
  }
};

// The remembered organization if the user still belongs to it, else the first one.
export const pickHomeOrg = (userId: string, orgs: MyOrganization[]): MyOrganization | undefined => {
  let remembered: string | null = null;
  try {
    remembered = localStorage.getItem(key(userId));
  } catch {
    // ignore
  }
  return orgs.find((o) => o.id === remembered) ?? orgs[0];
};
