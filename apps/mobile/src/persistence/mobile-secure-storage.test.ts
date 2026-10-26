import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { vi } from "vite-plus/test";

const secureStore = vi.hoisted(() => ({
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  getItemAsync: vi.fn().mockResolvedValue("session-value"),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "when-unlocked-this-device-only",
}));
vi.mock("expo-secure-store", () => secureStore);
import { make } from "./mobile-secure-storage";

it.effect("persists credentials only in the unlocked device's secure storage", () =>
  Effect.gen(function* () {
    yield* make.setItem("credential", "session-value");
    expect(secureStore.setItemAsync).toHaveBeenLastCalledWith("credential", "session-value", {
      keychainAccessible: secureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    expect(yield* make.getItem("credential")).toBe("session-value");
    yield* make.removeItem("credential");
    expect(secureStore.deleteItemAsync).toHaveBeenLastCalledWith("credential");
  }),
);
