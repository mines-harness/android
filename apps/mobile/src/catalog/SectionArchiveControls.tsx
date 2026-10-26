import {
  minesAccountIdAtom,
  minesCatalogIdentityAtom,
  type MinesCatalog,
  type MinesCatalogEntity,
} from "@t3tools/client-runtime/catalog";
import type { AtomCommandResult } from "@t3tools/client-runtime/state/runtime";
import { threadRuntimeCanArchive } from "@t3tools/client-runtime/state/models";
import { AuthOrchestrationOperateScope, EnvironmentId, ThreadId } from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import { useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { AppText as Text } from "../components/ui/AppText";
import * as Dialog from "../components/ui/Dialog";
import { refreshArchivedThreadsForEnvironment } from "../features/archive/useArchivedThreadSnapshots";
import { appAtomRegistry } from "../state/atom-registry";
import { readEnvironmentScope } from "../state/session";
import { environmentShell } from "../state/shell";
import { environmentThreadShells, threadEnvironment } from "../state/threads";
import { useAtomCommand } from "../state/use-atom-command";
import { libraryEnvironmentIdsAtom } from "./libraryEnvironments";
import {
  archiveCatalogSection,
  relatedSectionThreads,
  restoreCatalogSection,
} from "./sectionArchive";

type ThreadArchiveAction = (input: {
  readonly environmentId: EnvironmentId;
  readonly input: { readonly threadId: ThreadId };
}) => Promise<AtomCommandResult<unknown, unknown>>;

function assertCurrentLibrary(accountId: string) {
  if (
    (appAtomRegistry.get(minesAccountIdAtom) ?? "local-device") !== accountId ||
    !appAtomRegistry.get(minesCatalogIdentityAtom).ready
  )
    throw new Error("The account changed. Reopen the library before continuing.");
}

async function changeArchivedMine(
  accountId: string,
  action: ThreadArchiveAction,
  ref: { readonly environmentId: string; readonly threadId: string },
) {
  assertCurrentLibrary(accountId);
  const environmentId = EnvironmentId.make(ref.environmentId);
  if (!appAtomRegistry.get(libraryEnvironmentIdsAtom).has(environmentId))
    throw new Error("This computer no longer belongs to the current library.");
  const result = await action({ environmentId, input: { threadId: ThreadId.make(ref.threadId) } });
  if (result._tag === "Failure") throw Cause.squash(result.cause);
  refreshArchivedThreadsForEnvironment(environmentId);
}

async function archiveSectionWithChoice(input: {
  readonly catalog: MinesCatalog;
  readonly accountId: string;
  readonly sectionId: string;
  readonly includeContents: boolean;
  readonly flush: () => Promise<void>;
  readonly archive: ThreadArchiveAction;
  readonly unarchive: ThreadArchiveAction;
}) {
  const { catalog, accountId, sectionId, flush } = input;
  assertCurrentLibrary(accountId);
  if (!input.includeContents) {
    const operation = catalog.archiveSection(sectionId, { includeContents: false });
    try {
      await flush();
    } catch (cause) {
      catalog.restoreSection(sectionId, [operation]);
      await flush();
      throw cause;
    }
    return;
  }
  const contents = catalog.getSectionContents(sectionId);
  const hosts = new Set(
    contents.flatMap((entity) => (entity.hostRef ? [entity.hostRef.environmentId] : [])),
  );
  for (const host of hosts) {
    const environmentId = EnvironmentId.make(host);
    if (
      !appAtomRegistry.get(libraryEnvironmentIdsAtom).has(environmentId) ||
      appAtomRegistry.get(environmentShell.stateValueAtom(environmentId)).status !== "live"
    )
      throw new Error(
        "Connect each related computer and wait for its mines to finish loading before archiving this section.",
      );
    if (!readEnvironmentScope(environmentId, AuthOrchestrationOperateScope))
      throw new Error("This connection cannot archive mines on one of the related computers.");
  }
  const threads = appAtomRegistry.get(environmentThreadShells.threadShellsAtom);
  const refs = relatedSectionThreads(contents, threads);
  const keys = new Set(refs.map((ref) => JSON.stringify([ref.environmentId, ref.threadId])));
  if (
    threads.some(
      (thread) =>
        keys.has(JSON.stringify([thread.environmentId, thread.id])) &&
        !threadRuntimeCanArchive(thread.runtime),
    )
  )
    throw new Error("Stop the active mines in this section before archiving them.");
  await archiveCatalogSection({
    catalog,
    sectionId,
    flush,
    threads: refs,
    archive: (ref) => changeArchivedMine(accountId, input.archive, ref),
    unarchive: (ref) => changeArchivedMine(accountId, input.unarchive, ref),
  });
}

async function reportSectionOperation(action: () => Promise<void>): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (cause) {
    return cause instanceof Error
      ? cause.message
      : "The section could not be updated. Try again after reconnecting.";
  }
}

