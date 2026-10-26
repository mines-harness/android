import { describe, expect, it } from "vite-plus/test";
import { MinesCatalog, catalogHostId } from "@t3tools/client-runtime/catalog";
import { buildLibraryRows } from "./MinesLibrary.logic";
import {
  libraryWorkgroupId,
  libraryWorkgroupVisibility,
  reconcileLibraryWorkgroups,
  unpinLibraryItem,
} from "./libraryWorkgroups";

const workgroup = {
  key: "friends:alpha",
  groupId: "group-1",
  groupName: "Friends",
  coordinatorEnvironmentId: "remote-host",
};

function setup() {
  let id = 0;
  const catalog = new MinesCatalog({ createId: () => `placement-${++id}` });
  catalog.upsert({ id: "mine", kind: "thread", title: "Build" });
  reconcileLibraryWorkgroups(catalog, [workgroup]);
  return catalog;
}

function rows(catalog: MinesCatalog, mode: "personal" | "workgroups", knownMembership = true) {
  const snapshot = catalog.getSnapshot();
  return buildLibraryRows(snapshot, new Set(), new Set(), new Set(), {
    mode,
    ...libraryWorkgroupVisibility(snapshot, knownMembership ? [workgroup] : null),
  }).filter((row) => "entry" in row);
}

describe("mobile Workgroup library", () => {
  it("uses desktop-compatible stable identities and preserves pins in either view", () => {
    const catalog = setup();
    const groupId = "workgroup:friends:alpha";
    expect(libraryWorkgroupId(workgroup.key)).toBe(groupId);
    catalog.pin("mine");
    catalog.pin(groupId);
    expect(rows(catalog, "personal").map((row) => row.key)).toEqual([
      "pins/mine",
      "pins/workgroup%3Afriends%3Aalpha",
      "library/mine",
    ]);
    expect(rows(catalog, "workgroups").map((row) => row.key)).toEqual([
      "pins/mine",
      "pins/workgroup%3Afriends%3Aalpha",
      "library/workgroup%3Afriends%3Aalpha",
    ]);
  });

  it("finds a Workgroup arranged inside a personal section without moving it", () => {
    const catalog = setup();
    catalog.upsert({ id: "section", kind: "section", title: "Team" });
    catalog.move(libraryWorkgroupId(workgroup.key), "section");
    expect(rows(catalog, "workgroups").map((row) => row.entry.entity.id)).toEqual([
      libraryWorkgroupId(workgroup.key),
    ]);
    const section = rows(catalog, "personal").find((row) => row.entry.entity.id === "section");
    expect(section?.hasChildren).toBe(false);
    expect(
      catalog.getSnapshot().roots.find((entry) => entry.entity.id === "section")?.children,
    ).toHaveLength(1);
  });

  it("keeps pinned section contents visible outside the chosen view", () => {
    const catalog = setup();
    catalog.upsert({ id: "section", kind: "section", title: "Team" });
    catalog.move("mine", "section");
    catalog.move(libraryWorkgroupId(workgroup.key), "section");
    catalog.pin("section");
    for (const mode of ["personal", "workgroups"] as const) {
      expect(
        rows(catalog, mode)
          .filter((row) => row.key.startsWith("pins/"))
          .map((row) => row.entry.entity.id),
      ).toEqual(["section", "mine", libraryWorkgroupId(workgroup.key)]);
    }
  });

  it("retains saved shortcuts while contacts load but hides confirmed removed membership", () => {
    const catalog = setup();
    catalog.pin(libraryWorkgroupId(workgroup.key));
    expect(rows(catalog, "personal", false).some((row) => row.pinned)).toBe(true);
    const snapshot = catalog.getSnapshot();
    const revoked = buildLibraryRows(snapshot, new Set(), new Set(), new Set(), {
      mode: "workgroups",
      ...libraryWorkgroupVisibility(snapshot, []),
    }).filter((row) => "entry" in row);
    expect(revoked).toEqual([]);
    expect(catalog.getSnapshot().pins).toHaveLength(1);
  });

  it("migrates legacy host pins in place and removes both key formats on unpin", () => {
    let id = 0;
    const catalog = new MinesCatalog({ createId: () => `placement-${++id}` });
    const legacyId = catalogHostId("group", workgroup.coordinatorEnvironmentId, workgroup.groupId);
    catalog.upsert({ id: "before", kind: "thread", title: "First" });
    catalog.upsert({ id: legacyId, kind: "group", title: workgroup.groupName });
    catalog.upsert({ id: "after", kind: "thread", title: "Last" });
    for (const item of ["before", legacyId, "after"]) catalog.pin(item);
    reconcileLibraryWorkgroups(catalog, [workgroup]);
    expect(catalog.getSnapshot().pins.map((entry) => entry.entity.id)).toEqual([
      "before",
      libraryWorkgroupId(workgroup.key),
      "after",
    ]);
    expect(rows(catalog, "personal").some((row) => row.entry.entity.id === legacyId)).toBe(false);

    // An older client can resync its host-key shortcut before the next migration pass.
    catalog.pin(legacyId);
    const stable = catalog
      .getSnapshot()
      .entities.find((entity) => entity.id === libraryWorkgroupId(workgroup.key))!;
    unpinLibraryItem(catalog, stable);
    expect(catalog.getSnapshot().pins.map((entry) => entry.entity.id)).toEqual(["before", "after"]);
  });
});
