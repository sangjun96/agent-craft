import { callable } from "agents";
import { createLlm } from "ai-services/llm";
import { createSystemOne, type ImagePart } from "ai-services/system-one";
import * as z from "zod";
import { assertCsvShape, parseCsvRecords } from "../../resources/csv.ts";
import { validateImage } from "../bbox/bbox.ts";
import { DashboardAgent } from "../dashboard-agent.ts";
import type {
  AgentStatusState,
  CurriculumRun,
  QuestionTrace,
  RunStatus,
  RunSummary,
  Step,
  Usage,
} from "../types.ts";
import { classifyQuestion, type Decide } from "./classify.ts";
import { CURRICULUM_SHAPE_HASH, QUESTION_CONCURRENCY } from "./constants.ts";
import { buildTree, type CurriculumNode } from "./tree.ts";
import { runUsage } from "./usage.ts";

const RECENT_RUNS = 10;
// The CSV travels in an RPC message, so keep it well below the payload limit.
const MAX_CSV_BYTES = 1_000_000;

const EXTRACT_PROMPT = `이 수학 시험지 이미지에 있는 모든 문항의 번호를 위에서 아래, 왼쪽에서 오른쪽 순서로 추출해줘.
- 시험지에 인쇄된 번호 그대로 적을 것 (예: "1", "2", "서술형 1")
- 같은 번호를 중복해서 적지 말 것
- 문항이 아닌 번호(쪽수, 보기 번호 ①②③)는 제외`;
const extractSchema = z.object({ questions: z.array(z.object({ number: z.string() })) });

type RunRow = {
  id: string;
  status: RunStatus;
  label: string;
  created_at: number;
  finished_at: number | null;
  result: string | null;
  error: string | null;
};

type Detail = Pick<CurriculumRun, "extract" | "questions">;

/** Classifies each question of an exam image into the curriculum hierarchy with System One (Decision). */
export class CurriculumClassifierAgent extends DashboardAgent {
  initialState: AgentStatusState = {
    status: "idle",
    progress: 0,
    usage: { inputTokens: 0, outputTokens: 0, cost: 0, runs: 0 },
    recentRuns: [],
  };

  onStart() {
    this.sql`CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      finished_at INTEGER,
      result TEXT,
      error TEXT
    )`;
    // A run still marked running after a restart was cut off by eviction and will never finish.
    for (const { id } of this.sql<{ id: string }>`SELECT id FROM runs WHERE status = 'running'`) {
      this.finish(id, "error", "실행이 중단되었습니다");
    }
  }

  /** Validates the input and returns the run id right away; progress streams through `state.live`. */
  async run(input: { image: string; curriculumCsv: string }): Promise<string> {
    if (this.state.status === "running") throw new Error("이미 실행 중입니다");
    validateImage(input.image);
    const bytes = new TextEncoder().encode(input.curriculumCsv);
    if (bytes.length > MAX_CSV_BYTES) throw new Error("커리큘럼 CSV가 너무 큽니다 (최대 1MB)");
    await assertCsvShape(bytes, CURRICULUM_SHAPE_HASH);
    const tree = buildTree(parseCsvRecords(bytes).slice(1));

    const id = crypto.randomUUID();
    const createdAt = Date.now();
    const label = "시험지 분석 중";
    this
      .sql`INSERT INTO runs (id, status, label, created_at) VALUES (${id}, 'running', ${label}, ${createdAt})`;
    const live: CurriculumRun = {
      id,
      status: "running",
      label,
      createdAt,
      extract: { status: "running" },
      questions: [],
    };
    this.setState({
      ...this.state,
      status: "running",
      step: "문항 추출 중",
      progress: 0,
      recentRuns: [summarize(live), ...this.state.recentRuns].slice(0, RECENT_RUNS),
      live,
    });

    // Not awaited: the caller needs the id now to follow the run live.
    void this.keepAliveWhile(() => this.process(id, input.image, tree));
    return id;
  }

  @callable()
  getRun(id: string): CurriculumRun | null {
    const [row] = this.sql<RunRow>`SELECT * FROM runs WHERE id = ${id}`;
    return row ? toRun(row) : null;
  }

  /** Newest first, without the traces. */
  @callable()
  listRuns(limit = 50): RunSummary[] {
    return this.sql<RunRow>`SELECT * FROM runs ORDER BY created_at DESC LIMIT ${limit}`.map((row) =>
      summarize(toRun(row)),
    );
  }

  private async process(id: string, imageUrl: string, tree: CurriculumNode) {
    const image: ImagePart = { type: "image_url", image_url: { url: imageUrl } };
    try {
      const numbers = await this.extract(imageUrl);
      this.update((run) => ({
        ...run,
        label: `${numbers.length}개 문항`,
        questions: numbers.map((number) => ({ number, status: "running", steps: [] })),
      }));

      await mapPool(numbers, QUESTION_CONCURRENCY, (number) => this.classify(tree, number, image));
      this.finish(id, "done");
    } catch (error) {
      this.finish(id, "error", error instanceof Error ? error.message : String(error));
    }
  }

