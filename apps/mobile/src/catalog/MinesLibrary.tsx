import { useAtomValue } from "@effect/atom-react";
import {
  hiddenCatalogExecutionProjects,
  reconcileCatalogHostItems,
} from "@t3tools/client-runtime/catalog";
import { buildLibraryRows, type LibraryMode } from "./MinesLibrary.logic";
import { libraryWorkgroupKey, unpinLibraryItem } from "./libraryWorkgroups";
import { useLibraryWorkgroups } from "./useLibraryWorkgroups";
import { WorkgroupLibraryModal } from "./WorkgroupLibraryModal";
import { CloudCatalogDevices } from "./CloudCatalogDevices";
import { MobileCloudModal } from "./MobileCloudModal";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { FlatList, Pressable, View, type ScrollViewProps } from "react-native";
import { NativeScrollView } from "../native/NativeScrollViewMarker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "../components/ui/EmptyState";
import { useWorkspaceTabs } from "../features/workspace/WorkspaceTabsContext";
import type { MenuAction } from "@react-native-menu/menu";
import {
  catalogHostId,
  canCatalogContain,
  type MinesCatalog,
  type MinesCatalogEntry,
} from "@t3tools/client-runtime/catalog";
import { isScratchProject } from "@t3tools/client-runtime/state/projects";
import { EnvironmentId } from "@t3tools/contracts";
import type { GroupListResult } from "@t3tools/contracts/groupChat";
import { AppText as Text } from "../components/ui/AppText";
import { Menu } from "../components/ui/Menu";
import * as Dialog from "../components/ui/Dialog";
import { useProjects, useNavigationThreadShells, useServerConfigs } from "../state/entities";
import { useWorkspaceState } from "../state/workspace";
import { useMinesCatalog } from "./useMinesCatalog";
import { ArchivedCatalogSections, useSectionArchiveActions } from "./SectionArchiveControls";
import { useSelectWorkspaceDetail } from "../features/workspace/useSelectWorkspaceDetail";
import { useEnvironmentQuery } from "../state/query";
import { groupList } from "../state/groups";
import { MobileGroupModal } from "./MobileGroupModal";
import { MobileCatalogContextModal } from "./MobileCatalogContextModal";
import { SymbolView } from "../components/ui/AppSymbol";
import { groupMemberKey, groupMembershipLabels } from "./groupParticipants";
import { libraryEnvironmentIdsAtom } from "./libraryEnvironments";

const symbols = { section: "▦", project: "▱", group: "◎", device: "▣" };
type GroupListSnapshot = typeof GroupListResult.Type;

function renderLibraryScrollView(props: ScrollViewProps) {
  return <NativeScrollView {...props} />;
}

