import * as NodeModule from "node:module";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeChildProcess from "node:child_process";
import * as NodeURL from "node:url";

// PNPM isolates optional peers; the runner and Effect tests must use the same Vitest instance.
const root = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "..");
const [workspace = "apps/mobile", ...args] = process.argv.slice(2);
const cwd = NodePath.resolve(root, workspace);
if (!["apps/mobile", "packages/client-runtime"].includes(workspace))
  throw new Error("Unknown test workspace");
const localRequire = NodeModule.createRequire(NodePath.resolve(cwd, "package.json"));
const effectRequire = NodeModule.createRequire(
  NodeFS.realpathSync(localRequire.resolve("@effect/vitest/package.json")),
);
const runner = NodePath.resolve(
  NodePath.dirname(effectRequire.resolve("vite-plus/package.json")),
  "bin/vp",
);
const result = NodeChildProcess.spawnSync(process.execPath, [runner, "test", "run", ...args], {
  cwd,
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
