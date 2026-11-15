// 相似照片分組原型（丟棄式）：首頁長按月份進來，量 dHash 速度與分組準確度
import { ThemedText } from "@/components/themed-text";
import { Colors, Fonts } from "@/constants/theme";
import {
  decodePngGray,
  dHashFromGray,
  groupSimilar,
  HASH_H,
  HASH_W,
  type Hash,
  type HashedItem,
} from "@/lib/dhash";
import { getLibrarySnapshot } from "@/lib/library-store";
import { findBursts, monthKey } from "@/lib/media";
import { Image } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CONCURRENCY = 4;
const THRESHOLDS = [4, 6, 8, 10, 12, 16];
const GAPS = [
  { label: "不限時間", ms: Infinity },
  { label: "1 小時內", ms: 60 * 60 * 1000 },
  { label: "10 分內", ms: 10 * 60 * 1000 },
];

async function hashAsset(uri: string): Promise<Hash> {
  // maxWidth 讓 iOS 直接從相簿要小圖，不解整張原圖
  const ctx = ImageManipulator.manipulate(uri, { maxWidth: 64 });
  const ref = await ctx.resize({ width: HASH_W, height: HASH_H }).renderAsync();
  try {
    const { base64 } = await ref.saveAsync({
      format: SaveFormat.PNG,
      base64: true,
    });
    const { width, height, gray } = decodePngGray(base64!);
    if (width !== HASH_W || height !== HASH_H)
      throw new Error(`尺寸 ${width}×${height}`);
    return dHashFromGray(gray);
  } finally {
    ref.release();
    ctx.release();
  }
}

export default function SimilarProtoScreen() {
  const { monthId } = useLocalSearchParams<{ monthId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // 跟首頁月份同一批：未整理的照片（不含影片），時間舊到新
  const photos = useMemo(() => {
    const { assets, organizedIds } = getLibrarySnapshot();
    return assets
      .filter(
        (a) =>
          a.mediaType === "photo" &&
          !organizedIds.has(a.id) &&
          monthKey(a.creationTime) === monthId,
      )
      .reverse();
  }, [monthId]);
  const uriById = useMemo(
    () => new Map(photos.map((p) => [p.id, p.uri])),
    [photos],
  );

  const [hashed, setHashed] = useState<HashedItem[]>([]);
  const [failures, setFailures] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [threshold, setThreshold] = useState(8);
  const [gapMs, setGapMs] = useState(Infinity);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const results: (HashedItem | null)[] = new Array(photos.length).fill(null);
    const errs: string[] = [];
    const start = Date.now();
    let next = 0;
    let finished = 0;
    const flush = () => {
      setHashed(results.filter((r): r is HashedItem => r !== null));
      setFailures([...errs]);
      setElapsed(Date.now() - start);
    };
    const worker = async () => {
      while (!cancelled.current && next < photos.length) {
        const i = next++;
        const p = photos[i];
        try {
          results[i] = {
            id: p.id,
            time: p.creationTime,
            hash: await hashAsset(p.uri),
          };
        } catch (e) {
          errs.push(`${p.filename}: ${(e as Error).message}`);
        }
        if (++finished % 20 === 0) flush();
      }
    };
    Promise.all(Array.from({ length: CONCURRENCY }, worker)).then(() => {
      if (cancelled.current) return;
      flush();
      setDone(true);
    });
    return () => {
      cancelled.current = true;
    };
  }, [photos]);

  const groups = useMemo(
    () => (done ? groupSimilar(hashed, threshold, gapMs) : []),
    [done, hashed, threshold, gapMs],
  );
  const burstIds = useMemo(
    () => new Set(findBursts(photos).flat()),
    [photos],
  );
  const inGroups = groups.reduce((n, g) => n + g.length, 0);
  // 整組都已經是連拍＝連拍分組本來就抓得到，不算 dHash 的新收穫
  const newGroups = groups.filter((g) => g.some((id) => !burstIds.has(id)));
  const processed = hashed.length + failures.length;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <ThemedText style={styles.back}>‹ 返回</ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.title}>相似分組原型 {monthId}</ThemedText>
      </View>

      <View style={styles.stats}>
        <ThemedText style={styles.stat}>
          {done ? "完成" : "計算中"} {processed}/{photos.length} 張・
          {(elapsed / 1000).toFixed(1)} 秒・
          {processed ? Math.round(elapsed / processed) : 0} ms/張
          {failures.length > 0 && `・失敗 ${failures.length}`}
        </ThemedText>
        {done && (
          <ThemedText style={styles.stat}>
            {groups.length} 組 / {inGroups} 張・非連拍的組 {newGroups.length}
          </ThemedText>
        )}
        {failures.slice(0, 3).map((f) => (
          <ThemedText key={f} style={styles.error} numberOfLines={1}>
            {f}
          </ThemedText>
        ))}
      </View>

      <ChipRow
        items={THRESHOLDS.map((t) => ({ label: `≤${t}`, value: t }))}
        selected={threshold}
        onSelect={setThreshold}
      />
      <ChipRow
        items={GAPS.map((g) => ({ label: g.label, value: g.ms }))}
        selected={gapMs}
        onSelect={setGapMs}
      />

      <FlatList
        data={groups}
        keyExtractor={(g) => g[0]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        renderItem={({ item, index }) => {
          const isBurst = item.every((id) => burstIds.has(id));
          return (
            <View style={styles.group}>
              <ThemedText style={styles.groupLabel}>
                #{index + 1}・{item.length} 張{isBurst ? "・連拍" : ""}
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {item.map((id) => (
                  <Image
                    key={id}
                    source={{ uri: uriById.get(id) }}
                    style={styles.thumb}
                    contentFit="cover"
                    recyclingKey={id}
                  />
                ))}
              </ScrollView>
            </View>
          );
        }}
      />
    </View>
  );
}

function ChipRow<T>({
  items,
  selected,
  onSelect,
}: {
  items: { label: string; value: T }[];
  selected: T;
  onSelect: (v: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {items.map((it) => (
        <TouchableOpacity
          key={it.label}
          style={[styles.chip, it.value === selected && styles.chipActive]}
          onPress={() => onSelect(it.value)}
        >
          <ThemedText
            style={[
              styles.chipText,
              it.value === selected && styles.chipTextActive,
            ]}
          >
            {it.label}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  back: { color: Colors.textSecondary, fontSize: 16 },
  title: { color: Colors.text, fontSize: 17, fontWeight: "600" },
  stats: { paddingHorizontal: 16, gap: 2, marginBottom: 8 },
  stat: { color: Colors.text, fontSize: 14, fontFamily: Fonts.number },
  error: { color: Colors.danger, fontSize: 12 },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: Colors.surfaceRaised,
  },
  chipActive: { backgroundColor: Colors.accent },
  chipText: { color: Colors.textSecondary, fontSize: 13 },
  chipTextActive: { color: Colors.onKeep },
  group: { paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  groupLabel: { color: Colors.textSecondary, fontSize: 13 },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: 4,
    marginRight: 4,
    backgroundColor: Colors.surface,
  },
});
