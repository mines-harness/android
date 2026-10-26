import { readHostedPairingRequest, resolveRemotePairingTarget } from "@t3tools/shared/remote";
import { decodePeerPairing } from "@t3tools/shared/minesPeerPairing";
import * as Schema from "effect/Schema";

const MOBILE_PAIRING_URL_PARAM = "pairingUrl";

function isIpLiteral(host: string): boolean {
  try {
    const hostname = new URL(`http://${host}`).hostname.replace(/^\[|\]$/g, "");
    if (hostname.includes(":")) return true;

    const octets = hostname.split(".");
    return (
      octets.length === 4 &&
      octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)
    );
  } catch {
    return false;
  }
}

export class PairingQrPayloadEmptyError extends Schema.TaggedError<PairingQrPayloadEmptyError>()(
  "PairingQrPayloadEmptyError",
  {},
) {
  override get message(): string {
    return "Scanned QR code did not contain a pairing URL.";
  }
}

export function buildPairingUrl(host: string, code: string): string {
  const h = host.trim();
  const c = code.trim();
  if (!h) return "";
  if (!c) return h;

  try {
    const url = new URL(h.includes("://") ? h : `${isIpLiteral(h) ? "http" : "https"}://${h}`);
    url.hash = new URLSearchParams([["token", c]]).toString();
    return url.toString();
  } catch {
    return `${h}#token=${c}`;
  }
}

export function parsePairingUrl(url: string): { host: string; code: string } {
  const trimmed = url.trim();
  if (!trimmed) return { host: "", code: "" };

  try {
    const parsed = new URL(trimmed);
    const hostedPairingRequest = readHostedPairingRequest(parsed);
    if (hostedPairingRequest) {
      return {
        host: hostedPairingRequest.host.replace(/\/$/, ""),
        code: hostedPairingRequest.token,
      };
    }

    const hashParams = new URLSearchParams(parsed.hash.slice(1));
    const hashToken = hashParams.get("token");
    const queryToken = parsed.searchParams.get("token");
    const code = hashToken || queryToken || "";

    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = "/";
    return { host: parsed.toString().replace(/\/$/, ""), code };
  } catch {
    return { host: trimmed, code: "" };
  }
}

export function extractPairingUrlFromQrPayload(payload: string): string {
  const trimmed = payload.trim();
  if (!trimmed) {
    throw new PairingQrPayloadEmptyError({});
  }

  try {
    const url = new URL(trimmed);
    if (["mines:", "mines-dev:", "mines-preview:"].includes(url.protocol)) {
      const pairingUrl = url.searchParams.get(MOBILE_PAIRING_URL_PARAM)?.trim() ?? "";
      if (pairingUrl.length > 0) {
        return pairingUrl;
      }
    }
  } catch {}

  return trimmed;
}

export function readPairingInput(value: string, nowSeconds: number) {
  const pairingUrl = extractPairingUrlFromQrPayload(value);
  if (pairingUrl.length > 32768) throw new Error("This pairing link is too large.");
  if (/^mines:\/\/peer(?:[/?#]|$)/i.test(pairingUrl)) {
    return { kind: "peer", pairingUrl, target: decodePeerPairing(pairingUrl, nowSeconds) } as const;
  }
  const target = resolveRemotePairingTarget({ pairingUrl });
  const url = new URL(target.httpBaseUrl);
  if (url.username || url.password)
    throw new Error("Pairing links must not contain embedded passwords.");
  const origin = url.origin;
  return { kind: "direct", pairingUrl, origin, insecure: origin.startsWith("http:") } as const;
}
