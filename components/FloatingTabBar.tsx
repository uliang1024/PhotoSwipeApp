import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur"; // 需要 npx expo install expo-blur
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { ThemedText } from "./themed-text";

export function FloatingTabBar() {
  const tabs = [
    { name: "整理", icon: "copy-outline" },
    { name: "照片", icon: "grid-outline" },
    { name: "相冊", icon: "folder-open-outline" },
    { name: "更多", icon: "menu-outline" },
  ];

  return (
    <View style={styles.container}>
      <BlurView intensity={80} tint="dark" style={styles.blurWrapper}>
        {tabs.map((tab, i) => (
          <TouchableOpacity key={i} style={styles.tabItem}>
            <Ionicons
              name={tab.icon as any}
              size={20}
              color={i === 0 ? "#fff" : "#8E8E93"}
            />
            <ThemedText style={[styles.tabText, i === 0 && styles.activeText]}>
              {tab.name}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    width: "90%",
    zIndex: 100,
  },
  blurWrapper: {
    flexDirection: "row",
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 20,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  tabItem: { alignItems: "center", flex: 1 },
  tabText: { fontSize: 12, color: "#8E8E93", marginTop: 4 },
  activeText: { color: "#fff", fontWeight: "bold" },
});
