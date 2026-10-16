import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { BboxRun } from "../../../worker/agents/types.ts";
import type { ResultViewProps } from "../catalog.ts";
import { formatUsage } from "../format.ts";
import { boxToStyle } from "./box.ts";

export function BboxResultView({ agent, runId }: ResultViewProps) {
  const [run, setRun] = useState<BboxRun | null>(null);
  const { call } = agent;
  // Refetch when the run's status changes so a running run shows its result once it finishes.
  const status = agent.state?.recentRuns.find((r) => r.id === runId)?.status;

  useEffect(() => {
    let cancelled = false;
    call<BboxRun | null>("getRun", [runId]).then(
      (result) => !cancelled && setRun(result),
      () => !cancelled && setRun(null),
    );
    return () => {
      cancelled = true;
    };
  }, [call, runId, status]);

  if (!run || run.id !== runId)
    return <p className="text-sm text-muted-foreground">불러오는 중…</p>;

  const { result } = run;
  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-fit max-w-full">
        <img
          src={run.image}
          alt={run.target}
          className="block max-h-[28rem] max-w-full rounded-md"
        />
        {result?.box && (
          <div
            className="absolute rounded-sm border-2 border-primary bg-primary/10"
            style={boxToStyle(result.box)}
          />
        )}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">대상</dt>
        <dd>{run.target}</dd>
        {result?.present !== undefined && (
          <>
            <dt className="text-muted-foreground">존재 확률</dt>
            <dd>{(result.present * 100).toFixed(0)}%</dd>
          </>
        )}
        {result?.confidence !== undefined && (
          <>
            <dt className="text-muted-foreground">bbox 신뢰도</dt>
            <dd>{(result.confidence * 100).toFixed(0)}%</dd>
          </>
        )}
        {run.usage && (
          <>
            <dt className="text-muted-foreground">사용량</dt>
            <dd>{formatUsage(run.usage)}</dd>
          </>
        )}
      </dl>
      {run.error && (
        <Alert variant="destructive">
          <AlertDescription>{run.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
