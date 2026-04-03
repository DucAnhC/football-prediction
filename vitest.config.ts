import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "server-only": resolve(__dirname, "src/tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
  },
});
