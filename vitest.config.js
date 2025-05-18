// eslint-disable-next-line import/no-unresolved
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["test/helpers/setup.js"],
    clearMocks: true,
    threads: true,
    testTimeout: 10_000,
  },
});