  private async extract(imageUrl: string): Promise<string[]> {
    const startedAt = Date.now();
    let usage: Usage | undefined;
    const llm = createLlm({
      apiKey: this.env.OPENROUTER_API_KEY,
      onUsage: (u) =>
        (usage = { inputTokens: u.inputTokens, outputTokens: u.outputTokens, cost: u.cost ?? 0 }),
    });
    try {
      const { questions } = await llm.generateObject(
        [
          { type: "text", text: EXTRACT_PROMPT },
          { type: "image_url", imageUrl: { url: imageUrl } },
        ],
        extractSchema,
      );
      const numbers = [...new Set(questions.map((question) => question.number.trim()))].filter(
        Boolean,
      );
      if (numbers.length === 0) throw new Error("시험지에서 문항을 찾지 못했습니다");
      this.update((run) => ({
        ...run,
        extract: { status: "done", usage, durationMs: Date.now() - startedAt },
      }));
      return numbers;
    } catch (error) {
      this.update((run) => ({
        ...run,
        extract: { status: "error", usage, durationMs: Date.now() - startedAt },
      }));
      throw error;
    }
  }

  private async classify(tree: CurriculumNode, number: string, image: ImagePart) {
    const startedAt = Date.now();
    const patch = (change: Partial<QuestionTrace>) =>
      this.update((run) => ({
        ...run,
        questions: run.questions.map((q) => (q.number === number ? { ...q, ...change } : q)),
      }));
    const decide: Decide = async (state, questions) => {
      // One client per call so each call's usage is captured on its own, however many run in parallel.
      let usage: Usage | undefined;
      const answers = await createSystemOne({
        apiKey: this.env.OPENROUTER_API_KEY,
        onUsage: (u) =>
          (usage = { inputTokens: u.inputTokens, outputTokens: u.outputTokens, cost: u.cost ?? 0 }),
      }).decide(state, questions);
      return { answers, usage };
    };

    try {
      const final = await classifyQuestion({
        tree,
        number,
        image,
        decide,
        onStep: (step) =>
          this.update((run) => ({
            ...run,
            questions: run.questions.map((q) =>
              q.number === number ? { ...q, steps: upsertStep(q.steps, step) } : q,
            ),
          })),
      });
      patch({ status: "done", final, durationMs: Date.now() - startedAt });
    } catch (error) {
      // One failed question must not sink the rest of the exam.
      patch({
        status: "error",
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Applies `change` to the live run and pushes it to every connected client. */
  private update(change: (run: CurriculumRun) => CurriculumRun) {
    const live = this.state.live;
    // A straggling step of an already finished run must not reopen it.
    if (live?.status !== "running") return;
    const next = change(live);
    const finished = next.questions.filter((q) => q.status !== "running").length;
    this.setState({
      ...this.state,
      step: `문항 ${finished}/${next.questions.length} 분류 중`,
      progress: next.questions.length > 0 ? finished / next.questions.length : 0,
      live: { ...next, usage: runUsage(next) },
    });
  }

  private finish(id: string, status: "done" | "error", error?: string) {
    const finishedAt = Date.now();
    const live = this.state.live?.id === id ? this.state.live : undefined;
    const detail: Detail | undefined = live && { extract: live.extract, questions: live.questions };
    const usage = live ? runUsage(live) : undefined;
    this.sql`UPDATE runs SET
      status = ${status},
      label = ${live?.label ?? "문항 분류"},
      finished_at = ${finishedAt},
      result = ${detail ? JSON.stringify(detail) : null},
      error = ${error ?? null}
      WHERE id = ${id}`;

    const total = this.state.usage;
    const finished: CurriculumRun | undefined = live && {
      ...live,
      status,
      finishedAt,
      usage,
      error,
    };
    this.setState({
      ...this.state,
      status,
      step: undefined,
      progress: 1,
      usage: {
        inputTokens: total.inputTokens + (usage?.inputTokens ?? 0),
        outputTokens: total.outputTokens + (usage?.outputTokens ?? 0),
        cost: total.cost + (usage?.cost ?? 0),
        runs: total.runs + 1,
      },
      recentRuns: this.state.recentRuns.map((run) =>
        run.id === id
          ? { ...run, label: finished?.label ?? run.label, status, finishedAt, usage, error }
          : run,
      ),
      live: finished ?? this.state.live,
    });
  }
}

function upsertStep(steps: Step[], step: Step): Step[] {
  return steps.some((s) => s.id === step.id)
    ? steps.map((s) => (s.id === step.id ? step : s))
    : [...steps, step];
}

function summarize({
  extract: _extract,
  questions: _questions,
  ...summary
}: CurriculumRun): RunSummary {
  return summary;
}

function toRun(row: RunRow): CurriculumRun {
  const detail: Detail = row.result
    ? (JSON.parse(row.result) as Detail)
    : { extract: { status: row.status }, questions: [] };
  const run: CurriculumRun = {
    id: row.id,
    status: row.status,
    label: row.label,
    createdAt: row.created_at,
    finishedAt: row.finished_at ?? undefined,
    error: row.error ?? undefined,
    ...detail,
  };
  return { ...run, usage: runUsage(run) };
}

/** Runs `fn` over `items` with at most `limit` in flight. */
async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]!);
    }),
  );
}
