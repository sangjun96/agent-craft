import { AGENTS } from "@/agents/catalog";
import { AgentCard } from "@/components/agent-card";
import { Typography } from "@/components/typography";

export function HomePage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-12 sm:px-6">
      <Typography variant="h1">agent-craft</Typography>
      <Typography variant="lead">에이전트 실험을 위한 작업 공간입니다.</Typography>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {AGENTS.map((definition) => (
          <AgentCard key={definition.slug} definition={definition} />
        ))}
      </div>
    </main>
  );
}
