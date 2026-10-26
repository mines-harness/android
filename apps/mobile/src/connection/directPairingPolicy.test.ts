import { expect, it } from "@effect/vitest";
import { vi } from "vite-plus/test";
import { ConnectionOnboarding } from "@t3tools/client-runtime/connection";
import { EnvironmentId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import { rejectUnapprovedHostPairing } from "./directPairingPolicy";

function fixture() {
  const registerPairing = vi.fn(() => Effect.succeed(EnvironmentId.make("local-test-host")));
  const service = {
    registerPairing,
    registerSsh: () => Effect.die("Unexpected SSH registration"),
    updateBearer: () => Effect.die("Unexpected bearer edit"),
  } satisfies Effect.Success<typeof ConnectionOnboarding.ConnectionOnboarding>;
  return { registerPairing, service };
}

it.effect.each([
  "http://10.0.2.2:3773/#token=isolated-secret",
  "http://192.168.1.10:3773/#token=isolated-secret",
  "https://host.example/#token=isolated-secret",
  "https://desktop.tailnet.ts.net/#token=isolated-secret",
  "http://localhost.example/#token=isolated-secret",
  "http://127.0.0.1.example/#token=isolated-secret",
  "http://user:password@127.0.0.1:3773/#token=isolated-secret",
  "https://app.t3.codes/pair?host=http%3A%2F%2F10.0.2.2%3A3773%2F#token=isolated-secret",
])("rejects unapproved remote pairing before invoking credential exchange: %s", (pairingUrl) =>
  Effect.gen(function* () {
    const f = fixture();
    const outcome = yield* rejectUnapprovedHostPairing({ pairingUrl }).pipe(
      Effect.provideService(ConnectionOnboarding.ConnectionOnboarding, f.service),
      Effect.exit,
    );
    expect(outcome._tag).toBe("Failure");
    expect(f.registerPairing).not.toHaveBeenCalled();
    expect(String(outcome)).not.toContain("isolated-secret");
  }),
);

it.effect.each(["localhost", "127.0.0.1", "[::1]"])(
  "rejects loopback host links before credential exchange because they are not approved peer routes: %s",
  (hostname) =>
    Effect.gen(function* () {
      const f = fixture();
      const input = {
        pairingUrl: `http://${hostname}:3773/#token=isolated-secret`,
        expectedEnvironmentId: EnvironmentId.make("expected-local-host"),
      };
      const outcome = yield* rejectUnapprovedHostPairing(input).pipe(
        Effect.provideService(ConnectionOnboarding.ConnectionOnboarding, f.service),
        Effect.exit,
      );
      expect(outcome._tag).toBe("Failure");
      expect(f.registerPairing).not.toHaveBeenCalled();
    }),
);

it.effect("rejects malformed input before invoking credential exchange", () =>
  Effect.gen(function* () {
    const f = fixture();
    const outcome = yield* rejectUnapprovedHostPairing({ pairingUrl: "not-a-link" }).pipe(
      Effect.provideService(ConnectionOnboarding.ConnectionOnboarding, f.service),
      Effect.exit,
    );
    expect(outcome._tag).toBe("Failure");
    expect(f.registerPairing).not.toHaveBeenCalled();
  }),
);
