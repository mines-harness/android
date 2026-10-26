import { describe, expect, it, vi } from "vite-plus/test";
import {
  MinesCatalog,
  catalogHostId,
  reconcileCatalogHostItems,
} from "@t3tools/client-runtime/catalog";
import {
  BearerConnectionProfile,
  BearerConnectionTarget,
  RelayConnectionTarget,
  type ConnectionCatalogEntry,
} from "@t3tools/client-runtime/connection";
import { EnvironmentId } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { libraryEnvironmentIds } from "./libraryEnvironments";

vi.mock("../connection/catalog", () => ({ environmentCatalog: { catalogValueAtom: {} } }));

function direct(
  id: string,
  overrides: Partial<
    Pick<BearerConnectionProfile, "peerDeviceId" | "learned" | "authorization">
  > = {},
): ConnectionCatalogEntry {
  const environmentId = EnvironmentId.make(id);
  const connectionId = `bearer:${id}:https://host.example`;
  return {
    enabled: true,
    target: new BearerConnectionTarget({ environmentId, label: id, connectionId }),
    profile: Option.some(
      new BearerConnectionProfile({
        environmentId,
        label: id,
        connectionId,
        httpBaseUrl: "https://host.example/",
        wsBaseUrl: "wss://host.example/",
        ...overrides,
      }),
    ),
  };
}

it("places manually paired projects, mines and pins in the signed-out device library", () => {
  const entry = direct("manual");
  const peer = direct("account", { peerDeviceId: "trusted-phone" });
  const ids = libraryEnvironmentIds(
    null,
    new Set(["account"]),
    new Map([
      ["manual", { ...entry, enabled: false }],
      ["account", peer],
    ]),
  );
  let sequence = 0;
  const catalog = new MinesCatalog({ createId: () => `placement-${++sequence}` });
  reconcileCatalogHostItems(catalog, {
    environmentIds: ids,
    scratchProjectIds: new Set(),
    projects: [
      { id: "workspace", title: "Manual workspace", environmentId: "manual" },
      { id: "private", title: "Account workspace", environmentId: "account" },
    ],
    threads: [
      {
        id: "mine",
        title: "Continue work",
        projectId: "workspace",
        environmentId: "manual",
        archivedAt: null,
        pinnedAt: "2026-10-26T12:00:00.000Z",
      },
    ],
  });
  expect(catalog.getSnapshot().entities.map((entity) => entity.title)).toEqual([
    "Manual workspace",
    "Continue work",
  ]);
  expect(catalog.getSnapshot().pins[0]?.entity.id).toBe(catalogHostId("thread", "manual", "mine"));
  catalog.destroy();
});

describe("library account isolation", () => {
  it("does not copy manual hosts into a signed-in account's catalog", () => {
    const owned = new Set(["account-a"]);
    const entries = new Map([
      ["manual", direct("manual")],
      [
        "account-a",
        direct("account-a", {
          peerDeviceId: "approved-peer",
        }),
      ],
    ]);
    expect(libraryEnvironmentIds("account-a", owned, entries)).toBe(owned);
    expect([...libraryEnvironmentIds("account-b", new Set(["account-b-host"]), entries)]).toEqual([
      "account-b-host",
    ]);
  });

  it("excludes peer, relay and learned routes while preserving a manually paired alternate", () => {
    const learned = direct("mixed", { learned: true });
    const relayId = EnvironmentId.make("relay");
    const entries = new Map<string, ConnectionCatalogEntry>([
      ["peer", direct("peer", { peerDeviceId: "account-peer" })],
      ["learned", direct("learned", { learned: true })],
      ["connect", direct("connect", { authorization: "t3-connect" })],
      [
        "relay",
        {
          target: new RelayConnectionTarget({ environmentId: relayId, label: "Relay" }),
          profile: Option.none(),
          enabled: true,
        },
      ],
      ["mixed", { ...learned, alternateRoutes: [direct("mixed")] }],
    ]);
    expect([...libraryEnvironmentIds(null, new Set(["peer"]), entries)]).toEqual(["mixed"]);
  });
});
