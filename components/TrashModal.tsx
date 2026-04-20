import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import React, { useState } from "react";
import {
    Alert,
    Dimensions,
    FlatList,
    Modal,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COLUMN_COUNT = 3;
const ITEM_SIZE = SCREEN_WIDTH / COLUMN_COUNT;

interface TrashModalProps {
  isVisible: boolean;
  onClose: () => void;
  pendingAssets: MediaLibrary.Asset[];
  onConfirmDelete: (ids: string[]) => void;
  onRestore: (ids: string[]) => void;
}

export const TrashModal = ({
  isVisible,
  onClose,
  pendingAssets,
  onConfirmDelete,
  onRestore,
}: TrashModalProps) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleAction = (type: "delete" | "restore") => {
    const isAll = selectedIds.length === 0;
    const targetIds = isAll ? pendingAssets.map((a) => a.id) : selectedIds;
    const count = targetIds.length;

    if (type === "delete") {
      // 專業做法：刪除不跳 Alert，直接交給 iOS 系統處理
      onConfirmDelete(targetIds);
      setSelectedIds([]); // 清空選取狀態
    } else {
      // 恢復則保留詢問，避免使用者誤觸
      Alert.alert("確定恢復", `這將把 ${count} 個項目移回整理清單。`, [
        { text: "取消", style: "cancel" },
        {
          text: "確定",
          onPress: () => {
            onRestore(targetIds);
            setSelectedIds([]);
          },
        },
      ]);
    }
  };

  const renderItem = ({ item }: { item: MediaLibrary.Asset }) => {
    const isSelected = selectedIds.includes(item.id);
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => toggleSelect(item.id)}
        style={styles.itemContainer}
      >
        <Image source={{ uri: item.uri }} style={styles.thumbnail} />
        {item.mediaType === "video" && (
          <View style={styles.videoBadge}>
            <Ionicons name="play" size={12} color="#fff" />
          </View>
        )}
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <ThemedView style={styles.contentContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <ThemedText style={styles.headerTitle}>垃圾桶</ThemedText>
              <ThemedText style={styles.headerSub}>
                刪除照片以釋放設備空間！
              </ThemedText>
            </View>
            <View style={{ width: 28 }} />
          </View>

          <FlatList
            data={pendingAssets}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={COLUMN_COUNT}
            contentContainerStyle={styles.listContent}
          />

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtn]}
              onPress={() => handleAction("delete")}
            >
              <ThemedText style={styles.btnText}>
                {selectedIds.length > 0
                  ? `刪除所選 (${selectedIds.length})`
                  : "刪除全部"}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.restoreBtn]}
              onPress={() => handleAction("restore")}
            >
              <ThemedText style={styles.btnText}>
                {selectedIds.length > 0
                  ? `恢復所選 (${selectedIds.length})`
                  : "恢復全部"}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  contentContainer: {
    height: "90%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: "#333",
  },
  headerTextContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  headerSub: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 4,
  },
  closeBtn: {
    padding: 5,
  },
  listContent: {
    paddingBottom: 20,
  },
  itemContainer: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    padding: 1,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  videoBadge: {
    position: "absolute",
    bottom: 5,
    right: 5,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    padding: 2,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  actionBtn: {
    width: "100%",
    height: 50,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteBtn: {
    backgroundColor: "#FF3B30",
  },
  restoreBtn: {
    backgroundColor: "#2C2C2E",
  },
  btnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
