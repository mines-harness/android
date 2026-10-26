import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Logger from "effect/Logger";
import * as SecureStore from "expo-secure-store";
import { vi } from "vite-plus/test";

const secureStore = vi.hoisted(() => new Map<string, string>());

vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "when-unlocked-this-device-only",
  getItemAsync: vi.fn((key: string) => Promise.resolve(secureStore.get(key) ?? null)),
  setItemAsync: vi.fn((key: string, value: string) => {
    secureStore.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    secureStore.delete(key);
    return Promise.resolve();
  }),
}));

import { managedRelayAccessTokenStore } from "./managedRelayTokenStore";

it.effect("falls back to an empty cache when persisted data is invalid", () =>
  Effect.gen(function* () {
    secureStore.clear();
    secureStore.set("mines.cloud.relay-access-tokens", "not-json");

    expect(yield* managedRelayAccessTokenStore.load).toEqual([]);
  }),
);

it.effect("keeps schema failures containing tokens out of logs", () =>
  Effect.gen(function* () {
    const token = "private-token-must-not-appear-in-logs";
    secureStore.clear();
    secureStore.set(
      "mines.cloud.relay-access-tokens",
      JSON.stringify({
        version: 1,
        entries: [{ accessToken: token, accountId: "account-1" }],
      }),
    );
    const messages: unknown[] = [];
    const logger = Logger.make(({ message }) => messages.push(message));
    expect(
      yield* managedRelayAccessTokenStore.load.pipe(
        Effect.provide(Logger.layer([logger], { mergeWithExisting: false })),
      ),
    ).toEqual([]);
    expect(messages.length).toBeGreaterThan(0);
    expect(JSON.stringify(messages)).not.toContain(token);
    expect(messages).toEqual([
      [
        "Managed relay token store operation failed.",
        {
          errorTag: "ManagedRelayTokenStoreError",
          operation: "decode",
          storageKey: "mines.cloud.relay-access-tokens",
        },
      ],
    ]);
  }),
);

it.effect("stores tokens with device-only keychain access and reuses the saved cache", () =>
  Effect.gen(function* () {
    secureStore.clear();
    const entries = [
      {
        accountId: "account-1",
        clientId: "mines-mobile" as const,
        relayUrl: "https://relay.example.test",
        thumbprint: "thumbprint",
        scopes: ["environment:connect" as const],
        accessToken: "isolated-test-token",
        expiresAtMillis: 999_999,
      },
    ];
    yield* managedRelayAccessTokenStore.save(entries);
    expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith(
      "mines.cloud.relay-access-tokens",
      expect.any(String),
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    );
    expect(yield* managedRelayAccessTokenStore.load).toEqual(entries);
  }),
);
