import { CategoryItem } from "@/components/CategoryItem";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { refreshLibrary, useLibrary } from "@/lib/library-store";
import {
  isWithinLastWeek,
  monthKey,
  monthLabel,
  ORGANIZED_ALBUM_TITLE,
} from "@/lib/media";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, MonthColors } from "@/constants/theme";

interface MonthStats {
  title: string;
  count: number;
  color: string;
  monthId: string;
}

function computeStats(
  assets: MediaLibrary.Asset[],
  organizedIds: Set<string>,
  screenshotIds: Set<string>,
) {
  const monthsMap: Record<string, number> = {};
  let unorganized = 0;
  let video = 0;
  let screenshot = 0;
  let weekly = 0;
  let weeklyFirstPhoto: string | null = null;

  // assets 是新到舊，倒著走訪讓本週封面取本週最早的一張照片
  for (let i = assets.length - 1; i >= 0; i--) {
    const asset = assets[i];
    if (organizedIds.has(asset.id)) continue;
    unorganized++;
    if (asset.mediaType === "video") video++;
    if (screenshotIds.has(asset.id)) screenshot++;
    if (isWithinLastWeek(asset.creationTime)) {
      weekly++;
      if (!weeklyFirstPhoto && asset.mediaType === "photo") {
        weeklyFirstPhoto = asset.uri;
      }
    }
    const key = monthKey(asset.creationTime);
    monthsMap[key] = (monthsMap[key] || 0) + 1;
  }

  const monthlyData: MonthStats[] = Object.keys(monthsMap)
    .sort((a, b) => b.localeCompare(a))
    .map((key, index) => ({
      title: monthLabel(key),
      count: monthsMap[key],
      color: MonthColors[index % MonthColors.length],
      monthId: key,
    }));

  return {
    stats: { weekly, video, screenshot, unorganized, weeklyFirstPhoto },
    monthlyData,
  };
}

export default function OrganizeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const library = useLibrary();
  const [activeTab, setActiveTab] = useState<"unclassified" | "albums">(
    "unclassified",
  ); // Tab 狀態

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
          <ThemedText style={styles.topTabTextActive}>重試</ThemedText>
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
          <ThemedText style={styles.topTabTextActive}>前往設定</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16 },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.headerTitle}>
            整理
          </ThemedText>
          <TouchableOpacity
            style={styles.infoBtn}
            onPress={() => refreshLibrary({ force: true })}
          >
            <Ionicons name="refresh-circle-outline" size={28} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Tab Switcher */}
        <View style={styles.topTabs}>
          <TouchableOpacity
            style={
              activeTab === "unclassified"
                ? styles.topTabActive
                : styles.topTabInactive
            }
            onPress={() => setActiveTab("unclassified")}
          >
            <ThemedText
              style={
                activeTab === "unclassified"
                  ? styles.topTabTextActive
                  : styles.topTabTextInactive
              }
            >
              未分類
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={
              activeTab === "albums"
                ? styles.topTabActive
                : styles.topTabInactive
            }
            onPress={() => setActiveTab("albums")}
          >
            <ThemedText
              style={
                activeTab === "albums"
                  ? styles.topTabTextActive
                  : styles.topTabTextInactive
              }
            >
              相冊
            </ThemedText>
          </TouchableOpacity>
        </View>

        {activeTab === "unclassified" ? (
          /* 未分類內容 */
          <>
            <ThemedText style={styles.sectionTitle}>最近</ThemedText>
            <TouchableOpacity
              style={styles.weeklyBanner}
              activeOpacity={0.9}
              onPress={() =>
                router.push({
                  pathname: "/swipe",
                  params: { title: `本週`, type: "weekly" },
                })
              }
            >
              {stats.weeklyFirstPhoto ? (
                <Image
                  source={{ uri: stats.weeklyFirstPhoto }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: Colors.surfaceRaised },
                  ]}
                />
              )}
              <View style={styles.bannerOverlay}>
                <ThemedText style={styles.bannerText}>
                  本週 ({stats.weekly} 張)
                </ThemedText>
              </View>
            </TouchableOpacity>

            <View style={styles.listContainer}>
              <CategoryItem
                title="所有未整理"
                count={stats.unorganized}
                color={Colors.surfaceMuted}
                isSmall
                onPress={() =>
                  router.push({
                    pathname: "/swipe",
                    params: { title: "所有未整理", type: "unorganized" },
                  })
                }
              />
              <CategoryItem
                title="未整理的影片"
                count={stats.video}
                color={Colors.surfaceMuted}
                isSmall
                onPress={() =>
                  router.push({
                    pathname: "/swipe",
                    params: {
                      title: "未整理的影片",
                      type: "unorganized_video",
                    },
                  })
                }
              />
              <CategoryItem
                title="未整理的截圖"
                count={stats.screenshot}
                color={Colors.surfaceMuted}
                isSmall
                onPress={() =>
                  router.push({
                    pathname: "/swipe",
                    params: {
                      title: "未整理的截圖",
                      type: "unorganized_screenshot",
                    },
                  })
                }
              />
            </View>

            <View style={styles.monthlyContainer}>
              <ThemedText style={[styles.sectionTitle, { marginTop: 10 }]}>
                按月份
              </ThemedText>
              {monthlyData.map((item, index) => (
                <CategoryItem
                  key={item.monthId}
                  title={item.title}
                  count={item.count}
                  color={item.color}
                  isSmall
                  onPress={() =>
                    router.push({
                      pathname: "/swipe",
                      params: {
                        title: item.title,
                        type: "month",
                        monthId: item.monthId,
                      },
                    })
                  }
                />
              ))}
            </View>
          </>
        ) : (
          /* 相冊內容 (如圖顯示) */
          <View style={styles.listContainer}>
            {allAlbums.map((album) => (
              <CategoryItem
                key={album.id}
                title={album.title}
                count={album.assetCount}
                color={Colors.surfaceRaised}
                isSmall
                onPress={() => {
                  // 跳轉至滑動頁面，並帶入相簿 ID
                  router.push({
                    pathname: "/swipe",
                    params: {
                      title: album.title,
                      type: "album", // 新增一個 album 類型
                      albumId: album.id, // 傳入相簿 ID
                    },
                  });
                }}
              />
            ))}
          </View>
        )}
        <View style={{ height: insets.bottom + 20 }} />
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
  scrollContent: { paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: { fontSize: 32, fontWeight: "bold", color: Colors.text },
  infoBtn: { padding: 5 },
  topTabs: { flexDirection: "row", marginBottom: 25 },
  topTabActive: {
    backgroundColor: Colors.inverse,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginRight: 10,
  },
  topTabInactive: {
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  topTabTextActive: { color: Colors.onInverse, fontWeight: "bold" },
  topTabTextInactive: { color: Colors.textSecondary },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: Colors.text,
    marginBottom: 15,
  },
  weeklyBanner: {
    height: 200,
    borderRadius: 20,
    overflow: "hidden", // 確保圖片不超出圓角
    marginBottom: 20,
    backgroundColor: Colors.surface,
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.scrimLight, // 圖片遮罩
    justifyContent: "flex-end",
    padding: 20,
  },
  bannerText: { color: Colors.text, fontSize: 20, fontWeight: "bold" },
  listContainer: {
    width: "100%",
    marginBottom: 10,
  },
  monthlyContainer: { marginTop: 10 },
});
