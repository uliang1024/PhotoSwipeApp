import { CategoryItem } from "@/components/CategoryItem";
import { FloatingTabBar } from "@/components/FloatingTabBar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import { useFocusEffect, useRouter } from "expo-router"; // 1. 引入 useFocusEffect
import React, { useCallback, useState } from "react"; // 2. 引入 useCallback
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

interface MonthStats {
  title: string;
  count: number;
  color: string;
  monthId: string;
}

export default function OrganizeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    weekly: 0,
    video: 0,
    screenshot: 0,
    unorganized: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthStats[]>([]);

  // 3. 使用 useFocusEffect 確保每次回到此頁面都會刷新
  useFocusEffect(
    useCallback(() => {
      analyzePhotoLibrary();
    }, []),
  );

  const analyzePhotoLibrary = async () => {
    // 為了使用者體驗，只有第一次載入顯示大菊花(Loading)，後續刷新在背景靜默執行
    if (monthlyData.length === 0) setLoading(true);

    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") return;

    // --- 邏輯保持不變 ---
    const albums = await MediaLibrary.getAlbumsAsync();
    const organizedAlbum = albums.find((a) => a.title === "已整理");

    let organizedAssetIds = new Set();
    if (organizedAlbum) {
      const organizedAssets = await MediaLibrary.getAssetsAsync({
        album: organizedAlbum.id,
        first: 10000,
      });
      organizedAssetIds = new Set(organizedAssets.assets.map((a) => a.id));
    }

    const allAssets = await MediaLibrary.getAssetsAsync({
      mediaType: ["photo", "video"],
      first: 10000,
    });

    const unorganizedAssets = allAssets.assets.filter(
      (asset) => !organizedAssetIds.has(asset.id),
    );

    const monthsMap: { [key: string]: number } = {};
    let videoCount = 0;
    const now = new Date();
    const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    let weeklyCount = 0;

    unorganizedAssets.forEach((asset) => {
      if (asset.mediaType === "video") videoCount++;
      if (asset.creationTime > oneWeekAgo) weeklyCount++;
      const date = new Date(asset.creationTime);
      const key = `${date.getFullYear()}年 ${date.getMonth() + 1}月`;
      monthsMap[key] = (monthsMap[key] || 0) + 1;
    });

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
      video: videoCount,
      screenshot: 0,
      unorganized: unorganizedAssets.length,
    });
    setMonthlyData(formattedMonths);
    setLoading(false);
  };

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
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
        {/* ... 中間的 TopTabs, RecentGrid 保持不變 ... */}
        <View style={styles.topTabs}>
          <TouchableOpacity style={styles.topTabActive}>
            <ThemedText style={styles.topTabTextActive}>未分類</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.topTabInactive}>
            <ThemedText style={styles.topTabTextInactive}>相冊</ThemedText>
          </TouchableOpacity>
        </View>
        <ThemedText style={styles.sectionTitle}>最近</ThemedText>
        <View style={styles.recentGrid}>
          <View style={[styles.recentCard, { backgroundColor: "#3A3A3C" }]}>
            <ThemedText style={styles.recentCardText}>這一天</ThemedText>
          </View>
          <View style={[styles.recentCard, { backgroundColor: "#3A3A3C" }]}>
            <ThemedText style={styles.recentCardText}>去年</ThemedText>
          </View>
        </View>
        <TouchableOpacity
          style={styles.weeklyBanner}
          onPress={() => {
            router.push({
              pathname: "/swipe",
              params: { title: `本週 (${stats.weekly})`, type: "weekly" },
            });
          }}
        >
          <ThemedText style={styles.bannerText}>
            本週 ({stats.weekly} 張)
          </ThemedText>
        </TouchableOpacity>
        <View style={styles.listContainer}>
          <CategoryItem
            title="所有未整理"
            count={stats.unorganized}
            color="#3A3A3C"
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
            onPress={() =>
              router.push({
                pathname: "/swipe",
                params: { title: "未整理的影片", type: "unorganized_video" },
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
              onPress={() => {
                router.push({
                  pathname: "/swipe",
                  params: { title: item.title, type: "month" }, // 明確帶入 type: month
                });
              }}
            />
          ))}
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>

      <FloatingTabBar />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  // ... 延用你原本的 styles ...
  container: { flex: 1, backgroundColor: "#000" },
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
  recentGrid: { flexDirection: "row", gap: 15, marginBottom: 15 },
  recentCard: {
    flex: 1,
    height: 100,
    borderRadius: 15,
    justifyContent: "flex-end",
    padding: 12,
  },
  recentCardText: { color: "#fff", fontWeight: "600" },
  weeklyBanner: {
    backgroundColor: "#2C2C2E",
    height: 200,
    borderRadius: 20,
    justifyContent: "flex-end",
    padding: 20,
    marginBottom: 20,
  },
  bannerText: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  listContainer: { marginBottom: 10 },
  monthlyContainer: { marginTop: 10 },
});
