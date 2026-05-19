import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { inboxKeys } from "./queries";
import { useWorkspaceId } from "../hooks";
import type { InboxItem, InboxFilterScope } from "../types";

export function useMarkInboxRead() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (id: string) => api.markInboxRead(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: inboxKeys.list(wsId) });
      const prev = qc.getQueryData<InboxItem[]>(inboxKeys.list(wsId));
      qc.setQueryData<InboxItem[]>(inboxKeys.list(wsId), (old) =>
        old?.map((item) => (item.id === id ? { ...item, read: true } : item)),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(inboxKeys.list(wsId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: inboxKeys.list(wsId) });
      qc.invalidateQueries({ queryKey: inboxKeys.scopeCounts(wsId) });
    },
  });
}

export function useArchiveInbox() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (id: string) => api.archiveInbox(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: inboxKeys.list(wsId) });
      const prev = qc.getQueryData<InboxItem[]>(inboxKeys.list(wsId));
      // Archive all items for the same issue (same behavior as store)
      const target = prev?.find((i) => i.id === id);
      const issueId = target?.issue_id;
      qc.setQueryData<InboxItem[]>(inboxKeys.list(wsId), (old) =>
        old?.map((item) =>
          item.id === id || (issueId && item.issue_id === issueId)
            ? { ...item, archived: true }
            : item,
        ),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(inboxKeys.list(wsId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: inboxKeys.list(wsId) });
      qc.invalidateQueries({ queryKey: inboxKeys.scopeCounts(wsId) });
    },
  });
}

// All bulk mutations accept an optional `scope` parameter. When the caller
// is in mode=all (RFC v3 §E.1) it should pass undefined; when in mode=subset
// it should pass the resolved chip subset; in mode=empty the button is
// disabled and these mutations should not fire.
export function useMarkAllInboxRead() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (scope?: InboxFilterScope[]) => api.markAllInboxRead(scope),
    onMutate: async (scope) => {
      await qc.cancelQueries({ queryKey: inboxKeys.list(wsId) });
      const prev = qc.getQueryData<InboxItem[]>(inboxKeys.list(wsId));
      const inScope = scopeMatcher(scope);
      qc.setQueryData<InboxItem[]>(inboxKeys.list(wsId), (old) =>
        old?.map((item) =>
          !item.archived && inScope(item) ? { ...item, read: true } : item,
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(inboxKeys.list(wsId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: inboxKeys.list(wsId) });
      qc.invalidateQueries({ queryKey: inboxKeys.scopeCounts(wsId) });
    },
  });
}

export function useArchiveAllInbox() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (scope?: InboxFilterScope[]) => api.archiveAllInbox(scope),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: inboxKeys.list(wsId) });
      qc.invalidateQueries({ queryKey: inboxKeys.scopeCounts(wsId) });
    },
  });
}

export function useArchiveAllReadInbox() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (scope?: InboxFilterScope[]) => api.archiveAllReadInbox(scope),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: inboxKeys.list(wsId) });
      qc.invalidateQueries({ queryKey: inboxKeys.scopeCounts(wsId) });
    },
  });
}

export function useArchiveCompletedInbox() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (scope?: InboxFilterScope[]) => api.archiveCompletedInbox(scope),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: inboxKeys.list(wsId) });
      qc.invalidateQueries({ queryKey: inboxKeys.scopeCounts(wsId) });
    },
  });
}

// True when the inbox item belongs to the user-selected scope subset, or
// when no scope was passed (= mark/archive everything).
function scopeMatcher(scope?: InboxFilterScope[]) {
  if (!scope || scope.length === 0) return (_item: InboxItem) => true;
  const set = new Set(scope);
  return (item: InboxItem) => {
    const s = item.assignee_scope;
    return s != null && (set as Set<string>).has(s);
  };
}
