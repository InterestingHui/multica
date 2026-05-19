"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createWorkspaceAwareStorage, registerForWorkspaceRehydration } from "../../platform/workspace-storage";
import { defaultStorage } from "../../platform/storage";
import type { InboxFilterScope } from "../../types";

// All three assignment chips, in stable display order. Used both for the
// "default = all selected" initial state and for callers that need to render
// chips deterministically.
export const INBOX_FILTER_SCOPES: readonly InboxFilterScope[] = [
  "me",
  "my_agent",
  "my_squad",
] as const;

interface InboxScopeState {
  // Persisted selection. The default is the full set so a freshly installed
  // app shows every notification — see RFC v3 §E.1 mode=all.
  selected: InboxFilterScope[];
  toggle: (scope: InboxFilterScope) => void;
  set: (scopes: InboxFilterScope[]) => void;
  selectAll: () => void;
  clear: () => void;
}

export const useInboxScopeStore = create<InboxScopeState>()(
  persist(
    (set) => ({
      selected: [...INBOX_FILTER_SCOPES],
      toggle: (scope) =>
        set((state) => ({
          selected: state.selected.includes(scope)
            ? state.selected.filter((s) => s !== scope)
            : [...state.selected, scope],
        })),
      set: (scopes) => set({ selected: scopes }),
      selectAll: () => set({ selected: [...INBOX_FILTER_SCOPES] }),
      clear: () => set({ selected: [] }),
    }),
    {
      name: "multica_inbox_scope",
      storage: createJSONStorage(() => createWorkspaceAwareStorage(defaultStorage)),
    },
  ),
);

registerForWorkspaceRehydration(() => useInboxScopeStore.persist.rehydrate());

// Resolved filter mode. Matches the three-state algorithm in RFC v3 §E.1:
//   - all: 3 selected → no `scope` is sent; selector keeps me/my_agent/my_squad/other/none
//   - subset: 1-2 selected → `scope=...` is sent; selector filters to the subset
//   - empty: 0 selected → don't request; show empty state, bulk disabled
export type InboxFilterMode = "all" | "subset" | "empty";

export interface InboxFilterResolution {
  mode: InboxFilterMode;
  // Scopes to send on the wire. `null` for mode="all" (omit param entirely),
  // a string[] for mode="subset", `[]` for mode="empty".
  scopes: InboxFilterScope[] | null;
}

export function resolveInboxFilter(
  selected: InboxFilterScope[],
): InboxFilterResolution {
  // Dedupe + restrict to the three valid chip values. "other" / "none" are
  // server-internal buckets and must never appear on the wire.
  const unique = new Set<InboxFilterScope>();
  for (const s of selected) {
    if (s === "me" || s === "my_agent" || s === "my_squad") unique.add(s);
  }
  if (unique.size === INBOX_FILTER_SCOPES.length) {
    return { mode: "all", scopes: null };
  }
  if (unique.size === 0) {
    return { mode: "empty", scopes: [] };
  }
  return {
    mode: "subset",
    scopes: INBOX_FILTER_SCOPES.filter((s) => unique.has(s)),
  };
}
