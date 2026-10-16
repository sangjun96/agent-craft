import { CONFIDENCE_THRESHOLD, MAX_BRANCHES } from "../../../worker/agents/curriculum/constants.ts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ResultViewProps } from "../catalog.ts";
import { formatCost, formatDuration } from "../format.ts";
import { ClassificationList } from "./classification-list.tsx";
import { CurriculumFlow } from "./curriculum-flow.tsx";
import { summarizeRun, type Part } from "./summary.ts";
import { useCurriculumRun, useNow } from "./use-curriculum-run.ts";

export function CurriculumResultView({ agent, runId }: ResultViewProps) {
  const run = useCurriculumRun(agent, runId);
  const running = run?.status === "running";
  const now = useNow(running);
  if (!run) return <p className="text-sm text-muted-foreground">불러오는 중…</p>;

  const { llm, jev, total } = summarizeRun(run, now);
  return (
    <div className="flex flex-col gap-4">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b text-right">
            <th className="py-1 text-left font-normal">구분</th>
            <th className="py-1 font-normal">소요 시간</th>
            <th className="py-1 font-normal">비용</th>
            <th className="py-1 font-normal">토큰 (입력/출력)</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          <Row label="일반 LLM · 문항 추출" part={llm} />
          <Row label={`Jev · 분류 (${jev.calls}회 호출)`} part={jev} />
          <Row label="합계" part={total} bold />
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">
        확률이 {CONFIDENCE_THRESHOLD * 100}% 이상이면 1순위만, 미만이면 상위 {MAX_BRANCHES}개를
        따라갑니다.
      </p>
      {run.error && (
        <Alert variant="destructive">
          <AlertDescription>{run.error}</AlertDescription>
        </Alert>
      )}
      <Tabs defaultValue="graph">
        <TabsList>
          <TabsTrigger value="graph">그래프</TabsTrigger>
          <TabsTrigger value="result">결과</TabsTrigger>
        </TabsList>
        <TabsContent value="graph">
          <CurriculumFlow run={run} />
        </TabsContent>
        <TabsContent value="result">
          <ClassificationList run={run} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, part, bold }: { label: string; part: Part; bold?: boolean }) {
  const { usage, durationMs } = part;
  return (
    <tr className={bold ? "border-t font-medium" : undefined}>
      <td className="py-1 text-left">{label}</td>
      <td className="py-1 text-right">
        {durationMs === undefined ? "…" : formatDuration(durationMs)}
      </td>
      <td className="py-1 text-right">{formatCost(usage.cost)}</td>
      <td className="py-1 text-right">
        {usage.inputTokens.toLocaleString("ko-KR")} / {usage.outputTokens.toLocaleString("ko-KR")}
      </td>
    </tr>
  );
}
