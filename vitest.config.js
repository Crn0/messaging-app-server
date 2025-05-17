// eslint-disable-next-line import/no-unresolved
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "test/helpers/global-teardown.js",
    include: ["src/**/*.test.js"],
    clearMocks: true,
    threads: true,
    testTimeout: 10_000,
  },
});
