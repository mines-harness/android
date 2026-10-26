import { describe, expect, it } from "vite-plus/test";

import { shouldHandleAppLink, restoreDraftLinkState, normalizePairingLinkPath } from "./appLinking";

describe("shouldHandleAppLink", () => {
  it.each([
    "mines://",
    "mines:///",
    "mines-dev://",
    "mines-preview://",
    "t3code://",
    "t3code:///",
    "t3code-dev://",
    "t3code-preview://",
  ])("ignores scheme-only URL %s", (url) => {
    expect(shouldHandleAppLink(url)).toBe(false);
  });

  it.each([
    "t3code://threads/env-1/thread-1",
    "t3code://pair?pairingUrl=x",
    "t3code-dev://settings/usage?tab=limits",
  ])("handles path-bearing URL %s", (url) => {
    expect(shouldHandleAppLink(url)).toBe(true);
  });

  it.each(["t3code://expo-development-client/?url=x", "t3code://expo-sharing/anything"])(
    "ignores lifecycle URL %s",
    (url) => {
      expect(shouldHandleAppLink(url)).toBe(false);
    },
  );
});

describe("draft deep links", () => {
  it("opens the old draft URL on the thread screen with its draft identity", () => {
    const draft = { projectId: "project-1", environmentId: "env-1", draftId: "draft-1" };
    expect(
      restoreDraftLinkState(
        { routes: [{ name: "Home" }, { name: "Thread", params: draft }] },
        "/new/draft?draftId=draft-1",
      ),
    ).toEqual({
      index: 1,
      routes: [{ name: "Home" }, { name: "Thread", params: { draft } }],
    });
  });

  it.each([
    ["environment", "NewTaskEnvironment"],
    ["branch", "NewTaskBranch"],
    ["files", "NewTaskFiles"],
    ["files/src/index.ts", "NewTaskFile"],
    ["attachments/attachment-1", "NewTaskAttachment"],
    ["settings", "NewTaskThreadSettings"],
  ])("restores a draft beneath its %s screen", (path, name) => {
    const params = { environmentId: "env-1", projectId: "project-1" };
    const target = { name, params };
    expect(
      restoreDraftLinkState({ routes: [{ name: "Home" }, target] }, `/new/draft/${path}`),
    ).toEqual({
      index: 2,
      routes: [{ name: "Home" }, { name: "Thread", params: { draft: params } }, target],
    });
  });

  it("leaves live-thread and project-selection links unchanged", () => {
    const state = { routes: [{ name: "Thread", params: { threadId: "thread-1" } }] };
    expect(restoreDraftLinkState(state, "/threads/env-1/thread-1")).toBe(state);
    expect(restoreDraftLinkState(state, "/new")).toBe(state);
    expect(restoreDraftLinkState(undefined, "/new/draft")).toBeUndefined();
  });
});

describe("pairing deep links", () => {
  it("opens a host pairing link on the existing form with its one-time credential intact", () => {
    expect(
      normalizePairingLinkPath("/pair?pairingUrl=https%3A%2F%2Fhost%2F%23token%3Dx&autoConnect=1"),
    ).toBe("connections/new?pairingUrl=https%3A%2F%2Fhost%2F%23token%3Dx");
  });
  it("prefills peer trust without forwarding an automatic connection flag", () => {
    const path = normalizePairingLinkPath("peer?v=1&data=encoded&autoConnect=1");
    const query = new URLSearchParams(path.slice(path.indexOf("?") + 1));
    expect(path.startsWith("connections/new?")).toBe(true);
    expect(query.get("pairingUrl")).toBe("mines://peer?v=1&data=encoded&autoConnect=1");
    expect(query.has("autoConnect")).toBe(false);
  });
  it("leaves other navigation and existing connection paths unchanged", () => {
    for (const path of ["connections/new?pairingUrl=x", "threads/env/mine", "/new/draft"]) {
      expect(normalizePairingLinkPath(path)).toBe(path);
    }
  });
});

it.each(["pair", "connections/new", "settings/environment-new"])(
  "ignores automatic host trust requested by an incoming %s link",
  (path) => {
    const result = normalizePairingLinkPath(
      `${path}?pairingUrl=https%3A%2F%2Fhost%2F%23token%3Dx&autoConnect=1`,
    );
    const query = new URLSearchParams(result.slice(result.indexOf("?") + 1));
    expect(query.get("pairingUrl")).toBe("https://host/#token=x");
    expect(query.has("autoConnect")).toBe(false);
  },
);
