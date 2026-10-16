export default {
  fetch(request) {
    return new Response(`Hello from ${new URL(request.url).pathname}`);
  },
} satisfies ExportedHandler;
