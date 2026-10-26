import { Modal, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../components/ui/Button";
import { SharedGroupsScreen } from "../features/contacts/SharedGroupsScreen";

export function WorkgroupLibraryModal({
  groupKey,
  onClose,
}: {
  readonly groupKey: string | null;
  readonly onClose: () => void;
}) {
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-screen">
        <View className="items-start border-b border-border px-4 py-2">
          <Button label="Close Workgroups" tone="text" onPress={onClose} />
        </View>
        <SharedGroupsScreen initialGroupKey={groupKey} />
      </SafeAreaView>
    </Modal>
  );
}
