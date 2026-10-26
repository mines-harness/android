import { describe, expect, it } from "@effect/vitest";
import { AtomRegistry } from "effect/reactivity";
import { MinesCatalog } from "./index.ts";
import { captureCatalogExecution, registerCatalogExecutionSource } from "./execution.ts";
import { minesAccountIdAtom, minesCatalogIdentityAtom } from "./identity.ts";

describe("catalog execution source mode", () => {
  it("uses the host's authoritative context for a direct phone's local library", () => {
    const registry = AtomRegistry.make();
    const catalog = new MinesCatalog({ createId: () => "local" });
    registry.set(minesCatalogIdentityAtom, { ready: true, accountId: null, readToken: null });
    const stop = registerCatalogExecutionSource(
      registry,
      "local-device",
      catalog,
      async () => {},
      "host",
    );
    try {
      expect(captureCatalogExecution(registry)).toBeNull();
    } finally {
      stop();
      registry.dispose();
      catalog.destroy();
    }
  });

  it.each(["account-a", "local-device"])(
    "does not omit context for signed-in account %s",
    (accountId) => {
      const registry = AtomRegistry.make();
      const catalog = new MinesCatalog({ createId: () => "local" });
      registry.set(minesAccountIdAtom, accountId);
      registry.set(minesCatalogIdentityAtom, {
        ready: true,
        accountId,
        readToken: null,
      });
      const stop = registerCatalogExecutionSource(
        registry,
        accountId,
        catalog,
        async () => {},
        "host",
      );
      try {
        expect(() => captureCatalogExecution(registry)).toThrow("account");
      } finally {
        stop();
        registry.dispose();
        catalog.destroy();
      }
    },
  );

  it("still blocks a local source during an account transition", () => {
    const registry = AtomRegistry.make();
    const catalog = new MinesCatalog({ createId: () => "local" });
    registry.set(minesCatalogIdentityAtom, { ready: false, accountId: null, readToken: null });
    const stop = registerCatalogExecutionSource(
      registry,
      "local-device",
      catalog,
      async () => {},
      "host",
    );
    try {
      expect(() => captureCatalogExecution(registry)).toThrow("not ready");
    } finally {
      stop();
      registry.dispose();
      catalog.destroy();
    }
  });
});
