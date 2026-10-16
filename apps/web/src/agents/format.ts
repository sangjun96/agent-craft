import type { Usage } from "../../worker/agents/types.ts";

const tokens = new Intl.NumberFormat("ko-KR");
const dateTime = new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "medium" });
const date = new Intl.DateTimeFormat("ko-KR", { dateStyle: "short" });

export function formatUsage(usage: Usage): string {
  return `입력 ${tokens.format(usage.inputTokens)} · 출력 ${tokens.format(usage.outputTokens)} 토큰 · ${formatCost(usage.cost)}`;
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(6)}`;
}

export function formatTime(timestamp: number): string {
  return dateTime.format(timestamp);
}

export function formatDate(timestamp: number): string {
  return date.format(timestamp);
}

export function formatDuration(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}초`;
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}
