// Plain object instead of `defineConfig` from "cf/config": cf is installed globally, not as a project dependency.
export default {
  worker: {
    name: "web",
    compatibilityDate: "2026-10-16",
    compatibilityFlags: ["nodejs_compat"],
    entrypoint: "./worker/index.ts",
    assets: {
      notFoundHandling: "single-page-application",
      runWorkerFirst: ["/api/*", "/agents/*"],
    },
    exports: {
      BboxAgent: { type: "durable-object", storage: "sqlite" },
    },
    env: {
      BboxAgent: { type: "durable-object", worker: "web", exportName: "BboxAgent" },
      OPENROUTER_API_KEY: { type: "secret" },
    },
  },
};
