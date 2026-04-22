import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { ThemedText } from "./themed-text";

interface Props {
  title: string;
  count: number;
  color?: string;
  onPress: () => void;
  isSmall?: boolean; // 這裡必須定義，TypeScript 才不會報錯
}

export function CategoryItem({
  title,
  count,
  color = "#2C2C2E",
  onPress,
  isSmall,
}: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.item,
        { backgroundColor: color },
        isSmall && styles.itemSmall, // 如果是 small，應用矮高度樣式
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.leftContent}>
        {/* 加一個小圓點或裝飾，視覺上比較精緻 */}
        <View style={[styles.dot, isSmall && styles.dotSmall]} />
        <ThemedText style={[styles.title, isSmall && styles.titleSmall]}>
          {title}
        </ThemedText>
      </View>

      <View style={styles.rightContent}>
        <ThemedText style={[styles.count, isSmall && styles.countSmall]}>
          {count.toLocaleString()}
        </ThemedText>
        <Ionicons
          name="chevron-forward"
          size={isSmall ? 14 : 18}
          color="#48484A"
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18, // 預設高度
    borderRadius: 15,
    marginBottom: 10,
    width: "100%", // 確保寬度是滿的
  },
  itemSmall: {
    paddingVertical: 10, // 【高度調低】關鍵：減少上下間距
    marginBottom: 6, // 項目之間的間距也縮小一點
    borderRadius: 10,
  },
  leftContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginRight: 12,
  },
  dotSmall: {
    width: 6,
    height: 6,
    marginRight: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  titleSmall: {
    fontSize: 14, // 【字體變小】
  },
  rightContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  count: {
    fontSize: 18,
    color: "#8E8E93",
    fontWeight: "500",
    marginRight: 8,
  },
  countSmall: {
    fontSize: 14, // 【數字變小】
    marginRight: 4,
  },
});
