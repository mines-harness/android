import { EnvironmentSupervisor } from "@t3tools/client-runtime/connection";
import { EnvironmentRpcUnavailableError, request } from "@t3tools/client-runtime/rpc";
import { WS_METHODS } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

export const readPeerPairingRequests = Effect.fn("mobile.peer.readPairingRequests")(function* () {
  const supervisor = yield* EnvironmentSupervisor.EnvironmentSupervisor;
  return yield* request(WS_METHODS.peerPairingRequests, {}).pipe(
    Effect.timeoutOrElse({
      duration: "15 seconds",
      orElse: () =>
        Effect.fail(
          new EnvironmentRpcUnavailableError({
            environmentId: supervisor.target.environmentId,
            message:
              "Device requests could not be loaded. Review them on the host or check again when connected.",
          }),
        ),
    }),
  );
});
