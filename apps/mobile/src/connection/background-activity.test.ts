import { EnvironmentId, WS_METHODS } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as TestClock from "effect/testing/TestClock";

import { mobileActivityHeartbeats } from "./background-activity-heartbeat";

import {
  onRetainedMobileBackgroundScopesChange,
  observeMobileBackgroundActivitySubscription,
  retainedMobileBackgroundScopes,
} from "./background-activity-scopes";

describe("mobile background activity", () => {
  it.effect("stops lease heartbeats during suspension and restarts one on foreground", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const appState = yield* SubscriptionRef.make<string | null>("active");
        const heartbeats = yield* Queue.unbounded<void>();
        let reports = 0;
        yield* mobileActivityHeartbeats(SubscriptionRef.changes(appState)).pipe(
          Stream.runForEach(() =>
            Effect.sync(() => reports++).pipe(Effect.andThen(Queue.offer(heartbeats, undefined))),
          ),
          Effect.forkScoped,
        );
        yield* Queue.take(heartbeats);

        yield* TestClock.adjust("25 seconds");
        expect(reports).toBe(2);
        yield* Queue.take(heartbeats);

        yield* SubscriptionRef.set(appState, "background");
        yield* TestClock.adjust("5 minutes");
        expect(reports).toBe(2);

        yield* SubscriptionRef.set(appState, "inactive");
        yield* TestClock.adjust("1 minute");
        expect(reports).toBe(2);

        yield* SubscriptionRef.set(appState, "active");
        yield* Queue.take(heartbeats);
        expect(reports).toBe(3);
        yield* TestClock.adjust("25 seconds");
        expect(reports).toBe(4);
        yield* TestClock.adjust("25 seconds");
        expect(reports).toBe(5);
      }),
    ),
  );

  it.effect("keeps a single heartbeat when active state notifications repeat", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const appState = yield* SubscriptionRef.make<string | null>("active");
        const heartbeats = yield* Queue.unbounded<void>();
        let reports = 0;
        yield* mobileActivityHeartbeats(SubscriptionRef.changes(appState)).pipe(
          Stream.runForEach(() =>
            Effect.sync(() => reports++).pipe(Effect.andThen(Queue.offer(heartbeats, undefined))),
          ),
          Effect.forkScoped,
        );
        yield* Queue.take(heartbeats);

        yield* TestClock.adjust("20 seconds");
        yield* SubscriptionRef.set(appState, "active");
        yield* SubscriptionRef.set(appState, "active");
        yield* TestClock.adjust("5 seconds");
        expect(reports).toBe(2);

        yield* TestClock.adjust("25 seconds");
        expect(reports).toBe(3);
      }),
    ),
  );

  it.effect("retains VCS demand only while the mobile subscription is active", () =>
    Effect.gen(function* () {
      const environmentId = EnvironmentId.make("mobile-environment");
      const releasePassive = yield* observeMobileBackgroundActivitySubscription({
        environmentId,
        method: WS_METHODS.subscribeVcsStatus,
        input: { cwd: "/workspace", includeRemote: false },
      });
      expect(retainedMobileBackgroundScopes(environmentId)).toEqual([]);
      const release = yield* observeMobileBackgroundActivitySubscription({
        environmentId,
        method: WS_METHODS.subscribeVcsStatus,
        input: { cwd: "/workspace" },
      });

      expect(retainedMobileBackgroundScopes(environmentId)).toEqual([
        { type: "vcs-status", cwd: "/workspace" },
      ]);

      yield* releasePassive;
      expect(retainedMobileBackgroundScopes(environmentId)).toEqual([
        { type: "vcs-status", cwd: "/workspace" },
      ]);

      yield* release;
      expect(retainedMobileBackgroundScopes(environmentId)).toEqual([]);
    }),
  );

  it.effect("keeps delimiter-containing environment and scope values distinct", () =>
    Effect.gen(function* () {
      const firstEnvironmentId = EnvironmentId.make("a");
      const secondEnvironmentId = EnvironmentId.make("a:vcs-status:b");
      const releaseFirst = yield* observeMobileBackgroundActivitySubscription({
        environmentId: firstEnvironmentId,
        method: WS_METHODS.subscribeVcsStatus,
        input: { cwd: "b:vcs-status:c" },
      });
      const releaseSecond = yield* observeMobileBackgroundActivitySubscription({
        environmentId: secondEnvironmentId,
        method: WS_METHODS.subscribeVcsStatus,
        input: { cwd: "c" },
      });

      expect(retainedMobileBackgroundScopes(firstEnvironmentId)).toEqual([
        { type: "vcs-status", cwd: "b:vcs-status:c" },
      ]);
      expect(retainedMobileBackgroundScopes(secondEnvironmentId)).toEqual([
        { type: "vcs-status", cwd: "c" },
      ]);

      yield* Effect.all([releaseFirst, releaseSecond]);
    }),
  );

  it.effect("returns a release handle when a retained-scope listener throws", () =>
    Effect.gen(function* () {
      const environmentId = EnvironmentId.make("throwing-listener-environment");
      const removeListener = onRetainedMobileBackgroundScopesChange(() => {
        throw new Error("listener failed");
      });

      const release = yield* observeMobileBackgroundActivitySubscription({
        environmentId,
        method: WS_METHODS.subscribeVcsStatus,
        input: { cwd: "/workspace" },
      });
      expect(retainedMobileBackgroundScopes(environmentId)).toEqual([
        { type: "vcs-status", cwd: "/workspace" },
      ]);

      yield* release;
      expect(retainedMobileBackgroundScopes(environmentId)).toEqual([]);
      removeListener();
    }),
  );
});
