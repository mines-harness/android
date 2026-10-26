import type { EnvironmentId } from "@t3tools/contracts";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { AppText as Text, AppTextInput } from "../../components/ui/AppText";
import { ListRow } from "../../components/ui/ListRow";
import { connectPairingUrl } from "../../connection/onboarding";
import { useAtomCommand } from "../../state/use-atom-command";
import { readPairingInput } from "./pairing";

interface DirectPairingRequest {
  readonly pairingUrl: string;
  readonly expectedEnvironmentId?: EnvironmentId;
}
type PairDirectHost = (
  request: DirectPairingRequest,
) => Promise<{ readonly _tag: "Success" | "Failure" }>;

function directPairingTarget(value: string) {
  try {
    const target = readPairingInput(value, Date.now() / 1000);
    return target.kind === "direct" ? target : null;
  } catch {
    return null;
  }
}

async function pairDirectHost(pair: PairDirectHost, request: DirectPairingRequest) {
  try {
    return (await pair(request))._tag === "Success";
  } catch {
    return false;
  }
}

export function DirectPairingSection({
  initialPairingUrl,
  expectedEnvironmentId,
}: {
  readonly initialPairingUrl: string;
  readonly expectedEnvironmentId?: EnvironmentId;
}) {
  const pair = useAtomCommand(connectPairingUrl, { reportFailure: false, reportDefect: false });
  const [pairingUrl, setPairingUrl] = useState(initialPairingUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const connect = useCallback(
    async (value: string) => {
      if (inFlight.current) return;
      const target = directPairingTarget(value);
      if (target === null) {
        setMessage("Paste a complete one-time host pairing link from your computer.");
        return;
      }
      inFlight.current = true;
      setBusy(true);
      setMessage("Checking the host and pairing this phone…");
      const connected = await pairDirectHost(pair, {
        pairingUrl: target.pairingUrl,
        ...(expectedEnvironmentId ? { expectedEnvironmentId } : {}),
      });
      inFlight.current = false;
      setBusy(false);
      if (connected) {
        setPairingUrl("");
        setMessage("Host paired. Its projects and mines are available in your library.");
      } else {
        setMessage(
          "Could not pair. Check that the host is reachable, its server is compatible, and the one-time link has not expired or already been used.",
        );
      }
    },
    [expectedEnvironmentId, pair],
  );

  const target = directPairingTarget(pairingUrl);
  const host = target?.origin ?? null;
  const insecure = target?.insecure ?? false;
  return (
    <View className="gap-3">
      <Text className="px-4 text-lg font-mines-bold text-foreground">Pair a reachable host</Text>
      <Text className="px-4 text-sm text-foreground-muted">
        In mines on your computer, create a one-time pairing link. Use a trusted local network or an
        existing private network to reach that host. No mines account is required.
      </Text>
      <AppTextInput
        accessibilityLabel="Host one-time pairing link"
        multiline
        autoCorrect={false}
        spellCheck={false}
        autoCapitalize="none"
        autoComplete="off"
        textContentType="none"
        editable={!busy}
        placeholder="https://your-host/pair#token=…"
        value={pairingUrl}
        onChangeText={(value) => {
          setPairingUrl(value);
          setMessage(null);
        }}
      />
      {host ? (
        <Text selectable className="px-4 text-sm text-foreground-muted">
          Host: {host}
        </Text>
      ) : null}
      {insecure ? (
        <Text className="px-4 text-sm text-foreground-muted">
          This host uses HTTP. Pair only over a trusted local or encrypted private network.
        </Text>
      ) : null}
      <ListRow
        label={busy ? "Pairing…" : "Pair host"}
        disabled={busy || host === null}
        onPress={() => {
          void connect(pairingUrl);
        }}
      />
      {message ? (
        <Text accessibilityLiveRegion="polite" className="px-4 text-sm text-foreground-muted">
          {message}
        </Text>
      ) : null}
      <Text className="px-4 text-xs text-foreground-muted">
        Sections and pins stay in this phone’s local library. Inherited library context and
        cross-device library sync require an approved peer connection. You can still attach context
        directly to a message.
      </Text>
    </View>
  );
}
