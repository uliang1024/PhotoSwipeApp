import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "./themed-text";
import { Colors, Fonts } from "@/constants/theme";

interface Props {
  title: string;
  count: number;
  onPress: () => void;
}

export function CategoryItem({ title, count, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
      <ThemedText style={styles.title} numberOfLines={1}>
        {title}
      </ThemedText>
      <ThemedText style={styles.count}>{count.toLocaleString()}</ThemedText>
      <Ionicons name="chevron-forward" size={14} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  title: { flex: 1, fontSize: 15, color: Colors.text },
  count: {
    fontFamily: Fonts.number,
    fontSize: 18,
    color: Colors.textSecondary,
    marginRight: 6,
  },
});
