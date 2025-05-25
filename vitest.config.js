// eslint-disable-next-line import/no-unresolved
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "test/helpers/global-setup.js",
    exclude: ["node_modules", "**/node_modules/**"],
    clearMocks: true,
    threads: true,
    testTimeout: 10_000,
  },
});
