import { CategoryItem } from "@/components/CategoryItem";
import { FilmStrip } from "@/components/FilmStrip";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { refreshLibrary, useLibrary } from "@/lib/library-store";
import {
  findBursts,
  isWithinLastWeek,
  monthKey,
  ORGANIZED_ALBUM_TITLE,
} from "@/lib/media";
import * as MediaLibrary from "expo-media-library";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Fonts } from "@/constants/theme";

const FRAMES = 4;
const H_PADDING = 20;
// 底片格 3:2，扣掉底片帶左右邊與格距
const FRAME_HEIGHT =
  ((Dimensions.get("window").width - H_PADDING * 2 - 8 - 3 * (FRAMES - 1)) /
    FRAMES) *
  (2 / 3);

interface MonthStats {
  count: number;
  monthId: string;
  uris: string[];
}

function computeStats(
  assets: MediaLibrary.Asset[],
  organizedIds: Set<string>,
  screenshotIds: Set<string>,
) {
  const monthsMap: Record<string, MonthStats> = {};
  let unorganized = 0;
  let video = 0;
  let screenshot = 0;
  let weekly = 0;
  const weeklyUris: string[] = [];
  const unorganizedAssets: MediaLibrary.Asset[] = [];

  // assets 是新到舊，倒著走訪讓縮圖照時間順序排（像一卷底片）
  for (let i = assets.length - 1; i >= 0; i--) {
    const asset = assets[i];
    if (organizedIds.has(asset.id)) continue;
    unorganized++;
    unorganizedAssets.push(asset);
    const isPhoto = asset.mediaType === "photo";
    if (asset.mediaType === "video") video++;
    if (screenshotIds.has(asset.id)) screenshot++;
    if (isWithinLastWeek(asset.creationTime)) {
      weekly++;
      if (isPhoto && weeklyUris.length < FRAMES) weeklyUris.push(asset.uri);
    }
    const key = monthKey(asset.creationTime);
    const month = (monthsMap[key] ??= { count: 0, monthId: key, uris: [] });
    month.count++;
    if (isPhoto && month.uris.length < FRAMES) month.uris.push(asset.uri);
  }

  const monthlyData = Object.values(monthsMap).sort((a, b) =>
    b.monthId.localeCompare(a.monthId),
  );

  return {
    stats: {
      weekly,
      video,
      screenshot,
      unorganized,
      weeklyUris,
      burst: findBursts(unorganizedAssets).flat().length,
      organized: assets.length - unorganized,
      total: assets.length,
    },
    monthlyData,
  };
}

