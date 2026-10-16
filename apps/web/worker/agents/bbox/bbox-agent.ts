import { callable } from "agents";
import { createSystemOne, type ImagePart } from "ai-services/system-one";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { bboxRuns } from "../../db/schema.ts";
import { DashboardAgent } from "../dashboard-agent.ts";
import { buildQuestions, toResult, validateImage } from "./bbox.ts";
import type { AgentStatusState, BboxResult, BboxRun, RunSummary, Usage } from "../types.ts";

const RECENT_RUNS = 10;

type RunRow = typeof bboxRuns.$inferSelect;
type SummaryRow = Omit<RunRow, "image" | "result">;

type Outcome = { status: "done" | "error"; result?: BboxResult; usage?: Usage; error?: string };

/** Finds a described target in an image with System One (Decision) and keeps a history of runs. */
export class BboxAgent extends DashboardAgent {
  initialState: AgentStatusState = {
    status: "idle",
    progress: 0,
    usage: { inputTokens: 0, outputTokens: 0, cost: 0, runs: 0 },
    recentRuns: [],
  };

  async onStart() {
    // A run still marked running after a restart was cut off by eviction and will never finish.
    const interrupted = await drizzle(this.env.DB)
      .select({ id: bboxRuns.id })
      .from(bboxRuns)
      .where(eq(bboxRuns.status, "running"));
    for (const { id } of interrupted) {
      await this.finish(id, { status: "error", error: "실행이 중단되었습니다" });
    }
  }

  async run(input: { image: string; target: string }): Promise<string> {
    const target = input.target.trim();
    if (this.state.status === "running") throw new Error("이미 실행 중입니다");
    if (!target) throw new Error("찾을 대상을 입력하세요");
    validateImage(input.image);

    const id = crypto.randomUUID();
    const createdAt = Date.now();
    await drizzle(this.env.DB).insert(bboxRuns).values({
      id,
      status: "running",
      target,
      image: input.image,
      createdAt,
    });
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
      await this.finish(id, { status: "done", result: toResult(answers), usage });
    } catch (error) {
      await this.finish(id, {
        status: "error",
        usage,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return id;
  }

  @callable()
  async getRun(id: string): Promise<BboxRun | null> {
    const row = await drizzle(this.env.DB).select().from(bboxRuns).where(eq(bboxRuns.id, id)).get();
    return row ? toRun(row) : null;
  }

  /** Newest first, without images. */
  @callable()
  async listRuns(limit = 50): Promise<RunSummary[]> {
    const rows = await drizzle(this.env.DB)
      .select({
        id: bboxRuns.id,
        status: bboxRuns.status,
        target: bboxRuns.target,
        createdAt: bboxRuns.createdAt,
        finishedAt: bboxRuns.finishedAt,
        usage: bboxRuns.usage,
        error: bboxRuns.error,
      })
      .from(bboxRuns)
      .orderBy(desc(bboxRuns.createdAt))
      .limit(limit);
    return rows.map(toSummary);
  }

  private async finish(id: string, outcome: Outcome) {
    const finishedAt = Date.now();
    await drizzle(this.env.DB)
      .update(bboxRuns)
      .set({
        status: outcome.status,
        finishedAt,
        result: outcome.result ?? null,
        usage: outcome.usage ?? null,
        error: outcome.error ?? null,
      })
      .where(eq(bboxRuns.id, id));

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

function toSummary(row: SummaryRow): RunSummary {
  return {
    id: row.id,
    status: row.status,
    label: row.target,
    createdAt: row.createdAt,
    finishedAt: row.finishedAt ?? undefined,
    usage: row.usage ?? undefined,
    error: row.error ?? undefined,
  };
}

function toRun(row: RunRow): BboxRun {
  return {
    ...toSummary(row),
    target: row.target,
    image: row.image,
    result: row.result ?? undefined,
  };
}
