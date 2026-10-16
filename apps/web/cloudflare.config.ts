// Plain object instead of `defineConfig` from "cf/config": cf is only used as a CLI here.
export default {
  worker: {
    name: "web",
    compatibilityDate: "2026-10-16",
    compatibilityFlags: ["nodejs_compat"],
    entrypoint: "./worker/index.ts",
    // Only the custom domain, which sits behind Cloudflare Access.
    domains: ["agent-craft.promptpointer.dev"],
    workersDev: false,
    previewUrls: false,
    assets: {
      notFoundHandling: "single-page-application",
      runWorkerFirst: ["/api/*", "/agents/*"],
    },
    exports: {
      BboxAgent: { type: "durable-object", storage: "sqlite" },
      CurriculumClassifierAgent: { type: "durable-object", storage: "sqlite" },
    },
    env: {
      BboxAgent: { type: "durable-object", worker: "web", exportName: "BboxAgent" },
      CurriculumClassifierAgent: {
        type: "durable-object",
        worker: "web",
        exportName: "CurriculumClassifierAgent",
      },
      DB: { type: "d1", name: "agent-craft", id: "a06887c0-adb6-4e38-96d8-95b5a3ded0d9" },
      OPENROUTER_API_KEY: { type: "secret" },
      // Cloudflare Access application: team domain (JWT issuer) and its Application Audience tag.
      POLICY_AUD: {
        type: "text",
        value: "6341c4869f5e8c4beba134b12055afb39c2fb4b6607241ddc203870702fdf0a7",
      },
      TEAM_DOMAIN: { type: "text", value: "https://prompt-pointer.cloudflareaccess.com" },
      RESOURCES: { type: "r2", name: "agent-craft-resources" },
    },
  },
};
