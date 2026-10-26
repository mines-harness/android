import { describe, expect, it } from "vite-plus/test";

import {
  buildPairingUrl,
  extractPairingUrlFromQrPayload,
  parsePairingUrl,
  readPairingInput,
} from "./pairing";

describe("buildPairingUrl", () => {
  it("uses HTTP for a schemeless IP address", () => {
    expect(buildPairingUrl("192.168.1.100:3773", "pairing-token")).toBe(
      "http://192.168.1.100:3773/#token=pairing-token",
    );
  });

  it("keeps HTTPS as the default for a schemeless hostname", () => {
    expect(buildPairingUrl("remote.example.com", "pairing-token")).toBe(
      "https://remote.example.com/#token=pairing-token",
    );
  });

  it("preserves an explicit scheme for an IP address", () => {
    expect(buildPairingUrl("https://192.168.1.100:3773", "pairing-token")).toBe(
      "https://192.168.1.100:3773/#token=pairing-token",
    );
  });
});

describe("extractPairingUrlFromQrPayload", () => {
  it.each(["mines", "mines-dev", "mines-preview"])(
    "unwraps %s deep links that carry an encoded pairing url",
    (scheme) => {
      expect(
        extractPairingUrlFromQrPayload(
          `${scheme}://pair?pairingUrl=https%3A%2F%2Fremote.example.com%2Fpair%23token%3Dpairing-token`,
        ),
      ).toBe("https://remote.example.com/pair#token=pairing-token");
    },
  );
});

describe("parsePairingUrl", () => {
  it("reads hosted pairing links into backend host fields", () => {
    expect(
      parsePairingUrl(
        "https://app.t3.codes/pair?host=https%3A%2F%2Fdesktop.tailnet.ts.net%2F#token=pairing-token",
      ),
    ).toEqual({
      host: "https://desktop.tailnet.ts.net",
      code: "pairing-token",
    });
  });
});

describe("readPairingInput", () => {
  it("validates a direct host link and reveals only its origin", () => {
    expect(readPairingInput("https://desktop.example.com/pair#token=secret", 0)).toEqual({
      kind: "direct",
      pairingUrl: "https://desktop.example.com/pair#token=secret",
      origin: "https://desktop.example.com",
      insecure: false,
    });
  });
  it("accepts a private HTTP host and labels the transport as unencrypted", () => {
    expect(readPairingInput("http://192.168.1.2:3773/#token=secret", 0)).toMatchObject({
      kind: "direct",
      origin: "http://192.168.1.2:3773",
      insecure: true,
    });
  });
  it("unwraps direct mobile links before validating their token", () => {
    expect(
      readPairingInput("mines://pair?pairingUrl=https%3A%2F%2Fhost.example%2F%23token%3Dx", 0),
    ).toMatchObject({ kind: "direct", origin: "https://host.example" });
  });
  it("rejects arbitrary QR contents and links without credentials", () => {
    for (const value of [
      "not a link",
      "https://host.example/",
      "ftp://host.example/#token=x",
      "https://user:password@host.example/#token=x",
    ]) {
      expect(() => readPairingInput(value, 0)).toThrow();
    }
  });
});
