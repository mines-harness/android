import { View } from "react-native";
import { AppText as Text } from "../../components/ui/AppText";
import { REMOTE_PAIRING_REQUIRES_PEER } from "../../connection/directPairingPolicy";

export function DirectPairingSection() {
  return (
    <View
      accessibilityRole="alert"
      className="gap-2 rounded-2xl border border-warning-border bg-warning p-4"
    >
      <Text className="font-mines-bold text-warning-foreground">Peer approval required</Text>
      <Text className="text-sm text-warning-foreground">{REMOTE_PAIRING_REQUIRES_PEER}</Text>
      <Text className="text-sm text-warning-foreground">
        Sign in below and approve this phone from Mines on your computer.
      </Text>
    </View>
  );
}
