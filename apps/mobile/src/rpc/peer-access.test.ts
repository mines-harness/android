import { describe, expect, it } from "@effect/vitest";
import {
  AVAILABLE_CONNECTION_STATE,
  EnvironmentSupervisor,
  PrimaryConnectionTarget,
  type PreparedConnection,
} from "@t3tools/client-runtime/connection";
import type { RpcSession, WsRpcProtocolClient } from "@t3tools/client-runtime/rpc";
import { EnvironmentId, WS_METHODS } from "@t3tools/contracts";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as TestClock from "effect/testing/TestClock";
import { readPeerPairingRequests } from "./peer-access";

const makeHost = Effect.fn("TestDeviceAccess.makeHost")(function* (
  method: () => Effect.Effect<never>,
) {
  const retries = yield* Ref.make(0);
  const client = { [WS_METHODS.peerPairingRequests]: method } as unknown as WsRpcProtocolClient;
  const session: RpcSession = {
    client,
    initialConfig: Effect.never,
    subscribeServerConfig: (input) => client.subscribeServerConfig(input),
    ready: Effect.void,
    probe: Effect.void,
    closed: Effect.never,
  };
  const supervisor = EnvironmentSupervisor.EnvironmentSupervisor.of({
    target: new PrimaryConnectionTarget({
      environmentId: EnvironmentId.make("device-test-host"),
      label: "Test CLI host",
      httpBaseUrl: "https://host.example.test",
      wsBaseUrl: "wss://host.example.test",
    }),
    state: yield* SubscriptionRef.make(AVAILABLE_CONNECTION_STATE),
    session: yield* SubscriptionRef.make(Option.some(session)),
    prepared: yield* SubscriptionRef.make(Option.none<PreparedConnection>()),
    connect: Effect.void,
    disconnect: Effect.void,
    retryNow: Ref.update(retries, (count) => count + 1),
  });
  return { supervisor, retries };
});

describe("optional host device request RPC", () => {
  it.effect("does not retry or reconnect a CLI host that lacks the method", () =>
    Effect.gen(function* () {
      let attempts = 0;
      const { supervisor, retries } = yield* makeHost(() => {
        attempts += 1;
        return Effect.die(new Error("Unknown RPC method: peer.pairingRequests"));
      });
      const result = yield* readPeerPairingRequests().pipe(
        Effect.provideService(EnvironmentSupervisor.EnvironmentSupervisor, supervisor),
        Effect.exit,
      );
      expect(Exit.isFailure(result)).toBe(true);
      expect(attempts).toBe(1);
      expect(yield* Ref.get(retries)).toBe(0);
    }),
  );

  it.effect("cancels an unanswered optional request after one bounded attempt", () =>
    Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const cancelled = yield* Deferred.make<void>();
      const { supervisor, retries } = yield* makeHost(() =>
        Deferred.succeed(started, undefined).pipe(
          Effect.andThen(Effect.never),
          Effect.ensuring(Deferred.succeed(cancelled, undefined)),
        ),
      );
      const pending = yield* readPeerPairingRequests().pipe(
        Effect.provideService(EnvironmentSupervisor.EnvironmentSupervisor, supervisor),
        Effect.flip,
        Effect.forkChild,
      );
      yield* Deferred.await(started);
      yield* TestClock.adjust("15 seconds");
      const failure = yield* Fiber.join(pending);
      expect(failure).toMatchObject({
        _tag: "EnvironmentRpcUnavailableError",
        environmentId: "device-test-host",
      });
      yield* Deferred.await(cancelled);
      expect(yield* Ref.get(retries)).toBe(0);
    }),
  );
});