export function MinesLibrary({
  onNewChat,
  onSettings,
  onAddConnection,
  navigationHeader,
  mode = "personal",
}: {
  onNewChat?: () => void;
  onSettings: () => void;
  onAddConnection?: () => void;
  navigationHeader?: ReactNode;
  mode?: LibraryMode;
}) {
  const { catalog, snapshot, error, accountId, flush } = useMinesCatalog();
  const workgroups = useLibraryWorkgroups(catalog, snapshot, accountId);
  const [workgroupOpen, setWorkgroupOpen] = useState<{
    accountId: string;
    key: string | null;
  } | null>(null);
  const sectionArchives = useSectionArchiveActions({
    catalog,
    accountId,
    flush,
    version: snapshot.version,
  });
  const insets = useSafeAreaInsets();
  const workspace = useWorkspaceTabs();
  const projects = useProjects();
  const threads = useNavigationThreadShells();
  const configs = useServerConfigs();
  const { environments } = useWorkspaceState();
  const visibleEnvironmentIds = useAtomValue(libraryEnvironmentIdsAtom);
  const selectDetail = useSelectWorkspaceDetail();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [cloud, setCloud] = useState<{ environmentId: string; targetId: string } | null>(null);
  const [group, setGroup] = useState<{ environmentId: string; groupId: string } | null>(null);
  const [contextEntityId, setContextEntityId] = useState<string | null>(null);
  const [groupLists, setGroupLists] = useState<{
    accountId: string;
    values: ReadonlyMap<EnvironmentId, GroupListSnapshot>;
  }>({ accountId, values: new Map() });
  const reportGroups = useCallback(
    (environmentId: EnvironmentId, data: GroupListSnapshot) => {
      setGroupLists((current) => {
        const values =
          current.accountId === accountId
            ? current.values
            : new Map<EnvironmentId, GroupListSnapshot>();
        if (values.get(environmentId) === data) return current;
        return { accountId, values: new Map(values).set(environmentId, data) };
      });
    },
    [accountId],
  );
  const membershipLabels = useMemo(
    () =>
      groupMembershipLabels(
        groupLists.accountId === accountId
          ? [...groupLists.values].map(([environmentId, data]) => ({ environmentId, ...data }))
          : [],
      ),
    [accountId, groupLists],
  );
  useEffect(() => {
    if (!catalog) return;
    catalog.transaction(() => {
      for (const environment of environments.filter((environment) =>
        visibleEnvironmentIds.has(environment.environmentId),
      ))
        catalog.upsert({
          id: catalogHostId("device", environment.environmentId, environment.environmentId),
          kind: "device",
          title: environment.environmentLabel,
          hostRef: {
            environmentId: environment.environmentId,
            entityId: environment.environmentId,
          },
        });
    });
    reconcileCatalogHostItems(catalog, {
      projects,
      threads,
      environmentIds: visibleEnvironmentIds,
      scratchProjectIds: new Set(
        projects
          .filter((project) =>
            isScratchProject(project, configs.get(project.environmentId)?.scratchWorkspaceRoot),
          )
          .map((project) => catalogHostId("project", project.environmentId, project.id)),
      ),
    });
  }, [catalog, projects, threads, environments, configs, visibleEnvironmentIds]);
  const containers = useMemo(() => {
    const hidden = hiddenCatalogExecutionProjects(snapshot);
    return snapshot.entities.filter(
      (entity) =>
        !hidden.has(entity.id) && (entity.kind === "section" || entity.kind === "project"),
    );
  }, [snapshot]);
  const pinnedIds = useMemo(
    () => new Set(snapshot.pins.map((entry) => entry.entity.id)),
    [snapshot.pins],
  );
  const rows = useMemo(() => {
    const archived = new Set(
      threads
        .filter((thread) => thread.archivedAt !== null)
        .map((thread) => catalogHostId("thread", thread.environmentId, thread.id)),
    );
    for (const id of hiddenCatalogExecutionProjects(snapshot)) archived.add(id);
    if (groupLists.accountId === accountId)
      for (const [environmentId, data] of groupLists.values)
        for (const group of data.groups)
          if (group.visibility === "shared")
            archived.add(catalogHostId("group", environmentId, group.id));
    return buildLibraryRows(snapshot, collapsed, expanded, archived, {
      mode,
      ...workgroups.visibility,
    });
  }, [snapshot, collapsed, expanded, threads, groupLists, accountId, mode, workgroups.visibility]);
  const run = (action: () => void) => {
    try {
      action();
    } catch (cause) {
      Dialog.alert(
        "Could not arrange this item",
        cause instanceof Error ? cause.message : "Try again.",
      );
    }
  };
  const section = (entry?: MinesCatalogEntry) =>
    Dialog.prompt({
      title: entry ? "Rename section" : "New section",
      initialValue: entry?.entity.title ?? "",
      confirmText: "Save",
      onConfirm: (title) => {
        if (title.trim() && catalog)
          run(() =>
            entry ? catalog.rename(entry.entity.id, title) : catalog.createSection(title),
          );
      },
    });
  return (
    <View className="flex-1 bg-screen">
      {catalog
        ? environments
            .filter(
              (environment) =>
                environment.connectionState === "connected" &&
                visibleEnvironmentIds.has(environment.environmentId),
            )
            .map((environment) => (
              <CloudCatalogDevices
                key={`cloud:${environment.environmentId}`}
                environmentId={environment.environmentId}
                catalog={catalog}
              />
            ))
        : null}
      <FlatList
        style={{ flex: 1 }}
        renderScrollComponent={renderLibraryScrollView}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {navigationHeader}{" "}
            <View className="flex-row items-center gap-2 px-4 py-2">
              <Text className="flex-1 text-lg font-mines-bold">
                {mode === "workgroups" ? "Workgroups" : "Your library"}
              </Text>
              {mode === "personal" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="New section"
                  onPress={() => section()}
                  className="p-3"
                >
                  <Text className="text-xl">＋</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Manage Workgroups"
                  onPress={() => setWorkgroupOpen({ accountId, key: null })}
                  className="p-3"
                >
                  <Text>Manage</Text>
                </Pressable>
              )}
              {onNewChat && mode === "personal" ? (
                <Pressable accessibilityRole="button" onPress={onNewChat} className="p-3">
                  <Text>New mine</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" onPress={onSettings} className="p-3">
                <Text>Settings</Text>
              </Pressable>
            </View>
            {error ? (
              <Text accessibilityRole="alert" className="p-4 text-danger-foreground">
                {error}
              </Text>
            ) : null}
            {mode === "workgroups" ? (
              <Text
                accessibilityLiveRegion="polite"
                className="px-4 pb-3 text-sm text-foreground-muted"
              >
                {!workgroups.contacts.isSignedIn
                  ? "Sign in to your Mines account to use Workgroups."
                  : workgroups.visibility.joinedKeys === null
                    ? (workgroups.contacts.error ??
                      "Checking Workgroup membership. Saved shortcuts remain available while reconnecting.")
                    : workgroups.visibility.joinedKeys.size === 0
                      ? "No Workgroups yet. Open Manage to create a group or accept an invitation in Contacts."
                      : "Work with people and their mines. Pins stay visible in both library views."}
              </Text>
            ) : null}
          </>
        }
        data={rows.some((row) => !("heading" in row)) ? rows : []}
        keyExtractor={(row) => ("heading" in row ? row.heading : row.key)}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 12,
          paddingBottom: Math.max(insets.bottom, workspace?.bottomClearance ?? 0) + 24,
        }}
        renderItem={({ item: row }) => {
          if ("heading" in row)
            return (
              <Text className="px-3 pb-2 pt-5 text-xs uppercase tracking-wider text-foreground-muted">
                {row.heading}
              </Text>
            );
          const { entry, pinned, index, siblings, open } = row;
          const entity = entry.entity;
          const workgroupKey = libraryWorkgroupKey(entity.id);
          const key = row.key;
          const container = entity.kind === "section" || entity.kind === "project";
          const isPinned = pinnedIds.has(entity.id);
          const online =
            workgroupKey !== null ||
            !entity.hostRef ||
            environments.some(
              (environment) =>
                environment.environmentId === entity.hostRef?.environmentId &&
                environment.connectionState === "connected",
            );
          const targets = containers.filter(
            (target) => target.id !== entity.id && canCatalogContain(target.kind, entity.kind),
          );
          const actions: MenuAction[] = [
            { id: "pin", title: isPinned ? "Unpin" : "Pin", image: isPinned ? "pin.slash" : "pin" },
            {
              id: "up",
              title: "Move up",
              image: "arrow.up",
              attributes: { disabled: (!pinned && workgroupKey !== null) || index === 0 },
            },
            {
              id: "down",
              title: "Move down",
              image: "arrow.down",
              attributes: {
                disabled: (!pinned && workgroupKey !== null) || index === siblings.length - 1,
              },
            },
            {
              id: "move",
              title: "Move to",
              image: "folder",
              subactions: [
                { id: "root", title: "Library", image: "house" },
                ...targets.map((target) => ({
                  id: `to:${target.id}`,
                  title: target.title,
                  image: target.kind === "section" ? "square.grid.2x2" : "folder",
                })),
              ],
            },
            ...(container && accountId !== "local-device"
              ? [{ id: "context", title: "Settings", image: "gearshape" }]
              : []),
            ...(entity.kind === "section"
              ? [
                  { id: "rename", title: "Rename section", image: "square.and.pencil" },
                  {
                    id: "archive",
                    title: "Archive section…",
                    image: "archivebox",
                    attributes: { disabled: sectionArchives.busy },
                  },
                  { id: "remove", title: "Remove section, keep contents", image: "trash" },
                ]
              : []),
          ];
          const toggleOpen = () => {
            const update =
              entity.kind === "section" || entity.kind === "thread" ? setCollapsed : setExpanded;
            update((current) => {
              const next = new Set(current);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            });
          };
          const activate = () => {
            if (workgroupKey !== null) setWorkgroupOpen({ accountId, key: workgroupKey });
            else if (container) toggleOpen();
            else if (entity.kind === "thread" && entity.hostRef)
              selectDetail({
                name: "Thread",
                params: {
                  environmentId: entity.hostRef.environmentId,
                  threadId: entity.hostRef.entityId,
                },
              });
            else if (entity.kind === "group" && entity.hostRef)
              setGroup({
                environmentId: entity.hostRef.environmentId,
                groupId: entity.hostRef.entityId,
              });
            else if (entity.kind === "device" && entity.hostRef?.entityId.startsWith("cloud:"))
              setCloud({
                environmentId: entity.hostRef.environmentId,
                targetId: entity.hostRef.entityId,
              });
            else if (entity.kind === "device") onSettings();
          };
          return (
            <View
              className="flex-row items-center rounded-xl"
              style={{ paddingLeft: row.depth * 14 }}
            >
              {entity.kind === "thread" ? (
                <View className="w-8">
                  {row.hasChildren ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${open ? "Collapse" : "Expand"} ${entity.title}`}
                      accessibilityState={{ expanded: open }}
                      onPress={toggleOpen}
                      className="min-h-12 items-center justify-center"
                    >
                      <Text className="text-foreground-muted">{open ? "⌄" : "›"}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={container ? { expanded: open } : {}}
                onPress={activate}
                className="min-h-12 flex-1 flex-row items-center gap-3 px-3 py-3"
              >
                {entity.kind !== "thread" ? (
                  <>
                    <Text className="w-4 text-foreground-muted">
                      {container ? (open ? "⌄" : "›") : ""}
                    </Text>
                    {entity.kind === "group" ? (
                      <SymbolView
                        name="person.2"
                        size={18}
                        tintColorClassName="accent-foreground-muted"
                      />
                    ) : (
                      <Text className="text-amber-300">{symbols[entity.kind]}</Text>
                    )}
                  </>
                ) : null}
                <View className="flex-1">
                  <Text numberOfLines={1}>{entity.title}</Text>
                  {entity.kind === "thread" && entity.importSource?.agentName ? (
                    <Text className="text-xs text-foreground-muted" numberOfLines={1}>
                      {entity.importSource.agentName}
                    </Text>
                  ) : null}
                  {entity.kind === "thread" &&
                  entity.hostRef &&
                  membershipLabels.has(
                    groupMemberKey(
                      EnvironmentId.make(entity.hostRef.environmentId),
                      entity.hostRef.entityId,
                    ),
                  ) ? (
                    <View className="flex-row items-center gap-1 pt-0.5">
                      <SymbolView
                        name="person.2"
                        size={12}
                        tintColorClassName="accent-foreground-muted"
                      />
                      <Text numberOfLines={1} className="flex-1 text-xs text-foreground-muted">
                        {membershipLabels
                          .get(
                            groupMemberKey(
                              EnvironmentId.make(entity.hostRef.environmentId),
                              entity.hostRef.entityId,
                            ),
                          )
                          ?.join(", ")}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {!online ? <Text className="text-xs text-foreground-muted">Offline</Text> : null}
              </Pressable>
              <Menu
                actions={actions}
                onPressAction={({ nativeEvent }) => {
                  if (!catalog) return;
                  const action = nativeEvent.event;
                  run(() => {
                    if (action === "pin") {
                      if (isPinned) unpinLibraryItem(catalog, entity);
                      else catalog.pin(entity.id);
                    } else if (action === "up" || action === "down") {
                      const before =
                        action === "up"
                          ? siblings[index - 1]?.entity.id
                          : siblings[index + 2]?.entity.id;
                      if (pinned) catalog.pin(entity.id, before);
                      else catalog.move(entity.id, entry.parentId, before);
                    } else if (action === "root") catalog.move(entity.id, null);
                    else if (action.startsWith("to:")) catalog.move(entity.id, action.slice(3));
                    else if (action === "rename") section(entry);
                    else if (action === "archive") sectionArchives.requestArchive(entity);
                    else if (action === "remove") catalog.removeContainer(entity.id);
                    else if (action === "context") setContextEntityId(entity.id);
                  });
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Arrange ${entity.title}`}
                  className="p-3"
                >
                  <Text>•••</Text>
                </Pressable>
              </Menu>
            </View>
          );
        }}
        ListEmptyComponent={
          <View className="flex-1 justify-center py-8">
            <EmptyState
              variant="plain"
              title={
                !catalog
                  ? "Opening your library"
                  : mode === "workgroups"
                    ? "Your Workgroups"
                    : environments.length === 0
                      ? "Connect your first host"
                      : "No mines in this library"
              }
              detail={
                !catalog
                  ? "Loading your securely saved library on this phone."
                  : mode === "workgroups"
                    ? "Sign in to manage shared work with people and their mines."
                    : environments.length === 0
                      ? "Pair a computer running Mines to browse projects and control its agents from your phone."
                      : "Choose New mine to start work, or add another host from Settings."
              }
              actionLabel={
                catalog && mode === "personal" && onAddConnection ? "Add a host" : undefined
              }
              onAction={onAddConnection}
            />
          </View>
        }
        ListFooterComponent={
          <View>
            {rows.some((row) => !("heading" in row)) || sectionArchives.sections.length > 0 ? (
              <ArchivedCatalogSections actions={sectionArchives} />
            ) : null}
            {catalog
              ? environments
                  .filter(
                    (environment) =>
                      environment.connectionState === "connected" &&
                      visibleEnvironmentIds.has(environment.environmentId),
                  )
                  .map((environment) => (
                    <CatalogGroups
                      key={environment.environmentId}
                      environmentId={environment.environmentId}
                      catalog={catalog}
                      deviceName={environment.environmentLabel}
                      onGroups={reportGroups}
                      onOpen={(groupId) =>
                        setGroup({ environmentId: environment.environmentId, groupId })
                      }
                    />
                  ))
              : null}
            <Text className="px-3 py-6 text-xs text-foreground-muted">
              {accountId === "local-device"
                ? "Sections and pins stay on this phone. Direct URL connections use the computer’s project instructions and sources."
                : "Changes are saved on this phone and merge when your devices reconnect directly."}
            </Text>
          </View>
        }
      />
      {cloud ? <MobileCloudModal {...cloud} onClose={() => setCloud(null)} /> : null}
      {group ? <MobileGroupModal {...group} onClose={() => setGroup(null)} /> : null}
      {workgroupOpen?.accountId === accountId ? (
        <WorkgroupLibraryModal
          key={`${accountId}:${workgroupOpen.key ?? "manage"}`}
          groupKey={workgroupOpen.key}
          onClose={() => {
            setWorkgroupOpen(null);
            void workgroups.contacts.refresh();
          }}
        />
      ) : null}
      {contextEntityId ? (
        <MobileCatalogContextModal
          key={`${accountId}:${contextEntityId}`}
          entityId={contextEntityId}
          onClose={() => setContextEntityId(null)}
        />
      ) : null}
    </View>
  );
}
function CatalogGroups({
  environmentId,
  catalog,
  deviceName,
  onGroups,
  onOpen,
}: {
  environmentId: EnvironmentId;
  catalog: MinesCatalog;
  deviceName: string;
  onGroups: (environmentId: EnvironmentId, data: GroupListSnapshot) => void;
  onOpen: (groupId: string) => void;
}) {
  const groups = useEnvironmentQuery(groupList({ environmentId, input: {} }));
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (groups.data) onGroups(environmentId, groups.data);
  }, [environmentId, groups.data, onGroups]);
  useEffect(() => {
    const data = groups.data;
    if (data)
      catalog.transaction(() => {
        for (const group of data.groups)
          if (group.archivedAt === null && group.visibility !== "shared")
            catalog.upsert({
              id: catalogHostId("group", environmentId, group.id),
              kind: "group",
              title: group.name,
              hostRef: { environmentId, entityId: group.id },
            });
      });
  }, [catalog, groups.data, environmentId]);
  const archived =
    groups.data?.groups.filter(
      (group) => group.archivedAt !== null && group.visibility !== "shared",
    ) ?? [];
  return (
    <View className="px-3 pt-3">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className="py-3"
        onPress={() => {
          setOpen(!open);
          if (!open) groups.refresh();
        }}
      >
        <Text className="text-xs text-foreground-muted">
          {open ? "▾" : "▸"} Archived groups · {deviceName}
        </Text>
      </Pressable>
      {open ? (
        <View>
          {groups.isPending ? (
            <Text className="py-2 text-foreground-muted">Loading…</Text>
          ) : archived.length === 0 ? (
            <Text className="py-2 text-foreground-muted">No archived groups.</Text>
          ) : (
            archived.map((group) => (
              <Pressable
                key={group.id}
                accessibilityRole="button"
                className="py-3"
                onPress={() => onOpen(group.id)}
              >
                <Text>{group.name}</Text>
              </Pressable>
            ))
          )}
          {groups.error ? (
            <Text className="py-2 text-danger-foreground">{groups.error}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
