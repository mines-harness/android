import { WS_METHODS } from "@t3tools/contracts";
import {
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
} from "@t3tools/client-runtime/state/runtime";
import { connectionAtomRuntime } from "../connection/runtime";
import { readPeerPairingRequests } from "../rpc/peer-access";

export const peerState = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "mobile:peer:state",
  tag: WS_METHODS.peerGetState,
  staleTimeMs: 15_000,
  idleTtlMs: 0,
});

export const peerConnectionState = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "mobile:peer:connection",
  tag: WS_METHODS.peerConnectionState,
  staleTimeMs: 15_000,
  idleTtlMs: 0,
});

export const peerPairingRequests = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "mobile:peer:pairing-requests",
  tag: WS_METHODS.peerPairingRequests,
  execute: readPeerPairingRequests,
});

export const peerApprovePairing = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "mobile:peer:approve-pairing",
  tag: WS_METHODS.peerApprovePairing,
});

export const peerDenyPairing = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "mobile:peer:deny-pairing",
  tag: WS_METHODS.peerDenyPairing,
});

export const peerRevoke = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "mobile:peer:revoke",
  tag: WS_METHODS.peerRevoke,
});
