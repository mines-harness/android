import type { NavigationState, PartialState } from "@react-navigation/native";

/**
 * The Expo dev client launches the app via
 * <scheme>://expo-development-client/?url=<packager> — that URL addresses
 * the launcher, not app navigation. Without this filter it falls through
 * to the NotFound wildcard route on every dev launch.
 */
export function shouldHandleAppLink(url: string): boolean {
  return (
    !url.includes("expo-development-client") &&
    !url.includes("://expo-sharing") &&
    !/^(?:mines|t3code)(-dev|-preview)?:\/*$/.test(url)
  );
}

/** Keep the published draft URLs while using the root thread screen. */
export function restoreDraftLinkState(
  state: PartialState<NavigationState> | undefined,
  path: string,
) {
  const pathname = path.split("?")[0]?.replace(/^\/+|\/+$/g, "");
  if (!state || !pathname || !/^new\/draft(?:\/|$)/.test(pathname)) return state;
  const target = state.routes.at(-1);
  if (!target) return state;
  const draft = target.params ?? {};
  const routes = state.routes.slice(0, -1);
  routes.push({ name: "Thread", params: { draft } });
  if (pathname !== "new/draft") routes.push(target);
  return { ...state, index: routes.length - 1, routes };
}

export function normalizePairingLinkPath(path: string): string {
  const separator = path.indexOf("?");
  const pathname = (separator === -1 ? path : path.slice(0, separator)).replace(/^\/+|\/+$/g, "");
  const search = separator === -1 ? "" : path.slice(separator);
  if (["pair", "connections/new", "settings/environment-new"].includes(pathname)) {
    const params = new URLSearchParams(search.slice(1));
    params.delete("autoConnect");
    const target = pathname === "pair" ? "connections/new" : pathname;
    const query = params.toString();
    return `${target}${query ? `?${query}` : ""}`;
  }
  if (pathname === "peer") {
    const params = new URLSearchParams({ pairingUrl: `mines://peer${search}` });
    return `connections/new?${params}`;
  }
  return path;
}
