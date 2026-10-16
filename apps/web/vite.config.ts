import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // The Cloudflare plugin starts its own dev server, which conflicts with Vitest's.
    ...(mode === "test" ? [] : [cloudflare({ viteEnvironment: { name: "worker" } })]),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  environments: {
    worker: { build: { sourcemap: true } },
  },
}));
