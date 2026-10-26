import type { MinesCatalogEntry, MinesCatalogSnapshot } from "@t3tools/client-runtime/catalog";
import { libraryWorkgroupKey } from "./libraryWorkgroups";

export type LibraryMode = "personal" | "workgroups";

export interface LibraryWorkgroupVisibility {
  readonly mode?: LibraryMode;
  readonly joinedKeys?: ReadonlySet<string> | null;
  readonly legacyIds?: ReadonlySet<string>;
}
export type LibraryRow =
  | {
      key: string;
      entry: MinesCatalogEntry;
      depth: number;
      open: boolean;
      hasChildren: boolean;
      pinned: boolean;
      siblings: readonly MinesCatalogEntry[];
      index: number;
    }
  | { heading: string };

export function buildLibraryRows(
  snapshot: MinesCatalogSnapshot,
  collapsed: ReadonlySet<string>,
  expanded: ReadonlySet<string>,
  hidden: ReadonlySet<string>,
  workgroups: LibraryWorkgroupVisibility = {},
): LibraryRow[] {
  const result: LibraryRow[] = [];
  const visible = (entry: MinesCatalogEntry, withinPins: boolean) => {
    if (hidden.has(entry.entity.id) || workgroups.legacyIds?.has(entry.entity.id)) return false;
    const groupKey = libraryWorkgroupKey(entry.entity.id);
    if (groupKey !== null && workgroups.joinedKeys != null && !workgroups.joinedKeys.has(groupKey))
      return false;
    if (withinPins) return true;
    return (groupKey !== null) === (workgroups.mode === "workgroups");
  };
  const append = (
    entries: readonly MinesCatalogEntry[],
    depth: number,
    pinned: boolean,
    path: string,
    withinPins = pinned,
  ) => {
    const visibleEntries = entries.filter((entry) => visible(entry, withinPins));
    visibleEntries.forEach((entry, index) => {
      const key = `${path}/${encodeURIComponent(entry.entity.id)}`;
      const open =
        entry.entity.kind === "section" || entry.entity.kind === "thread"
          ? !collapsed.has(key)
          : expanded.has(key);
      const hasChildren = entry.children.some((child) => visible(child, withinPins));
      result.push({
        key,
        entry,
        depth,
        pinned,
        siblings: visibleEntries,
        index,
        open,
        hasChildren,
      });
      if (open) append(entry.children, depth + 1, false, key, withinPins);
    });
  };
  result.push({ heading: "Pinned" });
  append(snapshot.pins, 0, true, "pins");
  result.push({ heading: workgroups.mode === "workgroups" ? "Workgroups" : "Library" });
  const roots =
    workgroups.mode === "workgroups"
      ? snapshot.entities
          .filter((entity) => libraryWorkgroupKey(entity.id) !== null)
          .map((entity) => ({ entity, children: [], parentId: null, orphaned: false }))
      : snapshot.roots;
  append(roots, 0, false, "library");
  return result;
}
