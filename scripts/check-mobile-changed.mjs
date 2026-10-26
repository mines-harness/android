import * as NodeChildProcess from "node:child_process";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const root = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "..");
const git = (args) => NodeChildProcess.spawnSync("git", args, { cwd: root, encoding: "utf8" });
const hasHead = git(["rev-parse", "--verify", "HEAD"]).status === 0;
const tracked = hasHead ? git(["diff", "--name-only", "HEAD"]).stdout : "";
const untracked = git(["ls-files", "--others", "--exclude-standard"]).stdout;
const paths = [...new Set(`${tracked}\n${untracked}`.split("\n"))].filter(
  (path) => /\.(?:[cm]?[jt]sx?|json|md|css)$/.test(path) && !path.includes("/Vendor/"),
);
if (paths.length === 0) {
  console.log(
    "No changed source files. Full validation: pnpm test:mobile && pnpm typecheck:mobile",
  );
} else {
  function run(command, args) {
    const result = NodeChildProcess.spawnSync(command, args, { cwd: root, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  const vp = NodePath.resolve(root, "node_modules/.bin/vp");
  run(vp, ["fmt", "--check", ...paths]);
  const code = paths.filter((path) => /\.(?:[cm]?[jt]sx?)$/.test(path));
  if (code.length > 0) run(vp, ["lint", ...code]);
  run(vp, ["run", "--filter", "@t3tools/mobile", "typecheck"]);
}
