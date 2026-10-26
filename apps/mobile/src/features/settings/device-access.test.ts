import { describe, expect, it, vi } from "vite-plus/test";
import { AuthStandardClientScopes, type DevicePairingRequest } from "@t3tools/contracts";
import {
  currentDeviceRequest,
  deviceApprovalScopes,
  readPendingDeviceRequests,
} from "./device-access";

const host = {
  deviceId: "host-device-id-0123456789",
  label: "Workstation",
  publicKey: "a".repeat(43),
};
const requester = { ...host, deviceId: "phone-device-id-0123456789", label: "Phone" };
const request: DevicePairingRequest = {
  id: "pairing-request-0123456789",
  code: "ABCD2345",
  expiresAt: "2026-10-26T20:00:00.000Z",
  requester,
  target: host,
  responsePublicKey: "b".repeat(43),
  proof: {
    version: 1,
    device: requester,
    nonce: "request-nonce-0123456789",
    issuedAt: 0,
    signature: "s".repeat(86),
    action: "request",
    id: "pairing-request-0123456789",
    targetDeviceId: host.deviceId,
    responsePublicKey: "b".repeat(43),
  },
};
const now = Date.parse("2026-10-26T19:00:00.000Z");

describe("remote device administration", () => {
  it("never delegates authority missing from the current session", () => {
    expect(deviceApprovalScopes(null)).toEqual([]);
    expect(
      deviceApprovalScopes({ authenticated: false, scopes: AuthStandardClientScopes }),
    ).toEqual([]);
    expect(
      deviceApprovalScopes({
        authenticated: true,
        scopes: AuthStandardClientScopes,
        permissions: [],
      }),
    ).toEqual([]);
    expect(
      deviceApprovalScopes({
        authenticated: true,
        scopes: AuthStandardClientScopes,
        permissions: ["orchestration:read", "filesystem:read"],
      }),
    ).toEqual(["orchestration:read", "filesystem:read"]);
  });

  it("rejects expired and cross-host requests before approval", () => {
    expect(currentDeviceRequest(request, host.deviceId, now)).toBe(true);
    expect(currentDeviceRequest(request, "another-host", now)).toBe(false);
    expect(currentDeviceRequest(request, host.deviceId, Date.parse(request.expiresAt))).toBe(false);
    expect(currentDeviceRequest({ ...request, expiresAt: "invalid" }, host.deviceId, now)).toBe(
      false,
    );
  });

  it("does not claim an empty request list or retry when the CLI host lacks this RPC", async () => {
    const list = vi.fn().mockRejectedValue(new Error("Unknown RPC method: peer.pairingRequests"));
    expect(await readPendingDeviceRequests(list, host.deviceId, () => now)).toEqual({
      status: "unavailable",
    });
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("shows only live requests for the selected host", async () => {
    const list = vi
      .fn()
      .mockResolvedValue([
        request,
        { ...request, id: "expired", expiresAt: "2026-10-26T18:00:00.000Z" },
        { ...request, id: "other-host", target: requester },
      ]);
    expect(await readPendingDeviceRequests(list, host.deviceId, () => now)).toEqual({
      status: "available",
      requests: [request],
    });
    expect(list).toHaveBeenCalledTimes(1);
  });
});
