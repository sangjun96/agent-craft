// Plain object instead of `defineConfig` from "cf/config": cf is only used as a CLI here.
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
      DB: { type: "d1", name: "agent-craft", id: "a06887c0-adb6-4e38-96d8-95b5a3ded0d9" },
      OPENROUTER_API_KEY: { type: "secret" },
      RESOURCES: { type: "r2", name: "agent-craft-resources" },
    },
  },
};
