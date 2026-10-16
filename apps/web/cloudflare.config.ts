// Plain object instead of `defineConfig` from "cf/config": cf is installed globally, not as a project dependency.
export default {
  worker: {
    name: "web",
    compatibilityDate: "2026-10-16",
    entrypoint: "./worker/index.ts",
    assets: {
      notFoundHandling: "single-page-application",
      runWorkerFirst: ["/api/*"],
    },
  },
};