export default function OrganizeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const library = useLibrary();
  const [activeTab, setActiveTab] = useState<"unclassified" | "albums">(
    "unclassified",
  );
  const [refreshing, setRefreshing] = useState(false);

  const { stats, monthlyData } = useMemo(
    () =>
      computeStats(
        library.assets,
        library.organizedIds,
        library.screenshotIds,
      ),
    [library.assets, library.organizedIds, library.screenshotIds],
  );
  const allAlbums = useMemo(
    () =>
      library.albums
        .filter((a) => a.title !== ORGANIZED_ALBUM_TITLE)
        .sort((a, b) => b.assetCount - a.assetCount),
    [library.albums],
  );

  // 有快取就直接顯示，只有快取過期時才在背景重掃
  useFocusEffect(
    useCallback(() => {
      refreshLibrary();
    }, []),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshLibrary({ force: true });
    setRefreshing(false);
  };

  const openSwipe = (params: Record<string, string>) =>
    router.push({ pathname: "/swipe", params });

  if (library.status === "idle" || library.status === "loading")
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={Colors.text} />
      </ThemedView>
    );

  if (library.status === "error")
    return (
      <ThemedView style={styles.center}>
        <ThemedText style={styles.permissionText}>載入相簿失敗</ThemedText>
        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={() => refreshLibrary({ force: true })}
        >
          <ThemedText style={styles.permissionBtnText}>重試</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );

  if (library.status === "denied")
    return (
      <ThemedView style={styles.center}>
        <ThemedText style={styles.permissionText}>
          需要相簿權限才能整理照片
        </ThemedText>
        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={() => Linking.openSettings()}
        >
          <ThemedText style={styles.permissionBtnText}>前往設定</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );

  const shortcuts = [
    { title: "全部未整理", count: stats.unorganized, type: "unorganized" },
    { title: "影片", count: stats.video, type: "unorganized_video" },
    { title: "截圖", count: stats.screenshot, type: "unorganized_screenshot" },
    { title: "連拍", count: stats.burst, type: "burst" },
  ];
  const tabs = [
    { key: "unclassified", label: "未分類" },
    { key: "albums", label: "相冊" },
  ] as const;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.textSecondary}
          />
        }
      >
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>整理</ThemedText>
          <View style={styles.tabs}>
            {tabs.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={styles.tab}
                onPress={() => setActiveTab(key)}
              >
                <ThemedText
                  style={[
                    styles.tabText,
                    activeTab === key && styles.tabTextActive,
                  ]}
                >
                  {label}
                </ThemedText>
                <View
                  style={[
                    styles.tabMark,
                    activeTab === key && styles.tabMarkActive,
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {activeTab === "unclassified" ? (
          <>
            <View style={styles.progress}>
              <ThemedText style={styles.progressText}>
                已整理 {stats.organized.toLocaleString()} /{" "}
                {stats.total.toLocaleString()}
              </ThemedText>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${stats.total ? (stats.organized / stats.total) * 100 : 0}%`,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.shortcuts}>
              {shortcuts.map((s) => (
                <TouchableOpacity
                  key={s.type}
                  style={styles.shortcut}
                  activeOpacity={0.7}
                  onPress={() => openSwipe({ title: s.title, type: s.type })}
                >
                  <ThemedText style={styles.shortcutCount}>
                    {s.count.toLocaleString()}
                  </ThemedText>
                  <ThemedText style={styles.shortcutLabel}>{s.title}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            {stats.weekly > 0 && (
              <TouchableOpacity
                style={styles.roll}
                activeOpacity={0.8}
                onPress={() => openSwipe({ title: "本週", type: "weekly" })}
              >
                <View style={styles.rollLabel}>
                  <ThemedText style={styles.rollTitle}>本週</ThemedText>
                  <ThemedText style={styles.rollCount}>
                    {stats.weekly.toLocaleString()}
                  </ThemedText>
                </View>
                <FilmStrip
                  uris={stats.weeklyUris}
                  frames={FRAMES}
                  frameHeight={FRAME_HEIGHT}
                />
              </TouchableOpacity>
            )}

            {monthlyData.length === 0 && (
              <ThemedText style={styles.emptyText}>
                照片都整理完了，有新照片會出現在這裡。
              </ThemedText>
            )}
            {monthlyData.map((item) => {
              // 底片日期印格式：2026.10
              const title = item.monthId.replace("-", ".");
              return (
                <TouchableOpacity
                  key={item.monthId}
                  style={styles.roll}
                  activeOpacity={0.8}
                  onPress={() =>
                    openSwipe({ title, type: "month", monthId: item.monthId })
                  }
                >
                  <View style={styles.rollLabel}>
                    <ThemedText style={styles.rollDate}>{title}</ThemedText>
                    <ThemedText style={styles.rollCount}>
                      {item.count.toLocaleString()}
                    </ThemedText>
                  </View>
                  <FilmStrip
                    uris={item.uris}
                    frames={FRAMES}
                    frameHeight={FRAME_HEIGHT}
                  />
                </TouchableOpacity>
              );
            })}
          </>
        ) : (
          <View>
            {allAlbums.map((album) => (
              <CategoryItem
                key={album.id}
                title={album.title}
                count={album.assetCount}
                onPress={() =>
                  openSwipe({
                    title: album.title,
                    type: "album",
                    albumId: album.id,
                  })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  permissionText: { color: Colors.text, marginBottom: 16 },
  permissionBtn: {
    backgroundColor: Colors.inverse,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  permissionBtnText: { color: Colors.onInverse, fontWeight: "bold" },
  scrollContent: { paddingHorizontal: H_PADDING },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "bold",
    color: Colors.text,
  },
  tabs: { flexDirection: "row", gap: 18 },
  tab: { alignItems: "center", paddingTop: 6 },
  tabText: { fontSize: 15, color: Colors.textSecondary },
  tabTextActive: { color: Colors.text, fontWeight: "600" },
  tabMark: { height: 2, width: 16, marginTop: 4, borderRadius: 1 },
  tabMarkActive: { backgroundColor: Colors.accent },
  progress: { marginBottom: 16 },
  progressText: {
    fontFamily: Fonts.number,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  progressTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.surfaceRaised,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: Colors.accent },
  shortcuts: { flexDirection: "row", gap: 8, marginBottom: 28 },
  shortcut: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  shortcutCount: {
    fontFamily: Fonts.numberBold,
    fontSize: 28,
    lineHeight: 32,
    color: Colors.text,
  },
  shortcutLabel: { fontSize: 13, color: Colors.textSecondary },
  roll: { marginBottom: 22 },
  rollLabel: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 6,
  },
  rollTitle: { fontSize: 17, fontWeight: "600", color: Colors.text },
  // 底片日期印的琥珀色
  rollDate: {
    fontFamily: Fonts.numberBold,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 1,
    color: Colors.accent,
  },
  rollCount: {
    fontFamily: Fonts.number,
    fontSize: 20,
    lineHeight: 24,
    color: Colors.textSecondary,
  },
  emptyText: {
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 40,
  },
});
