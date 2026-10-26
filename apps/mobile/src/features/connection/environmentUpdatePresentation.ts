import type { ServerUpdateState } from "@t3tools/client-runtime/state/server";

export function environmentUpdatePresentation(state: ServerUpdateState) {
  if (state.status !== "running") return null;
  return {
    label:
      state.stage === "resuming"
        ? "Restarting and reconnecting…"
        : state.stage === "installing"
          ? "Installing update…"
          : "Downloading update…",
    version: `Updating ${state.fromVersion} → ${state.targetVersion}`,
    canReconnect: false,
  } as const;
}
