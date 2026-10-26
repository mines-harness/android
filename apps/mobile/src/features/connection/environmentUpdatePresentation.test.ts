import { describe, expect, it } from "vite-plus/test";
import { environmentUpdatePresentation } from "./environmentUpdatePresentation";

describe("host update connection presentation", () => {
  it.each(["downloading", "installing", "resuming"] as const)(
    "keeps manual reconnection unavailable during %s",
    (stage) => {
      const presentation = environmentUpdatePresentation({
        status: "running",
        stage,
        fromVersion: "0.1.14",
        targetVersion: "0.1.15",
      });
      expect(presentation?.canReconnect).toBe(false);
      expect(presentation?.version).toBe("Updating 0.1.14 → 0.1.15");
    },
  );

  it("describes the restart without showing an unrelated connection failure", () => {
    expect(
      environmentUpdatePresentation({
        status: "running",
        stage: "resuming",
        fromVersion: "0.1.14",
        targetVersion: "0.1.15",
      })?.label,
    ).toBe("Restarting and reconnecting…");
  });

  it("releases the reconnect control after completion or failure", () => {
    expect(environmentUpdatePresentation({ status: "idle" })).toBeNull();
    expect(
      environmentUpdatePresentation({
        status: "failed",
        stage: "resuming",
        fromVersion: "0.1.14",
        targetVersion: "0.1.15",
        message: "Host unavailable",
      }),
    ).toBeNull();
  });
});
