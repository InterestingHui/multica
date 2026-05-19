"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import {
  inboxScopeCountsOptions,
  inboxResourceAvailabilityOptions,
} from "@multica/core/inbox/queries";
import {
  useInboxScopeStore,
  INBOX_FILTER_SCOPES,
} from "@multica/core/inbox/stores";
import type { InboxFilterScope } from "@multica/core/types";
import { cn } from "@multica/ui/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@multica/ui/components/ui/tooltip";
import { useT } from "../../i18n";

const SCOPE_KEYS: readonly InboxFilterScope[] = INBOX_FILTER_SCOPES;

// Inbox assignment-filter chip row (RFC v3 §B/§D). Renders three chips with
// the disabled-but-selected state machine: a chip with the underlying
// resource (agent / squad) missing is dimmed, and the user's saved selection
// is preserved silently so the chip springs back to life when the resource
// returns.
export function InboxFilterChips() {
  const { t } = useT("inbox");
  const wsId = useWorkspaceId();
  const { data: counts } = useQuery(inboxScopeCountsOptions(wsId));
  const { data: resources } = useQuery(inboxResourceAvailabilityOptions(wsId));
  const selected = useInboxScopeStore((s) => s.selected);
  const toggle = useInboxScopeStore((s) => s.toggle);

  // Resource availability defaults to "true" while loading so the chips stay
  // interactive on first paint — a one-frame flash to disabled would feel
  // worse than the rare edge of letting a user click a chip that briefly
  // ends up empty.
  const hasMyAgent = resources?.has_my_agent ?? true;
  const hasMySquad = resources?.has_my_squad ?? true;

  return (
    <TooltipProvider>
      <div
        className="flex items-center gap-1.5 border-b px-3 py-2"
        role="group"
        aria-label={t(($) => $.filter.aria_label)}
      >
        {SCOPE_KEYS.map((scope) => {
          const isSelected = selected.includes(scope);
          const disabled =
            (scope === "my_agent" && !hasMyAgent) ||
            (scope === "my_squad" && !hasMySquad);
          const count = counts?.[scope] ?? 0;
          const label =
            scope === "me"
              ? t(($) => $.filter.scopes.me)
              : scope === "my_agent"
                ? t(($) => $.filter.scopes.my_agent)
                : t(($) => $.filter.scopes.my_squad);
          const tooltipText = disabled
            ? isSelected
              ? scope === "my_agent"
                ? t(($) => $.filter.tooltip.no_agent_selected)
                : t(($) => $.filter.tooltip.no_squad_selected)
              : scope === "my_agent"
                ? t(($) => $.filter.tooltip.no_agent)
                : t(($) => $.filter.tooltip.no_squad)
            : null;

          const button = (
            <button
              type="button"
              aria-pressed={isSelected}
              aria-disabled={disabled}
              disabled={disabled && !isSelected}
              onClick={() => {
                // Disabled-but-selected chips remain interactive: clicking
                // them should be able to deselect, otherwise the user has no
                // way to drop a stale preference besides editing storage.
                if (disabled && !isSelected) return;
                toggle(scope);
              }}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                isSelected
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
                disabled && (isSelected ? "opacity-60" : "opacity-45 cursor-not-allowed"),
              )}
            >
              <span>{label}</span>
              {count > 0 && (
                <span className="text-[10px] text-muted-foreground">{count}</span>
              )}
            </button>
          );

          if (!tooltipText) return <span key={scope}>{button}</span>;
          return (
            <Tooltip key={scope}>
              <TooltipTrigger render={button} />
              <TooltipContent>{tooltipText}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
