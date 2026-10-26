import {
  catalogHostId,
  type MinesCatalog,
  type MinesCatalogEntity,
  type MinesCatalogSnapshot,
} from "@t3tools/client-runtime/catalog";
import type { SharedContactGroup } from "@t3tools/contracts/contacts";

type Workgroup = Pick<
  SharedContactGroup,
  "key" | "groupId" | "groupName" | "coordinatorEnvironmentId"
>;
const WORKGROUP_PREFIX = "workgroup:";

export const libraryWorkgroupId = (key: string) => `${WORKGROUP_PREFIX}${key}`;
export const libraryWorkgroupKey = (id: string) =>
  id.startsWith(WORKGROUP_PREFIX) ? id.slice(WORKGROUP_PREFIX.length) : null;

export function libraryWorkgroupVisibility(
  snapshot: MinesCatalogSnapshot,
  groups: readonly Workgroup[] | null,
) {
  return {
    joinedKeys: groups === null ? null : new Set(groups.map((group) => group.key)),
    legacyIds: new Set([
      ...(groups ?? []).map((group) =>
        catalogHostId("group", group.coordinatorEnvironmentId, group.groupId),
      ),
      ...snapshot.entities.flatMap((entity) =>
        libraryWorkgroupKey(entity.id) !== null && entity.hostRef
          ? [catalogHostId("group", entity.hostRef.environmentId, entity.hostRef.entityId)]
          : [],
      ),
    ]),
  };
}

export function reconcileLibraryWorkgroups(catalog: MinesCatalog, groups: readonly Workgroup[]) {
  catalog.transaction(() => {
    for (const group of groups) {
      const id = libraryWorkgroupId(group.key);
      catalog.upsert({
        id,
        kind: "group",
        title: group.groupName,
        hostRef: { environmentId: group.coordinatorEnvironmentId, entityId: group.groupId },
      });
      const pins = catalog.getSnapshot().pins;
      const legacy = catalogHostId("group", group.coordinatorEnvironmentId, group.groupId);
      const legacyIndex = pins.findIndex((entry) => entry.entity.id === legacy);
      if (legacyIndex < 0) continue;
      if (!pins.some((entry) => entry.entity.id === id))
        catalog.pin(id, pins[legacyIndex + 1]?.entity.id);
      catalog.unpin(legacy);
    }
  });
}

export function unpinLibraryItem(catalog: MinesCatalog, entity: MinesCatalogEntity) {
  catalog.transaction(() => {
    catalog.unpin(entity.id);
    if (libraryWorkgroupKey(entity.id) !== null && entity.hostRef) {
      const legacy = catalogHostId("group", entity.hostRef.environmentId, entity.hostRef.entityId);
      if (catalog.getSnapshot().pins.some((entry) => entry.entity.id === legacy))
        catalog.unpin(legacy);
    }
  });
}
