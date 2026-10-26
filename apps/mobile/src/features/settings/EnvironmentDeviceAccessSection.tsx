import { useAtomValue } from "@effect/atom-react";
import {
  AuthAccessReadScope,
  AuthAccessWriteScope,
  type AuthGrantScope,
  type DevicePairingRequest,
  type EnvironmentId,
} from "@t3tools/contracts";
import { settlePromise, squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { AUTH_SCOPE_OPTIONS } from "@t3tools/shared/authScopeOptions";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { AppText as Text } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import * as Dialog from "../../components/ui/Dialog";
import { appAtomRegistry } from "../../state/atom-registry";
import {
  peerApprovePairing,
  peerConnectionState,
  peerDenyPairing,
  peerPairingRequests,
  peerRevoke,
  peerState,
} from "../../state/peers";
import { useEnvironmentQuery } from "../../state/query";
import { environmentSession, readEnvironmentScope, useEnvironmentScope } from "../../state/session";
import { useAtomCommand } from "../../state/use-atom-command";
import { SettingsActionRow } from "./components/SettingsActionRow";
import { SettingsSection } from "./components/SettingsSection";
import {
  currentDeviceRequest,
  deviceApprovalScopes,
  type PendingDeviceRequests,
  readPendingDeviceRequests,
} from "./device-access";

export function EnvironmentDeviceAccessSection({
  environmentId,
  connected,
}: {
  readonly environmentId: EnvironmentId;
  readonly connected: boolean;
}) {
  const canRead = useEnvironmentScope(environmentId, AuthAccessReadScope);
  const [expanded, setExpanded] = useState(false);
  return (
    <SettingsSection title="Device access">
      {!connected || !canRead ? (
        <Text className="p-4 text-sm text-foreground-muted">
          {!connected
            ? "Connect to this host to view authorized devices."
            : "This connection cannot view device access. Manage access on the host or use an authorized connection."}
        </Text>
      ) : (
        <>
          <SettingsActionRow
            icon={{ ios: "lock.shield", android: "lock" }}
            label={expanded ? "Hide authorized devices" : "View authorized devices"}
            onPress={() => setExpanded((value) => !value)}
          />
          {expanded ? <DeviceAccess environmentId={environmentId} /> : null}
        </>
      )}
    </SettingsSection>
  );
}

function DeviceAccess({ environmentId }: { readonly environmentId: EnvironmentId }) {
  const trust = useEnvironmentQuery(peerState({ environmentId, input: {} }));
  const connection = useEnvironmentQuery(peerConnectionState({ environmentId, input: {} }));
  const session = useAtomValue(environmentSession.sessionStateValueAtom(environmentId));
  const canWrite = useEnvironmentScope(environmentId, AuthAccessWriteScope);
  const listRequests = useAtomCommand(peerPairingRequests, { reportFailure: false });
  const approve = useAtomCommand(peerApprovePairing, { reportFailure: false });
  const deny = useAtomCommand(peerDenyPairing, { reportFailure: false });
  const revoke = useAtomCommand(peerRevoke, { reportFailure: false });
  const [requests, setRequests] = useState<PendingDeviceRequests>({ status: "not-loaded" });
  const [busy, setBusy] = useState<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function checkRequests() {
    const hostDeviceId = trust.data?.device.deviceId;
    if (
      pending.current ||
      !hostDeviceId ||
      !readEnvironmentScope(environmentId, AuthAccessReadScope)
    )
      return;
    pending.current = true;
    setBusy("requests");
    setRequests({ status: "loading" });
    const next = await readPendingDeviceRequests(
      async () => {
        const result = await listRequests({ environmentId, input: {} });
        if (result._tag !== "Success") throw squashAtomCommandFailure(result);
        return result.value;
      },
      hostDeviceId,
      Date.now,
    );
    pending.current = false;
    if (mounted.current) {
      setRequests(next);
      setBusy(null);
    }
  }

  async function changeAccess(key: string, action: () => Promise<void>) {
    if (
      pending.current ||
      !mounted.current ||
      !readEnvironmentScope(environmentId, AuthAccessWriteScope)
    )
      return;
    pending.current = true;
    setBusy(key);
    setError(null);
    setNotice(null);
    const result = await settlePromise(action);
    pending.current = false;
    if (!mounted.current) return;
    setBusy(null);
    setRequests({ status: "not-loaded" });
    if (result._tag === "Success") {
      setNotice("Device access updated.");
      trust.refresh();
      connection.refresh();
    } else {
      setError(
        "The result could not be verified. Refresh device access before trying again. Your host may require reviewing this action locally.",
      );
      trust.refresh();
    }
  }

  function answerRequest(request: DevicePairingRequest, accept: boolean) {
    const hostDeviceId = trust.data?.device.deviceId;
    // oxlint-disable-next-line react/purity -- Runs only from a request button event.
    if (!hostDeviceId || !currentDeviceRequest(request, hostDeviceId, Date.now())) {
      setRequests({ status: "not-loaded" });
      setError("This request has expired. Check for requests again.");
      return;
    }
    const confirmedScopes = deviceApprovalScopes(session);
    if (accept && confirmedScopes.length === 0) return;
    const names = AUTH_SCOPE_OPTIONS.filter(({ scope }) => confirmedScopes.includes(scope)).map(
      ({ title }) => title,
    );
    Dialog.confirm({
      title: accept ? `Allow ${request.requester.label}?` : `Decline ${request.requester.label}?`,
      message: accept
        ? `Verify that ${request.code.slice(0, 4)} ${request.code.slice(4)} matches the other device. This grants persistent access to this host with these permissions:\n\n${names.join("\n")}\n\nYou can revoke access here.`
        : "This device will not receive access to the host.",
      confirmText: accept ? "Allow access" : "Decline request",
      destructive: !accept,
      onConfirm: () =>
        void changeAccess(request.id, async () => {
          if (!currentDeviceRequest(request, hostDeviceId, Date.now()))
            throw new Error("Expired request");
          const currentScopes = deviceApprovalScopes(
            appAtomRegistry.get(environmentSession.sessionStateValueAtom(environmentId)),
          );
          const scopes: ReadonlyArray<AuthGrantScope> = confirmedScopes.filter((scope) =>
            currentScopes.includes(scope),
          );
          if (accept && scopes.length === 0) throw new Error("Permission changed");
          const result = accept
            ? await approve({ environmentId, input: { code: request.code, scopes } })
            : await deny({ environmentId, input: { code: request.code } });
          if (result._tag !== "Success") throw squashAtomCommandFailure(result);
        }),
    });
  }

  const configured = connection.data?.configured === true;
  return (
    <View className="gap-4 p-4">
      <View className="gap-1">
        <Text className="text-sm text-foreground-muted">
          Changes apply only to this host. Requests are checked when you ask; keep the host awake.
        </Text>
        {connection.data && !configured ? (
          <Text className="text-sm text-foreground-muted">
            Peer access is disabled on this host. Enable it on the host to receive device requests.
          </Text>
        ) : null}
        {trust.isPending && !trust.data ? (
          <Text accessibilityLiveRegion="polite" className="text-sm text-foreground-muted">
            Loading authorized devices…
          </Text>
        ) : null}
        {trust.error || connection.error ? (
          <Text accessibilityRole="alert" className="text-sm text-danger-foreground">
            Device access could not be loaded. This host may not expose remote device
            administration. Refresh or manage access on the host.
          </Text>
        ) : null}
      </View>
      <Button
        label="Refresh device access"
        tone="text"
        disabled={busy !== null}
        onPress={() => {
          trust.refresh();
          connection.refresh();
          setRequests({ status: "not-loaded" });
        }}
      />
      {trust.isSuccess && !trust.isPending && trust.data?.approvedDevices.length === 0 ? (
        <Text className="text-sm text-foreground-muted">
          No other devices are authorized on this host.
        </Text>
      ) : null}
      {trust.data?.approvedDevices.map((device) => (
        <View key={device.deviceId} className="gap-2">
          <Text className="text-base font-mines-medium text-foreground">{device.label}</Text>
          <Text selectable className="text-xs text-foreground-muted">
            Fingerprint: {device.deviceId}
          </Text>
          {canWrite ? (
            <Button
              label="Revoke access"
              accessibilityLabel={`Revoke ${device.label}'s access`}
              tone="danger"
              disabled={busy !== null}
              loading={busy === device.deviceId}
              onPress={() =>
                Dialog.confirm({
                  title: `Revoke ${device.label}?`,
                  message:
                    "This device will lose access to the host. If it is this phone, your connection may close. A new approval will be needed to reconnect.",
                  confirmText: "Revoke access",
                  destructive: true,
                  onConfirm: () =>
                    void changeAccess(device.deviceId, async () => {
                      const result = await revoke({
                        environmentId,
                        input: { deviceId: device.deviceId },
                      });
                      if (result._tag !== "Success") throw squashAtomCommandFailure(result);
                    }),
                })
              }
            />
          ) : null}
        </View>
      ))}
      {!canWrite ? (
        <Text className="text-sm text-foreground-muted">
          This connection can view devices but cannot approve requests or revoke access.
        </Text>
      ) : null}
      {configured && trust.data ? (
        <Button
          label="Check access requests"
          disabled={busy !== null}
          loading={busy === "requests"}
          onPress={() => void checkRequests()}
        />
      ) : null}
      {requests.status === "unavailable" ? (
        <Text accessibilityRole="alert" className="text-sm text-foreground-muted">
          Access requests could not be listed. Older CLI hosts do not expose this operation. Review
          requests on the host or check again when connected.
        </Text>
      ) : null}
      {requests.status === "available" && requests.requests.length === 0 ? (
        <Text className="text-sm text-foreground-muted">
          No pending requests at the last check.
        </Text>
      ) : null}
      {requests.status === "available"
        ? requests.requests.map((request) => (
            <View key={request.id} className="gap-2">
              <Text className="text-base font-mines-medium text-foreground">
                {request.requester.label} wants access
              </Text>
              <Text selectable className="text-lg font-mines-medium text-foreground">
                {request.code.slice(0, 4)} {request.code.slice(4)}
              </Text>
              <Text selectable className="text-xs text-foreground-muted">
                Fingerprint: {request.requester.deviceId}
              </Text>
              <Text className="text-sm text-foreground-muted">
                Compare the code on the other device before allowing access.
              </Text>
              {canWrite ? (
                <View className="flex-row flex-wrap gap-2">
                  <Button
                    label="Decline"
                    disabled={busy !== null}
                    onPress={() => answerRequest(request, false)}
                  />
                  <Button
                    label="Review access"
                    tone="primary"
                    disabled={busy !== null || deviceApprovalScopes(session).length === 0}
                    loading={busy === request.id}
                    onPress={() => answerRequest(request, true)}
                  />
                </View>
              ) : null}
            </View>
          ))
        : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-danger-foreground">
          {error}
        </Text>
      ) : null}
      {notice ? (
        <Text accessibilityLiveRegion="polite" className="text-sm text-foreground-muted">
          {notice}
        </Text>
      ) : null}
    </View>
  );
}
