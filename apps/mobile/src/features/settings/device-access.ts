import {
  AuthStandardClientScopes,
  type AuthGrantScope,
  type DevicePairingRequest,
  type SessionGrantInput,
  sessionGrantsScope,
} from "@t3tools/contracts";

export function deviceApprovalScopes(
  session: SessionGrantInput | null,
): ReadonlyArray<AuthGrantScope> {
  return session === null
    ? []
    : AuthStandardClientScopes.filter((scope) => sessionGrantsScope(session, scope));
}

export function currentDeviceRequest(
  request: DevicePairingRequest,
  hostDeviceId: string,
  now: number,
): boolean {
  return request.target.deviceId === hostDeviceId && Date.parse(request.expiresAt) > now;
}

export type PendingDeviceRequests =
  | { readonly status: "not-loaded" | "loading" | "unavailable" }
  | { readonly status: "available"; readonly requests: ReadonlyArray<DevicePairingRequest> };

export async function readPendingDeviceRequests(
  list: () => Promise<ReadonlyArray<DevicePairingRequest>>,
  hostDeviceId: string,
  now: () => number,
): Promise<PendingDeviceRequests> {
  try {
    const requests = await list();
    return {
      status: "available",
      requests: requests.filter((request) => currentDeviceRequest(request, hostDeviceId, now())),
    };
  } catch {
    return { status: "unavailable" };
  }
}
