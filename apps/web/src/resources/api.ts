import { hc } from "hono/client";
import type { api } from "../../worker/api.ts";
import type { Resource } from "../../worker/resources/types.ts";

export type { Resource };

const client = hc<typeof api>("/api").resources;

export function resourceFileUrl(id: string): string {
  return `/api/resources/${id}/file`;
}

export async function listResources(): Promise<Resource[]> {
  const response = await client.$get();
  if (!response.ok) throw await toError(response);
  return response.json();
}

/** Stores the file; the worker names an image with the LLM and a CSV by its file name, and hashes a CSV's header. */
export async function uploadResource(file: File): Promise<Resource> {
  const response = await client.$post({ form: { file } });
  if (!response.ok) throw await toError(response);
  return response.json();
}

export async function renameResource(id: string, name: string): Promise<Resource> {
  const response = await client[":id"].$patch({ param: { id }, json: { name } });
  if (!response.ok) throw await toError(response);
  return response.json();
}

export async function deleteResource(id: string): Promise<void> {
  const response = await client[":id"].$delete({ param: { id } });
  if (!response.ok) throw await toError(response);
}

/** Downloads the stored file as a File, ready for forms that take an upload. */
export async function fetchResourceFile(resource: Resource): Promise<File> {
  const response = await client[":id"].file.$get({ param: { id: resource.id } });
  if (!response.ok) throw new Error(`파일을 불러오지 못했습니다 (HTTP ${response.status})`);
  return new File([await response.blob()], resource.name, { type: resource.contentType });
}

async function toError(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
  return new Error(body?.error ?? `HTTP ${response.status}`);
}
