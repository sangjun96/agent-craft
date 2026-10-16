import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { Link, useParams } from "react-router";
import { useAccess } from "@/access/use-access";
import { AGENTS, type AgentDefinition } from "@/agents/catalog";
import { formatTime } from "@/agents/format";
import { useDashboardAgent } from "@/agents/use-dashboard-agent";
import { AgentStatusSummary, StatusBadge } from "@/components/agent-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Typography } from "@/components/typography";
import { cn } from "@/lib/utils";
import type { RunSummary } from "../../worker/agents/types.ts";
import { NotFoundPage } from "./not-found-page.tsx";

export function AgentDetailPage() {
  const { slug } = useParams();
  const definition = AGENTS.find((agent) => agent.slug === slug);
  if (!definition) return <NotFoundPage />;
  // Keyed so switching agents resets the connection and selection.
  return <AgentDetail key={definition.slug} definition={definition} />;
}

function AgentDetail({ definition }: { definition: AgentDefinition }) {
  const { canEdit } = useAccess();
  const agent = useDashboardAgent(definition.slug);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const { call } = agent;
  const recentRuns = agent.state?.recentRuns;
  const { RunForm, ResultView } = definition;
  const activeId = selectedId ?? runs[0]?.id;

  // recentRuns changes whenever a run starts or finishes, so the full history follows it.
  useEffect(() => {
    let cancelled = false;
    call<RunSummary[]>("listRuns").then(
      (result) => !cancelled && setRuns(result),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [call, recentRuns]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-12 sm:px-6">
      <div className="flex flex-col items-start gap-2">
        <Button variant="ghost" size="sm" render={<Link to="/" />} nativeButton={false}>
          <ArrowLeftIcon data-icon="inline-start" />홈
        </Button>
        <div className="flex items-center gap-3">
          <Typography variant="h2" render={<h1 />}>
            {definition.title}
          </Typography>
          <StatusBadge status={agent.state?.status} />
        </div>
        <Typography variant="muted">{definition.description}</Typography>
      </div>

      <div className={cn("grid gap-4", canEdit && "md:grid-cols-2")}>
        {canEdit && (
          <Card>
            <CardHeader>
              <CardTitle>실행</CardTitle>
            </CardHeader>
            <CardContent>
              <RunForm agent={agent} onSubmitted={setSelectedId} />
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>사용량</CardTitle>
          </CardHeader>
          <CardContent>
            <AgentStatusSummary state={agent.state} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        <Card size="sm">
          <CardHeader>
            <CardTitle>실행 이력</CardTitle>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 실행한 적이 없습니다.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {runs.map((run) => (
                  <li key={run.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(run.id)}
                      className={cn(
                        "flex w-full flex-col items-start gap-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                        run.id === activeId && "bg-muted",
                      )}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="truncate font-medium">{run.label}</span>
                        <StatusBadge status={run.status} />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(run.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>결과</CardTitle>
          </CardHeader>
          <CardContent>
            {activeId ? (
              <ResultView agent={agent} runId={activeId} />
            ) : (
              <p className="text-sm text-muted-foreground">실행 이력에서 항목을 선택하세요.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
