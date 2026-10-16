import type { Resource } from "../../worker/resources/types.ts";

export type { Resource };

export function resourceFileUrl(id: string): string {
  return `/api/resources/${id}/file`;
}

export function listResources(signal?: AbortSignal): Promise<Resource[]> {
  return request("/api/resources", { signal });
}

/** Stores the image; the worker names it with the LLM before responding. */
export function uploadResource(file: File): Promise<Resource> {
  const body = new FormData();
  body.append("file", file);
  return request("/api/resources", { method: "POST", body });
}

export function renameResource(id: string, name: string): Promise<Resource> {
  return request(`/api/resources/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function deleteResource(id: string): Promise<void> {
  await request(`/api/resources/${id}`, { method: "DELETE" });
}

/** Downloads the stored image as a File, ready for forms that take an upload. */
export async function fetchResourceFile(resource: Resource): Promise<File> {
  const response = await fetch(resourceFileUrl(resource.id));
  if (!response.ok) throw new Error(`이미지를 불러오지 못했습니다 (HTTP ${response.status})`);
  return new File([await response.blob()], resource.name, { type: resource.contentType });
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    throw new Error(body?.error ?? `HTTP ${response.status}`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}
