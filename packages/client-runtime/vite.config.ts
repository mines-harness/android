import * as NodeModule from "node:module";
import "vite-plus/test/config";
import { defineConfig } from "vite-plus";

const localRequire = NodeModule.createRequire(import.meta.url);
const effectTestRequire = NodeModule.createRequire(
  localRequire.resolve("@effect/vitest/package.json"),
);

export default defineConfig({
  resolve: {
    alias: {
      "vite-plus/test": effectTestRequire.resolve("vite-plus/test").replace(/\.cjs$/u, ".js"),
    },
    dedupe: ["vite-plus", "@voidzero-dev/vite-plus-core"],
  },
  test: {
    maxWorkers: 4,
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["../shared/src/testing/longTempDir.ts", "../shared/src/testing/providerEnv.ts"],
  },
});
