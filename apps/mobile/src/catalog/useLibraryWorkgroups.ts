import type { MinesCatalog, MinesCatalogSnapshot } from "@t3tools/client-runtime/catalog";
import { useEffect, useMemo } from "react";
import { useContacts } from "../features/contacts/useContacts";
import { libraryWorkgroupVisibility, reconcileLibraryWorkgroups } from "./libraryWorkgroups";

export function useLibraryWorkgroups(
  catalog: MinesCatalog | null,
  snapshot: MinesCatalogSnapshot,
  accountId: string,
) {
  const contacts = useContacts("threads");
  const groups = contacts.accountId === accountId ? (contacts.data?.groups ?? null) : null;
  const visibility = useMemo(
    () => libraryWorkgroupVisibility(snapshot, groups),
    [snapshot, groups],
  );
  useEffect(() => {
    if (catalog && groups !== null) reconcileLibraryWorkgroups(catalog, groups);
  }, [catalog, groups, snapshot.pins]);
  return { contacts, visibility };
}
