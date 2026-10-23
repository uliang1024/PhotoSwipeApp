import { CategoryItem } from "@/components/CategoryItem";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  fetchAllAssets,
  getOrganizedAssetIds,
  isWithinLastWeek,
  monthKey,
  monthLabel,
  ORGANIZED_ALBUM_TITLE,
} from "@/lib/media";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface MonthStats {
  title: string;
  count: number;
  color: string;
  monthId: string;
}

const MONTH_COLORS = [
  "#A1CEDC",
  "#9ED5B2",
  "#F3E5AB",
  "#D2B48C",
  "#E8A1A2",
  "#B39EB5",
];

export default function OrganizeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [activeTab, setActiveTab] = useState<"unclassified" | "albums">(
    "unclassified",
  ); // Tab 狀態
  const [stats, setStats] = useState({
    weekly: 0,
    video: 0,
    unorganized: 0,
    weeklyFirstPhoto: null as string | null,
  });
  const [monthlyData, setMonthlyData] = useState<MonthStats[]>([]);
  const [allAlbums, setAllAlbums] = useState<MediaLibrary.Album[]>([]); // 儲存所有相簿

  const analyzePhotoLibrary = useCallback(async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      setPermissionDenied(true);
      setLoading(false);
      return;
    }
    setPermissionDenied(false);

    try {
      const albums = await MediaLibrary.getAlbumsAsync({
        includeSmartAlbums: true,
      });
      setAllAlbums(
        albums
          .filter((a) => a.title !== ORGANIZED_ALBUM_TITLE)
          .sort((a, b) => b.assetCount - a.assetCount),
      );

      const [organizedIds, allAssets] = await Promise.all([
        getOrganizedAssetIds(),
        fetchAllAssets({ sortBy: ["creationTime"] }),
      ]);
      const unorganizedAssets = allAssets.filter(
        (asset) => !organizedIds.has(asset.id),
      );

      const monthsMap: Record<string, number> = {};
      let videoCount = 0;
      let weeklyCount = 0;
      let weeklyPhoto: string | null = null;

      // 由舊到新走訪，本週封面取本週最早的一張照片
      for (let i = unorganizedAssets.length - 1; i >= 0; i--) {
        const asset = unorganizedAssets[i];
        if (asset.mediaType === "video") videoCount++;
        if (isWithinLastWeek(asset.creationTime)) {
          weeklyCount++;
          if (!weeklyPhoto && asset.mediaType === "photo") {
            weeklyPhoto = asset.uri;
          }
        }
        const key = monthKey(asset.creationTime);
        monthsMap[key] = (monthsMap[key] || 0) + 1;
      }

      const formattedMonths = Object.keys(monthsMap)
        .sort((a, b) => b.localeCompare(a))
        .map((key, index) => ({
          title: monthLabel(key),
          count: monthsMap[key],
          color: MONTH_COLORS[index % MONTH_COLORS.length],
          monthId: key,
        }));

      setStats({
        weekly: weeklyCount,
        video: videoCount,
        unorganized: unorganizedAssets.length,
        weeklyFirstPhoto: weeklyPhoto,
      });
      setMonthlyData(formattedMonths);
    } catch (error) {
      console.error("分析相簿失敗:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      analyzePhotoLibrary();
    }, [analyzePhotoLibrary]),
  );

  if (loading)
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color="#fff" />
      </ThemedView>
    );

  if (permissionDenied)
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
            onPress={analyzePhotoLibrary}
          >
            <Ionicons name="refresh-circle-outline" size={28} color="#fff" />
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
                    { backgroundColor: "#2C2C2E" },
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
                color="#3A3A3C"
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
                color="#3A3A3C"
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
                color="#2C2C2E"
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
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  permissionText: { color: "#fff", marginBottom: 16 },
  permissionBtn: {
    backgroundColor: "#fff",
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
  headerTitle: { fontSize: 32, fontWeight: "bold", color: "#fff" },
  infoBtn: { padding: 5 },
  topTabs: { flexDirection: "row", marginBottom: 25 },
  topTabActive: {
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginRight: 10,
  },
  topTabInactive: {
    backgroundColor: "#1C1C1E",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  topTabTextActive: { color: "#000", fontWeight: "bold" },
  topTabTextInactive: { color: "#8E8E93" },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 15,
  },
  weeklyBanner: {
    height: 200,
    borderRadius: 20,
    overflow: "hidden", // 確保圖片不超出圓角
    marginBottom: 20,
    backgroundColor: "#1C1C1E",
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)", // 圖片遮罩
    justifyContent: "flex-end",
    padding: 20,
  },
  bannerText: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  listContainer: {
    width: "100%",
    marginBottom: 10,
  },
  monthlyContainer: { marginTop: 10 },
});
