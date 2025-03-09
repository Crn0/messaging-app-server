// eslint-disable-next-line import/no-unresolved
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/test/**/*.test.js"],
    setupFiles: "./test/setup-db.js",
    clearMocks: true,
    threads: false,
  },
});
