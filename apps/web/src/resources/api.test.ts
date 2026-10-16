import { afterEach, expect, test, vi } from "vite-plus/test";
import { deleteResource, listResources, renameResource, uploadResource } from "./api.ts";

const resource = {
  id: "abc",
  name: "빨간-머그컵.jpg",
  originalName: "IMG_0001.jpg",
  contentType: "image/jpeg",
  size: 10,
  shapeHash: null,
  createdAt: 0,
};

function stubFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>(async () => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function lastRequest(fetchMock: ReturnType<typeof stubFetch>) {
  const [input, init] = fetchMock.mock.calls.at(-1)!;
  // The client passes a relative URL string, which Request needs resolved against an origin.
  return new Request(new URL(input as string, "http://localhost"), init);
}

afterEach(() => vi.unstubAllGlobals());

test("listResources gets /api/resources", async () => {
  const fetchMock = stubFetch(Response.json([resource]));
  expect(await listResources()).toEqual([resource]);
  const request = lastRequest(fetchMock);
  expect(request.method).toBe("GET");
  expect(new URL(request.url).pathname).toBe("/api/resources");
});

test("uploadResource posts the file as multipart form data", async () => {
  const fetchMock = stubFetch(Response.json(resource, { status: 201 }));
  await uploadResource(new File(["x"], "a.png", { type: "image/png" }));
  const request = lastRequest(fetchMock);
  expect(request.method).toBe("POST");
  expect(new URL(request.url).pathname).toBe("/api/resources");
  expect(((await request.formData()).get("file") as File).name).toBe("a.png");
});

test("renameResource patches the name as JSON", async () => {
  const fetchMock = stubFetch(Response.json(resource));
  await renameResource("abc", "새 이름");
  const request = lastRequest(fetchMock);
  expect(request.method).toBe("PATCH");
  expect(new URL(request.url).pathname).toBe("/api/resources/abc");
  expect(await request.json()).toEqual({ name: "새 이름" });
});

test("deleteResource resolves on 204", async () => {
  const fetchMock = stubFetch(new Response(null, { status: 204 }));
  await expect(deleteResource("abc")).resolves.toBeUndefined();
  expect(lastRequest(fetchMock).method).toBe("DELETE");
});

test("failed requests throw the server's error message", async () => {
  stubFetch(Response.json({ error: "이미지가 너무 큽니다" }, { status: 400 }));
  await expect(uploadResource(new File(["x"], "a.png"))).rejects.toThrow("이미지가 너무 큽니다");
});

test("failed requests without a JSON body throw the HTTP status", async () => {
  stubFetch(new Response("boom", { status: 500 }));
  await expect(listResources()).rejects.toThrow("HTTP 500");
});
