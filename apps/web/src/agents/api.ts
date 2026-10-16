import { hc } from "hono/client";
import type { api } from "../../worker/api.ts";

const client = hc<typeof api>("/api").agents;

export async function runBboxAgent(input: { image: string; target: string }): Promise<string> {
  const response = await client["bbox-agent"].run.$post({ json: input });
  if (!response.ok) throw await toError(response);
  const { runId } = await response.json();
  return runId;
}

export async function runCurriculumAgent(input: {
  image: string;
  curriculumCsv: string;
}): Promise<string> {
  const response = await client["curriculum-classifier-agent"].run.$post({ json: input });
  if (!response.ok) throw await toError(response);
  const { runId } = await response.json();
  return runId;
}

async function toError(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
  return new Error(body?.error ?? `HTTP ${response.status}`);
}
