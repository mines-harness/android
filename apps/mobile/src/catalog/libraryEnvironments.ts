import {
  minesAccountEnvironmentIdsAtom,
  minesAccountIdAtom,
} from "@t3tools/client-runtime/catalog";
import type { ConnectionCatalogEntry } from "@t3tools/client-runtime/connection";
import * as Option from "effect/Option";
import { Atom } from "effect/reactivity";
import { environmentCatalog } from "../connection/catalog";

export function libraryEnvironmentIds(
  accountId: string | null,
  accountEnvironmentIds: ReadonlySet<string>,
  entries: ReadonlyMap<string, ConnectionCatalogEntry>,
): ReadonlySet<string> {
  if (accountId !== null) return accountEnvironmentIds;
  const local = new Set<string>();
  for (const [environmentId, entry] of entries) {
    if (
      [entry, ...(entry.alternateRoutes ?? [])].some((route) => {
        const profile = Option.getOrNull(route.profile);
        return (
          route.target._tag === "BearerConnectionTarget" &&
          profile?._tag === "BearerConnectionProfile" &&
          profile.peerDeviceId === undefined &&
          profile.learned !== true &&
          profile.authorization === undefined
        );
      })
    )
      local.add(environmentId);
  }
  return local;
}

// A manually paired computer belongs to the device library, never an unrelated account replica.
export const libraryEnvironmentIdsAtom = Atom.make((get) =>
  libraryEnvironmentIds(
    get(minesAccountIdAtom),
    get(minesAccountEnvironmentIdsAtom),
    get(environmentCatalog.catalogValueAtom).entries,
  ),
).pipe(Atom.withLabel("mobile:library-environments"));
