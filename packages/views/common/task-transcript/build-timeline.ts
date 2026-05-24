import type { TaskMessagePayload } from "@multica/core/types/events";
import { redactSecrets } from "./redact";

/** A unified timeline entry: tool calls, thinking, text, and errors in chronological order. */
export interface TimelineItem {
  seq: number;
  type: "tool_use" | "tool_result" | "tool_progress" | "thinking" | "text" | "error";
  tool?: string;
  content?: string;
  input?: Record<string, unknown>;
  output?: string;
}

/** Build a chronologically ordered timeline from raw task messages. */
export function buildTimeline(msgs: TaskMessagePayload[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const msg of msgs) {
    items.push({
      seq: msg.seq,
      type: msg.type,
      tool: msg.tool,
      content: msg.content ? redactSecrets(msg.content) : msg.content,
      input: msg.input,
      output: msg.output ? redactSecrets(msg.output) : msg.output,
    });
  }
  return items.sort((a, b) => a.seq - b.seq);
}

/** For historical (non-live) views, compress tool_progress messages out of the timeline. */
export function compressTimeline(items: TimelineItem[]): TimelineItem[] {
  return items.filter((item) => item.type !== "tool_progress");
}
