import { Agent, callable } from "agents";
import { createSystemOne, type ImagePart } from "ai-services/system-one";
import type { Env } from "../../env.ts";
import { buildQuestions, toResult, validateImage } from "./bbox.ts";
import type {
  AgentStatusState,
  BboxResult,
  BboxRun,
  RunStatus,
  RunSummary,
  Usage,
} from "../types.ts";

const RECENT_RUNS = 10;

type RunRow = {
  id: string;
  status: RunStatus;
  target: string;
  image: string;
  created_at: number;
  finished_at: number | null;
  result: string | null;
  usage: string | null;
  error: string | null;
};

type Outcome = { status: "done" | "error"; result?: BboxResult; usage?: Usage; error?: string };

/** Finds a described target in an image with System One (Decision) and keeps a history of runs. */
export class BboxAgent extends Agent<Env, AgentStatusState> {
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
      target TEXT NOT NULL,
      image TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      finished_at INTEGER,
      result TEXT,
      usage TEXT,
      error TEXT
    )`;
    // A run still marked running after a restart was cut off by eviction and will never finish.
    for (const { id } of this.sql<{ id: string }>`SELECT id FROM runs WHERE status = 'running'`) {
      this.finish(id, { status: "error", error: "실행이 중단되었습니다" });
    }
  }

  @callable()
  async run(input: { image: string; target: string }): Promise<string> {
    const target = input.target.trim();
    if (this.state.status === "running") throw new Error("이미 실행 중입니다");
    if (!target) throw new Error("찾을 대상을 입력하세요");
    validateImage(input.image);

    const id = crypto.randomUUID();
    const createdAt = Date.now();
    this.sql`INSERT INTO runs (id, status, target, image, created_at)
      VALUES (${id}, 'running', ${target}, ${input.image}, ${createdAt})`;
    const summary: RunSummary = { id, status: "running", label: target, createdAt };
    this.setState({
      ...this.state,
      status: "running",
      step: "System One 호출 중",
      progress: 0.3,
      recentRuns: [summary, ...this.state.recentRuns].slice(0, RECENT_RUNS),
    });

    let usage: Usage | undefined;
    const systemOne = createSystemOne({
      apiKey: this.env.OPENROUTER_API_KEY,
      onUsage: (u) => {
        usage = { inputTokens: u.inputTokens, outputTokens: u.outputTokens, cost: u.cost ?? 0 };
      },
    });
    const image: ImagePart = { type: "image_url", image_url: { url: input.image } };

    try {
      const answers = await this.keepAliveWhile(() =>
        systemOne.decide([`Find ${target} in this image:`, image], buildQuestions(target)),
      );
      this.finish(id, { status: "done", result: toResult(answers), usage });
    } catch (error) {
      this.finish(id, {
        status: "error",
        usage,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return id;
  }

  @callable()
  getRun(id: string): BboxRun | null {
    const [row] = this.sql<RunRow>`SELECT * FROM runs WHERE id = ${id}`;
    return row ? toRun(row) : null;
  }

  /** Newest first, without images. */
  @callable()
  listRuns(limit = 50): RunSummary[] {
    return this.sql<RunRow>`SELECT id, status, target, created_at, finished_at, usage, error
      FROM runs ORDER BY created_at DESC LIMIT ${limit}`.map(toSummary);
  }

  private finish(id: string, outcome: Outcome) {
    const finishedAt = Date.now();
    this.sql`UPDATE runs SET
      status = ${outcome.status},
      finished_at = ${finishedAt},
      result = ${outcome.result ? JSON.stringify(outcome.result) : null},
      usage = ${outcome.usage ? JSON.stringify(outcome.usage) : null},
      error = ${outcome.error ?? null}
      WHERE id = ${id}`;

    const total = this.state.usage;
    const usage = outcome.usage;
    this.setState({
      ...this.state,
      status: outcome.status,
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
          ? { ...run, status: outcome.status, finishedAt, usage, error: outcome.error }
          : run,
      ),
    });
  }
}

function toSummary(row: RunRow): RunSummary {
  return {
    id: row.id,
    status: row.status,
    label: row.target,
    createdAt: row.created_at,
    finishedAt: row.finished_at ?? undefined,
    usage: row.usage ? (JSON.parse(row.usage) as Usage) : undefined,
    error: row.error ?? undefined,
  };
}

function toRun(row: RunRow): BboxRun {
  return {
    ...toSummary(row),
    target: row.target,
    image: row.image,
    result: row.result ? (JSON.parse(row.result) as BboxResult) : undefined,
  };
}
