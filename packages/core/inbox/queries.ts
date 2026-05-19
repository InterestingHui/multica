import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type {
  InboxItem,
  InboxFilterScope,
  InboxScopeCounts,
  InboxResourceAvailability,
} from "../types";

export const inboxKeys = {
  all: (wsId: string) => ["inbox", wsId] as const,
  // The list key is intentionally a single key per workspace — the scope
  // filter is applied client-side on top of the full cached list (RFC v3
  // §E selector), so we don't fragment the cache by scope. When the user
  // changes chips we just re-derive from the same query.
  list: (wsId: string) => [...inboxKeys.all(wsId), "list"] as const,
  scopeCounts: (wsId: string) =>
    [...inboxKeys.all(wsId), "scope-counts"] as const,
  resourceAvailability: (wsId: string) =>
    [...inboxKeys.all(wsId), "resource-availability"] as const,
};

export function inboxListOptions(wsId: string) {
  return queryOptions({
    queryKey: inboxKeys.list(wsId),
    // Always fetch the full list (no scope param). The chip filter runs in
    // the selector — that way the badge counts and the dedupe logic always
    // operate on the complete picture, and toggling a chip is instant.
    queryFn: () => api.listInbox(),
  });
}

export function inboxScopeCountsOptions(wsId: string) {
  return queryOptions({
    queryKey: inboxKeys.scopeCounts(wsId),
    queryFn: () => api.getInboxScopeCounts(),
  });
}

export function inboxResourceAvailabilityOptions(wsId: string) {
  return queryOptions({
    queryKey: inboxKeys.resourceAvailability(wsId),
    queryFn: () => api.getInboxResourceAvailability(),
  });
}

/**
 * Unread inbox count for the given workspace, aligned with what the inbox
 * list UI renders: archived items excluded, then deduplicated by issue so a
 * single issue with three unread notifications counts once.
 */
export function useInboxUnreadCount(wsId: string | null | undefined): number {
  const { data } = useQuery({
    queryKey: inboxKeys.list(wsId ?? ""),
    queryFn: () => api.listInbox(),
    enabled: !!wsId,
    select: (items: InboxItem[]) =>
      deduplicateInboxItems(items).filter((i) => !i.read).length,
  });
  return data ?? 0;
}

/**
 * Deduplicate inbox items by issue_id (one entry per issue, Linear-style).
 * Exported for consumers to use in useMemo — not in queryOptions select
 * (to avoid new array references on every cache update).
 */
export function deduplicateInboxItems(items: InboxItem[]): InboxItem[] {
  const active = items.filter((i) => !i.archived);
  const groups = new Map<string, InboxItem[]>();
  for (const item of active) {
    const key = item.issue_id ?? item.id;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  const merged: InboxItem[] = [];
  for (const group of groups.values()) {
    group.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    if (group[0]) merged.push(group[0]);
  }
  return merged.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/**
 * Narrow a deduplicated inbox list to the user-selected chips. Applies the
 * RFC v3 §E selector rules: a strict subset of {me, my_agent, my_squad}
 * keeps only items tagged with one of those scopes (other/none are dropped);
 * a null filter (= "all" mode) passes everything through unchanged.
 *
 * `null` is the no-op signal. Pass `null` whenever you don't want to filter,
 * including the empty-mode case where the caller is also expected to render
 * an empty state instead of calling this.
 */
export function filterInboxByScope(
  items: InboxItem[],
  scopes: InboxFilterScope[] | null,
): InboxItem[] {
  if (!scopes) return items;
  const set = new Set(scopes);
  return items.filter((i) => {
    const s = i.assignee_scope;
    return s != null && (set as Set<string>).has(s);
  });
}

// Re-exports — kept for backwards compatibility with code importing the
// inbox scope-count / availability response shapes from this module.
export type { InboxScopeCounts, InboxResourceAvailability };
