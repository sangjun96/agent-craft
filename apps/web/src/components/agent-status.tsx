import { Badge } from "@/components/ui/badge";
import type { AgentStatusState } from "../../worker/agents/types.ts";
import { formatCost, formatTime } from "@/agents/format";

const STATUS_BADGES = {
  idle: { label: "대기", variant: "outline" },
  running: { label: "실행 중", variant: "default" },
  done: { label: "완료", variant: "secondary" },
  error: { label: "실패", variant: "destructive" },
} as const;

/** Agent or run status; `undefined` while the agent connection is opening. */
export function StatusBadge({ status }: { status: AgentStatusState["status"] | undefined }) {
  if (!status) return <Badge variant="outline">연결 중…</Badge>;
  const { label, variant } = STATUS_BADGES[status];
  return <Badge variant={variant}>{label}</Badge>;
}

/** Current step, progress bar and cumulative usage of an agent. */
export function AgentStatusSummary({ state }: { state: AgentStatusState | undefined }) {
  if (!state) return null;
  const lastRun = state.recentRuns[0];
  return (
    <div className="flex flex-col gap-3">
      {state.status === "running" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">{state.step}</span>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${state.progress * 100}%` }}
            />
          </div>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">실행 횟수</dt>
        <dd className="text-right tabular-nums">{state.usage.runs}</dd>
        <dt className="text-muted-foreground">토큰 (입력/출력)</dt>
        <dd className="text-right tabular-nums">
          {state.usage.inputTokens.toLocaleString("ko-KR")} /{" "}
          {state.usage.outputTokens.toLocaleString("ko-KR")}
        </dd>
        <dt className="text-muted-foreground">누적 비용</dt>
        <dd className="text-right tabular-nums">{formatCost(state.usage.cost)}</dd>
        <dt className="text-muted-foreground">마지막 실행</dt>
        <dd className="text-right">{lastRun ? formatTime(lastRun.createdAt) : "-"}</dd>
      </dl>
    </div>
  );
}
