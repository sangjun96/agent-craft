import { LEVELS } from "../../../worker/agents/curriculum/constants.ts";
import { questionUsage } from "../../../worker/agents/curriculum/usage.ts";
import type { CurriculumRun } from "../../../worker/agents/types.ts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCost, formatDuration } from "../format.ts";
import { finalLevels, type PathLevel } from "./trace.ts";

const percent = (value: number) => `${(value * 100).toFixed(0)}%`;

/** Per question, the chosen 대단원 → … → 세부유형 as nested lists with the probability of each choice. */
export function ClassificationList({ run }: { run: CurriculumRun }) {
  if (run.questions.length === 0) {
    return <p className="text-sm text-muted-foreground">문항을 추출하는 중입니다…</p>;
  }
  return (
    <ul className="flex flex-col gap-4">
      {run.questions.map((question) => (
        <li key={question.number} className="flex flex-col gap-2 rounded-md border p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium">{question.number}번</span>
            <span className="text-xs text-muted-foreground">
              {question.final && `종합 ${percent(question.final.score)} · `}
              {formatCost(questionUsage(question).cost)}
              {question.durationMs !== undefined && ` · ${formatDuration(question.durationMs)}`}
            </span>
          </div>
          {question.status === "running" && (
            <p className="text-sm text-muted-foreground">분류 중…</p>
          )}
          {question.error && (
            <Alert variant="destructive">
              <AlertDescription>{question.error}</AlertDescription>
            </Alert>
          )}
          {question.final && <PathTree levels={finalLevels(question)} />}
        </li>
      ))}
    </ul>
  );
}

function PathTree({ levels }: { levels: PathLevel[] }) {
  const [head, ...rest] = levels;
  if (!head) return null;
  return (
    <ul className="flex flex-col gap-1 border-l pl-3 first:border-l-0 first:pl-0">
      <li className="flex flex-col gap-1">
        <span className="flex items-baseline gap-2">
          <span className="w-12 shrink-0 text-xs text-muted-foreground">{LEVELS[head.level]}</span>
          <span>{head.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {percent(head.probability)}
          </span>
        </span>
        <PathTree levels={rest} />
      </li>
    </ul>
  );
}
