import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      // The Agents SDK runs SQL statements as tagged templates (this.sql`...`).
      "no-unused-expressions": ["warn", { allowTaggedTemplates: true }],
    },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
});
