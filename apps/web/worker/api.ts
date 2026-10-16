export function handleApi(request: Request): Response {
  return new Response(`Hello from ${new URL(request.url).pathname}`);
}
