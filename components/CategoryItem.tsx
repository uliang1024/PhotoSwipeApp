import { StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "./themed-text";

interface Props {
  title: string;
  count: number;
  color?: string;
  onPress: () => void;
}

export function CategoryItem({
  title,
  count,
  color = "#2C2C2E",
  onPress,
}: Props) {
  return (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: color }]}
      onPress={onPress}
    >
      <ThemedText style={styles.title}>{title}</ThemedText>
      <ThemedText style={styles.count}>{count.toLocaleString()}</ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderRadius: 15,
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: "600", color: "#fff" },
  count: { fontSize: 18, color: "#8E8E93", fontWeight: "500" },
});