export function useSectionArchiveActions({
  catalog,
  accountId,
  flush,
  version,
}: {
  readonly catalog: MinesCatalog | null;
  readonly accountId: string;
  readonly flush: () => Promise<void>;
  readonly version: number;
}) {
  const archive = useAtomCommand(threadEnvironment.archive, { reportFailure: false });
  const unarchive = useAtomCommand(threadEnvironment.unarchive, { reportFailure: false });
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const sections = useMemo(
    () =>
      catalog !== null && catalog.getSnapshot().version === version
        ? catalog.getArchivedSections()
        : [],
    [catalog, version],
  );
  const perform = (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    void reportSectionOperation(action).then((message) => {
      inFlight.current = false;
      setBusy(false);
      if (message) Dialog.alert("Could not update section", message);
    });
  };
  const requestArchive = (section: Pick<MinesCatalogEntity, "id" | "title">) => {
    if (!catalog || inFlight.current) return;
    Dialog.alert(
      `Archive ${section.title}?`,
      "Archive just the section to keep its contents in your library, or archive its related projects and mines too. Restore it later from Archived sections.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Section only",
          onPress: () =>
            perform(() =>
              archiveSectionWithChoice({
                catalog,
                accountId,
                flush,
                sectionId: section.id,
                includeContents: false,
                archive,
                unarchive,
              }),
            ),
        },
        {
          text: "Section & mines",
          style: "destructive",
          onPress: () =>
            perform(() =>
              archiveSectionWithChoice({
                catalog,
                accountId,
                flush,
                sectionId: section.id,
                includeContents: true,
                archive,
                unarchive,
              }),
            ),
        },
      ],
    );
  };
  const restore = (sectionId: string) => {
    if (!catalog || inFlight.current) return;
    perform(() => {
      assertCurrentLibrary(accountId);
      return restoreCatalogSection({
        catalog,
        sectionId,
        flush,
        unarchive: (ref) => changeArchivedMine(accountId, unarchive, ref),
      });
    });
  };
  return { sections, busy, requestArchive, restore };
}

export function ArchivedCatalogSections({
  actions,
}: {
  readonly actions: ReturnType<typeof useSectionArchiveActions>;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View className="px-3 pt-4">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        className="min-h-12 justify-center"
        onPress={() => setExpanded(!expanded)}
      >
        <Text className="text-xs text-foreground-muted">
          {expanded ? "▾" : "▸"} Archived sections · {actions.sections.length}
        </Text>
      </Pressable>
      {actions.busy ? (
        <Text accessibilityLiveRegion="polite" className="py-2 text-sm text-foreground-muted">
          Saving section changes…
        </Text>
      ) : null}
      {expanded ? (
        actions.sections.length === 0 ? (
          <Text className="py-2 text-sm text-foreground-muted">No archived sections.</Text>
        ) : (
          actions.sections.map((section) => (
            <Pressable
              key={section.id}
              accessibilityRole="button"
              accessibilityLabel={`Restore ${section.title}`}
              accessibilityState={{ disabled: actions.busy }}
              disabled={actions.busy}
              className="min-h-12 justify-center py-3"
              onPress={() => actions.restore(section.id)}
            >
              <Text>Restore {section.title}</Text>
            </Pressable>
          ))
        )
      ) : null}
    </View>
  );
}
