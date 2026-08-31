import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    globalSetup: "./tests/global-setup.ts",
    // Tests share one SQLite file and reset it around each test; running test
    // files in parallel would race on that file, so keep the suite sequential.
    fileParallelism: false,
    env: {
      DATABASE_URL: "file:./test.db",
    },
    testTimeout: 15000,
  },
});
