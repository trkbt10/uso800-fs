import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    sequence: { concurrent: false },
    coverage: {
      provider: "v8",
      all: false,
      include: [
        "src/**/*.ts",
        "spec/**/*.ts",
      ],
      exclude: [
        "node_modules/**",
        "coverage/**",
        "dist/**",
        "build/**",
        "debug/**",
        "data/**",
        "eslint/**",
        "**/*.config.*",
      ],
      reporter: ["text", "lcov"],
    },
  },
});
