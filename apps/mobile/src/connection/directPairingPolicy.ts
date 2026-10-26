import { ConnectionBlockedError } from "@t3tools/client-runtime/connection";
import type { EnvironmentId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

export const REMOTE_PAIRING_REQUIRES_PEER =
  "Mines requires a signed-in account and an approved direct peer connection. A one-time host link, including localhost, cannot approve this phone or open a session.";

export const rejectUnapprovedHostPairing = Effect.fn(
  "mobile.connection.rejectUnapprovedHostPairing",
)(function* (_input: {
  readonly pairingUrl: string;
  readonly expectedEnvironmentId?: EnvironmentId;
}) {
  return yield* new ConnectionBlockedError({
    reason: "unsupported",
    detail: REMOTE_PAIRING_REQUIRES_PEER,
  });
});
