/* oxlint-disable mines/no-global-process-runtime -- Native build bootstrap runs before any Effect runtime exists. */
import * as NodeChildProcess from "node:child_process";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import * as NodeOS from "node:os";

const root = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "..");
const mobile = NodePath.resolve(root, "apps/mobile");
const platform = process.argv[2];
if (platform !== "android" && platform !== "ios") throw new Error("Use android or ios");

const env = {
  ...process.env,
  APP_VARIANT: "preview",
  NODE_ENV: "production",
  EXPO_NO_DOTENV: "1",
  EXPO_PUBLIC_SHOWCASE: "0",
  MINES_CONTROL_URL: process.env.MINES_CONTROL_URL ?? "https://mines.gemstud.io",
  MINES_MOBILE_UPDATES_ENABLED: "0",
  MINES_EAS_PROJECT_ID: "",
  MINES_EAS_OWNER: "",
  MINES_APPLE_TEAM_ID: "",
  MINES_ANDROID_GOOGLE_SERVICES_FILE: "",
  T3CODE_IOS_PERSONAL_TEAM: "",
  EXPO_PUBLIC_OTLP_TRACES_URL: "",
  EXPO_PUBLIC_OTLP_TRACES_DATASET: "",
  EXPO_PUBLIC_OTLP_TRACES_TOKEN: "",
  MINES_MOBILE_OTLP_TRACES_URL: "",
  MINES_MOBILE_OTLP_TRACES_DATASET: "",
  MINES_MOBILE_OTLP_TRACES_TOKEN: "",
  pnpm_config_verify_deps_before_run: "false",
};
const control = new URL(env.MINES_CONTROL_URL);
if (control.protocol !== "https:" || control.username || control.password) {
  throw new Error("MINES_CONTROL_URL must be an HTTPS origin without credentials");
}

function run(command, args, cwd = mobile, extraEnv = {}) {
  const result = NodeChildProcess.spawnSync(command, args, {
    cwd,
    env: { ...env, ...extraEnv },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("pnpm", ["exec", "expo", "prebuild", "--platform", platform, "--no-install"]);
if (platform === "android") {
  const native = NodePath.resolve(mobile, "android");
  run(
    NodeOS.platform() === "win32" ? "gradlew.bat" : "./gradlew",
    [
      ":app:assembleRelease",
      `-PreactNativeArchitectures=${process.env.MINES_ANDROID_ARCHITECTURES ?? "arm64-v8a,x86_64"}`,
      "--max-workers=4",
      "--console=plain",
    ],
    native,
  );
  const output = NodePath.resolve(root, "release");
  NodeFS.mkdirSync(output, { recursive: true });
  const name = "mines-android-0.1.0-preview.1-test-signed.apk";
  const source = NodePath.resolve(native, "app/build/outputs/apk/release/app-release.apk");
  NodeFS.copyFileSync(source, NodePath.resolve(output, name));
  const checksum = NodeCrypto.createHash("sha256")
    .update(NodeFS.readFileSync(source))
    .digest("hex");
  NodeFS.writeFileSync(NodePath.resolve(output, "SHA256SUMS"), `${checksum}  ${name}\n`);
  console.log(`Test-signed preview APK: release/${name}`);
} else {
  if (NodeOS.platform() !== "darwin") throw new Error("The iOS simulator build requires macOS");
  const developerDir = process.env.DEVELOPER_DIR ?? "/Applications/Xcode.app/Contents/Developer";
  const native = NodePath.resolve(mobile, "ios");
  const lock = NodePath.resolve(root, "native-locks/Podfile.lock");
  if (NodeFS.existsSync(lock)) NodeFS.copyFileSync(lock, NodePath.resolve(native, "Podfile.lock"));
  const podEnv = { ...env, DEVELOPER_DIR: developerDir };
  const podCommand =
    process.env.MINES_COCOAPODS_BIN ??
    (NodeFS.existsSync("/opt/homebrew/bin/pod") ? "/opt/homebrew/bin/pod" : "pod");
  if (podCommand.startsWith("/opt/homebrew/")) {
    delete podEnv.GEM_HOME;
    delete podEnv.GEM_PATH;
  }
  const pod = NodeChildProcess.spawnSync(podCommand, ["install"], {
    cwd: native,
    env: podEnv,
    stdio: "inherit",
  });
  if (pod.error) throw pod.error;
  if (pod.status !== 0) process.exit(pod.status ?? 1);
  run(
    "xcodebuild",
    [
      "-workspace",
      "minesPreview.xcworkspace",
      "-scheme",
      "minesPreview",
      "-configuration",
      "Release",
      "-sdk",
      "iphonesimulator",
      "-destination",
      "generic/platform=iOS Simulator",
      "-derivedDataPath",
      NodePath.resolve(root, "release/ios-derived"),
      "CODE_SIGNING_ALLOWED=YES",
      "CODE_SIGN_IDENTITY=-",
      "CODE_SIGN_STYLE=Manual",
      "DEVELOPMENT_TEAM=",
      "PROVISIONING_PROFILE=",
      "PROVISIONING_PROFILE_SPECIFIER=",
      "CODE_SIGNING_REQUIRED=YES",
      "ONLY_ACTIVE_ARCH=YES",
      "ARCHS=arm64",
      "-jobs",
      "3",
      "build",
    ],
    native,
    { DEVELOPER_DIR: developerDir },
  );
}
