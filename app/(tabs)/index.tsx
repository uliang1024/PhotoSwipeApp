import { CategoryItem } from "@/components/CategoryItem";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { useFocusEffect, useRouter } from "expo-router"; // 1. 引入 useFocusEffect
import React, { useCallback, useState } from "react"; // 2. 引入 useCallback
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

interface MonthStats {
  title: string;
  count: number;
  color: string;
  monthId: string;
}

export default function OrganizeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"unclassified" | "albums">(
    "unclassified",
  ); // Tab 狀態
  const [stats, setStats] = useState({
    weekly: 0,
    video: 0,
    screenshot: 0,
    unorganized: 0,
    weeklyFirstPhoto: null as string | null,
  });
  const [monthlyData, setMonthlyData] = useState<MonthStats[]>([]);
  const [allAlbums, setAllAlbums] = useState<MediaLibrary.Album[]>([]); // 儲存所有相簿
  useFocusEffect(
    useCallback(() => {
      analyzePhotoLibrary();
    }, []),
  );

  const analyzePhotoLibrary = async () => {
    if (monthlyData.length === 0) setLoading(true);
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") return;

    // 1. 取得所有相簿
    const albums = await MediaLibrary.getAlbumsAsync({
      includeSmartAlbums: true,
    });
    const filteredAlbums = albums.filter((a) => a.title !== "已整理");
    setAllAlbums(filteredAlbums.sort((a, b) => b.assetCount - a.assetCount));

    // 2. 找出「已整理」相簿並抓取 *所有* ID (包括照片和影片)
    const organizedAlbum = albums.find((a) => a.title === "已整理");
    let organizedAssetIds = new Set();

    if (organizedAlbum) {
      const organizedAssets = await MediaLibrary.getAssetsAsync({
        album: organizedAlbum.id,
        first: 20000,
        mediaType: ["photo", "video"], // 【核心修正 1】：確保抓取已整理相簿時，也包含影片 ID
      });
      organizedAssetIds = new Set(organizedAssets.assets.map((a) => a.id));
    }

    // 抓取所有內容時也要確保包含兩者
    const allAssets = await MediaLibrary.getAssetsAsync({
      mediaType: ["photo", "video"],
      first: 10000,
      sortBy: ["creationTime"],
    });

    // 【核心修正 2】：產生過濾清單
    const unorganizedAssets = allAssets.assets.filter(
      (asset) => !organizedAssetIds.has(asset.id),
    );

    const monthsMap: { [key: string]: number } = {};
    let videoCount = 0;
    const now = new Date();
    const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    let weeklyCount = 0;
    let weeklyPhoto: string | null = null;

    // 使用已經排除掉「已整理」的清單來進行統計
    [...unorganizedAssets].reverse().forEach((asset) => {
      // 統計未整理的影片 (現在這裡會正確排除已整理的影片了)
      if (asset.mediaType === "video") {
        videoCount++;
      }

      // 統計本週
      if (asset.creationTime > oneWeekAgo) {
        weeklyCount++;
        if (!weeklyPhoto && asset.mediaType === "photo") {
          weeklyPhoto = asset.uri;
        }
      }

      // 統計月份
      const date = new Date(asset.creationTime);
      const key = `${date.getFullYear()}年 ${date.getMonth() + 1}月`;
      monthsMap[key] = (monthsMap[key] || 0) + 1;
    });

    // ... 後續設定 State 的邏輯保持不變 ...
    const colors = [
      "#A1CEDC",
      "#9ED5B2",
      "#F3E5AB",
      "#D2B48C",
      "#E8A1A2",
      "#B39EB5",
    ];
    const formattedMonths = Object.keys(monthsMap)
      .map((key, index) => ({
        title: key,
        count: monthsMap[key],
        color: colors[index % colors.length],
        monthId: key,
      }))
      .sort((a, b) => b.title.localeCompare(a.title));

    setStats({
      weekly: weeklyCount,
      video: videoCount, // 這是修正後的正確數字
      screenshot: 0,
      unorganized: unorganizedAssets.length,
      weeklyFirstPhoto: weeklyPhoto,
    });
    setMonthlyData(formattedMonths);
    setLoading(false);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
                  key={index}
                  title={item.title}
                  count={item.count}
                  color={item.color}
                  isSmall
                  onPress={() =>
                    router.push({
                      pathname: "/swipe",
                      params: { title: item.title, type: "month" },
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
        <View style={{ height: 120 }} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  containerSmall: {
    paddingVertical: 10, // 變矮
    borderRadius: 10,
    marginBottom: 4, // 變窄
  },
  leftContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  dotSmall: {
    width: 6,
    height: 6,
    marginRight: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
    color: "#fff",
  },
  titleSmall: {
    fontSize: 14, // 字變小
  },
  rightContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  count: {
    fontSize: 16,
    color: "#8E8E93",
    marginRight: 8,
  },
  countSmall: {
    fontSize: 14, // 數字變小
    marginRight: 6,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 60 },
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
  recentGrid: { flexDirection: "row", gap: 15, marginBottom: 15 },
  recentCard: {
    flex: 1,
    height: 100,
    borderRadius: 15,
    justifyContent: "flex-end",
    padding: 12,
  },
  recentCardText: { color: "#fff", fontWeight: "600" },
});
