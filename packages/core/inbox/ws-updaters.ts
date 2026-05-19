import type { QueryClient } from "@tanstack/react-query";
import { inboxKeys } from "./queries";
import type { InboxItem, IssueStatus } from "../types";

export function onInboxNew(
  qc: QueryClient,
  wsId: string,
  _item: InboxItem,
) {
  // Use invalidateQueries instead of setQueryData — triggers a refetch that
  // reliably notifies all observers. The inbox list is small so this is cheap.
  qc.invalidateQueries({ queryKey: inboxKeys.list(wsId) });
  qc.invalidateQueries({ queryKey: inboxKeys.scopeCounts(wsId) });
}

// `inbox:batch-read` and `inbox:batch-archived` are emitted when the user
// runs a bulk endpoint (mark-all-read / archive-*). They can carry a `scope`
// filter (RFC v3 §C.5) and `inbox:batch-archived` additionally carries an
// `operation` (RFC v4 §1). We currently fall back to a generic invalidate
// for both — precise cache updates per operation+scope are a documented
// follow-up: the payload contract is already in place, so the optimization
// is a frontend-only change later.
export function onInboxBatch(qc: QueryClient, wsId: string) {
  qc.invalidateQueries({ queryKey: inboxKeys.list(wsId) });
  qc.invalidateQueries({ queryKey: inboxKeys.scopeCounts(wsId) });
}

export function onInboxIssueStatusChanged(
  qc: QueryClient,
  wsId: string,
  issueId: string,
  status: IssueStatus,
) {
  qc.setQueryData<InboxItem[]>(inboxKeys.list(wsId), (old) =>
    old?.map((i) =>
      i.issue_id === issueId ? { ...i, issue_status: status } : i,
    ),
  );
}

// Mirrors the DB-level ON DELETE CASCADE on inbox_item.issue_id: when an issue
// is deleted, all inbox items that referenced it are gone server-side, so drop
// them from the cache too.
export function onInboxIssueDeleted(
  qc: QueryClient,
  wsId: string,
  issueId: string,
) {
  qc.setQueryData<InboxItem[]>(inboxKeys.list(wsId), (old) =>
    old?.filter((i) => i.issue_id !== issueId),
  );
}

export function onInboxInvalidate(qc: QueryClient, wsId: string) {
  qc.invalidateQueries({ queryKey: inboxKeys.list(wsId) });
}
