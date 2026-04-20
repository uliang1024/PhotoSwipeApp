import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useState } from "react";
import {
    Dimensions,
    FlatList,
    SafeAreaView,
    StyleSheet,
    TouchableOpacity,
    View
} from "react-native";
import { ThemedText } from "./themed-text";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const COLUMN_COUNT = 4; // 網格一排 4 張
const ITEM_SIZE = SCREEN_WIDTH / COLUMN_COUNT;

interface PhotoGridModalProps {
  isVisible: boolean;
  onClose: () => void;
  photos: any[];
  title: string;
  onSelectPhoto: (index: number) => void;
  onBatchDelete: (ids: string[]) => void;
}

export const PhotoGridModal = ({
  isVisible,
  onClose,
  photos,
  title,
  onSelectPhoto,
  onBatchDelete,
}: PhotoGridModalProps) => {
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handlePhotoPress = (index: number, id: string) => {
    if (isSelectMode) {
      toggleSelect(id);
    } else {
      onSelectPhoto(index);
      onClose();
    }
  };

  const handleDone = () => {
    setIsSelectMode(false);
    setSelectedIds([]);
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const isSelected = selectedIds.includes(item.id);
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handlePhotoPress(index, item.id)}
        style={styles.itemContainer}
      >
        <Image source={{ uri: item.uri }} style={styles.thumbnail} />
        {isSelectMode && (
          <View style={styles.checkContainer}>
            <Ionicons
              name={isSelected ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={isSelected ? "#007AFF" : "#fff"}
            />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* --- Header --- */}
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
          <Ionicons name="chevron-up" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <ThemedText style={styles.titleText}>{title}</ThemedText>
          <ThemedText style={styles.subText}>選擇照片跳轉至</ThemedText>
        </View>

        <TouchableOpacity
          onPress={() => (isSelectMode ? handleDone() : setIsSelectMode(true))}
        >
          <ThemedText style={styles.selectActionText}>
            {isSelectMode ? "完成" : "選擇"}
          </ThemedText>
        </TouchableOpacity>
      </View>

      {/* --- Grid List --- */}
      <FlatList
        data={photos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={COLUMN_COUNT}
        contentContainerStyle={styles.gridContent}
      />

      {/* --- Footer --- */}
      {isSelectMode && (
        <View style={styles.footer}>
          <View style={{ flex: 1 }} />
          <ThemedText style={styles.footerInfoText}>選擇照片</ThemedText>
          <TouchableOpacity
            style={styles.deleteAction}
            onPress={() => {
              onBatchDelete(selectedIds);
              handleDone();
            }}
          >
            <ThemedText style={styles.deleteText}>
              刪除{selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    width: SCREEN_WIDTH, // 確保寬度正確
    height: SCREEN_HEIGHT, // 確保高度正確
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  titleContainer: { alignItems: "center" },
  titleText: { color: "#fff", fontWeight: "bold", fontSize: 17 },
  subText: { color: "#8E8E93", fontSize: 12, marginTop: 2 },
  selectActionText: { color: "#fff", fontSize: 16, fontWeight: "500" },
  iconBtn: { padding: 5 },
  gridContent: { paddingTop: 10 },
  itemContainer: { width: ITEM_SIZE, height: ITEM_SIZE, padding: 1 },
  thumbnail: { width: "100%", height: "100%" },
  checkContainer: {
    position: "absolute",
    right: 5,
    bottom: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
  footer: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "#1C1C1E",
    borderTopWidth: 0.5,
    borderTopColor: "#333",
  },
  footerInfoText: {
    color: "#8E8E93",
    fontSize: 15,
    flex: 2,
    textAlign: "center",
  },
  deleteAction: { flex: 1, alignItems: "flex-end" },
  deleteText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
