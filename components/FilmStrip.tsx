import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { Colors } from "@/constants/theme";

interface Props {
  uris: string[];
  frames: number; // 固定格數，照片不夠就留空格
  frameHeight: number;
}

const SPROCKETS = 14;

function SprocketRow() {
  return (
    <View style={styles.sprocketRow}>
      {Array.from({ length: SPROCKETS }, (_, i) => (
        <View key={i} style={styles.sprocket} />
      ))}
    </View>
  );
}

// 底片樣張帶：上下齒孔、中間一排縮圖格
export function FilmStrip({ uris, frames, frameHeight }: Props) {
  return (
    <View style={styles.strip}>
      <SprocketRow />
      <View style={styles.frames}>
        {Array.from({ length: frames }, (_, i) => (
          <View key={i} style={[styles.frame, { height: frameHeight }]}>
            {uris[i] && (
              <Image
                source={{ uri: uris[i] }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                recyclingKey={uris[i]}
              />
            )}
          </View>
        ))}
      </View>
      <SprocketRow />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    backgroundColor: Colors.surface,
    borderRadius: 4,
    paddingHorizontal: 4,
    overflow: "hidden",
  },
  sprocketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  sprocket: {
    width: 8,
    height: 5,
    borderRadius: 1.5,
    backgroundColor: Colors.background,
  },
  frames: { flexDirection: "row", gap: 3 },
  frame: {
    flex: 1,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: Colors.surfaceRaised,
  },
});
