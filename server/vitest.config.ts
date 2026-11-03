import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setupEnv.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    // Each suite starts its own in-memory MongoDB. Running suites in parallel
    // exhausts resources and makes mongod abort with fassert() on Windows/CI.
    fileParallelism: false,
  },
});
