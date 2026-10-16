import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite-plus";

export default defineConfig(({ mode }) => ({
  // The Cloudflare plugin starts its own dev server, which conflicts with Vitest's.
  plugins: mode === "test" ? [] : [cloudflare({ viteEnvironment: { name: "worker" } })],
  environments: {
    worker: { build: { sourcemap: true } },
  },
}));
