import { PhotoGridModal } from "@/components/PhotoGridModal";
import { TrashModal } from "@/components/TrashModal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

// 動畫與手勢庫
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const TOP_HEIGHT = 120;
const BOTTOM_HEIGHT = 100;
const MIDDLE_HEIGHT = SCREEN_HEIGHT - TOP_HEIGHT - BOTTOM_HEIGHT;
const VideoCard = ({ uri, isActive }: { uri: string; isActive: boolean }) => {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = true;
    player.muted = true; // 通常滑動預覽建議靜音
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  return (
    <VideoView
      player={player}
      style={styles.image} // 沿用圖片樣式
      contentFit="contain"
    />
  );
};

// --- 子組件：SwipeableCard ---
const SwipeableCard = ({
  item,
  onSwipeUp,
  isActive,
}: {
  item: MediaLibrary.Asset;
  onSwipeUp: (id: string) => void;
  isActive: boolean;
}) => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const gesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onUpdate((event) => {
      if (event.translationY < 0) translateY.value = event.translationY;
    })
    .onEnd((event) => {
      if (event.translationY < -120 || event.velocityY < -500) {
        translateY.value = withTiming(-SCREEN_HEIGHT, { duration: 250 }, () => {
          runOnJS(onSwipeUp)(item.id);
        });
        opacity.value = withTiming(0, { duration: 200 });
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        translateY.value = withSpring(0, { damping: 15 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateY.value,
      [0, -200],
      [0, 8],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      translateY.value,
      [0, -200],
      [1, 0.85],
      Extrapolation.CLAMP,
    );
    const translateX = interpolate(
      translateY.value,
      [0, -200],
      [0, 50],
      Extrapolation.CLAMP,
    );

    return {
      transform: [
        { translateY: translateY.value },
        { translateX: translateX },
        { scale: scale },
        { rotate: `${rotate}deg` },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, animatedStyle]}>
        {/* 判斷類型顯示圖片或影片 */}
        {item.mediaType === "video" ? (
          <VideoCard uri={item.uri} isActive={isActive} />
        ) : (
          <Image
            source={{ uri: item.uri }}
            style={styles.image}
            contentFit="contain"
          />
        )}
      </Animated.View>
    </GestureDetector>
  );
};

// --- 主螢幕 ---
export default function SwipeScreen() {
  const router = useRouter();
  const { title, type, albumId } = useLocalSearchParams(); // 接收 albumId
  const [photos, setPhotos] = useState<MediaLibrary.Asset[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]); // 待刪除暫存區
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTrashVisible, setIsTrashVisible] = useState(false);
  const [pendingDeleteAssets, setPendingDeleteAssets] = useState<
    MediaLibrary.Asset[]
  >([]);
  const flatListRef = React.useRef<FlatList>(null); // 用於控制跳轉
  const [isGridVisible, setIsGridVisible] = useState(false);
  // 1. 箭頭旋轉與視窗下推的 SharedValue
  const gridExpansion = useSharedValue(0);
  // 2. 切換網格視窗的函數
  const toggleGrid = () => {
    if (isGridVisible) {
      // 縮回
      gridExpansion.value = withTiming(0, { duration: 300 });
      setTimeout(() => setIsGridVisible(false), 300); // 動畫完再隱藏
    } else {
      // 展開
      setIsGridVisible(true);
      gridExpansion.value = withTiming(1, { duration: 300 });
    }
  };
  // 3. 箭頭旋轉樣式 (0度 -> 180度)
  const arrowStyle = useAnimatedStyle(() => {
    const rotate = interpolate(gridExpansion.value, [0, 1], [0, 180]);
    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });
  // 4. 網格視窗下推樣式 (從螢幕上方 -100% 移到 0)
  const gridModalStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      gridExpansion.value,
      [0, 1],
      [-SCREEN_HEIGHT, 0],
    );
    return {
      transform: [{ translateY }],
    };
  });
  useEffect(() => {
    loadCategoryPhotos();
  }, [title]);
  // 在 SwipeScreen 組件內新增「保留」邏輯
  const handleKeepPhoto = async (assetId: string) => {
    try {
      let albums = await MediaLibrary.getAlbumsAsync();
      let organizedAlbum = albums.find((a) => a.title === "已整理");

      if (!organizedAlbum) {
        organizedAlbum = await MediaLibrary.createAlbumAsync("已整理");
      }

      // 將資產加入相簿
      await MediaLibrary.addAssetsToAlbumAsync(
        [assetId],
        organizedAlbum.id,
        false,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // 【關鍵】：立即從當前的 photos 狀態中移除
      // 這樣在 Swipe 頁面它會立刻消失
      setPhotos((prev) => {
        const newPhotos = prev.filter((p) => p.id !== assetId);
        if (currentIndex >= newPhotos.length && currentIndex > 0) {
          setCurrentIndex(newPhotos.length - 1);
        }
        return newPhotos;
      });
    } catch (error) {
      console.error("歸類失敗:", error);
      Alert.alert("歸類失敗", "無法將照片/影片移入相簿");
    }
  };
  // 跳轉至特定照片
  const handleJumpToPhoto = (index: number) => {
    setCurrentIndex(index);
    flatListRef.current?.scrollToIndex({ index, animated: false });
    toggleGrid(); // 選完自動縮回
  };
  const loadCategoryPhotos = async () => {
    setLoading(true);
    try {
      // 1. 先取得「已整理」相簿並抓取 *所有* (照片+影片) 的 ID
      const albums = await MediaLibrary.getAlbumsAsync();
      const organizedAlbum = albums.find((a) => a.title === "已整理");
      let organizedIds = new Set();

      if (organizedAlbum) {
        const organizedAssets = await MediaLibrary.getAssetsAsync({
          album: organizedAlbum.id,
          first: 20000,
          mediaType: ["photo", "video"], // 【關鍵 1】確保這裡有抓到已整理的影片 ID
        });
        organizedIds = new Set(organizedAssets.assets.map((a) => a.id));
      }

      // 2. 根據模式抓取目標照片/影片
      const fetchOptions: MediaLibrary.AssetsOptions = {
        mediaType: ["photo", "video"], // 【關鍵 2】全域確保包含影片
        sortBy: ["creationTime"],
        ...(type === "album" && albumId
          ? { album: albumId as string }
          : { first: 10000 }),
      };

      const { assets: allAssets } =
        await MediaLibrary.getAssetsAsync(fetchOptions);

      // 3. 嚴格過濾
      const filtered = allAssets.filter((asset) => {
        // 檢查是否已在「已整理」中
        const isAlreadyOrganized = organizedIds.has(asset.id);
        if (isAlreadyOrganized) return false;

        const date = new Date(asset.creationTime);
        const now = new Date();

        switch (type) {
          case "album":
            return true;
          case "weekly":
            const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
            return asset.creationTime > oneWeekAgo;
          case "month":
            return `${date.getFullYear()}年 ${date.getMonth() + 1}月` === title;
          case "unorganized_video":
            return asset.mediaType === "video";
          case "unorganized":
            return true;
          default:
            return true;
        }
      });

      setPhotos(filtered);
    } catch (error) {
      console.error("載入失敗:", error);
    } finally {
      setLoading(false);
    }
  };

  // 核心：當照片飛走後，從主列表移除並存入待刪清單
  const handleRemovePhoto = useCallback(
    (id: string) => {
      const assetToRemove = photos.find((p) => p.id === id);
      if (assetToRemove) {
        setPendingDeleteAssets((prev) => [...prev, assetToRemove]);
        setPhotos((prev) => prev.filter((p) => p.id !== id));
      }
    },
    [photos],
  );

  // 確定刪除：調用 MediaLibrary API 真正刪除設備照片
  const confirmFinalDelete = async (ids: string[]) => {
    try {
      await MediaLibrary.deleteAssetsAsync(ids);
      setPendingDeleteAssets((prev) => prev.filter((a) => !ids.includes(a.id)));
      if (pendingDeleteAssets.length === ids.length) setIsTrashVisible(false);
    } catch (e) {
      Alert.alert("刪除失敗", "無法刪除系統相簿中的照片");
    }
  };

  // 恢復照片：放回待整理清單
  const restoreAssets = (ids: string[]) => {
    const assetsToRestore = pendingDeleteAssets.filter((a) =>
      ids.includes(a.id),
    );
    setPhotos((prev) => [...assetsToRestore, ...prev]);
    setPendingDeleteAssets((prev) => prev.filter((a) => !ids.includes(a.id)));
    if (pendingDeleteAssets.length === ids.length) setIsTrashVisible(false);
  };

  const onMomentumScrollEnd = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  if (loading)
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color="#fff" />
      </ThemedView>
    );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        {/* 1. MIDDLE SECTION */}
        <View style={styles.middleSectionFull}>
          {photos.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              onMomentumScrollEnd={onMomentumScrollEnd}
              renderItem={({ item, index }) => (
                <SwipeableCard
                  item={item}
                  onSwipeUp={handleRemovePhoto}
                  // 關鍵修正：傳入 isActive 讓子組件知道現在輪到哪張照片/影片
                  isActive={currentIndex === index}
                />
              )}
              getItemLayout={(_, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              contentContainerStyle={{ paddingTop: TOP_HEIGHT }}
            />
          ) : (
            <View style={styles.center}>
              <ThemedText>全部滑完囉！</ThemedText>
            </View>
          )}
        </View>

        {/* 2. TOP SECTION (使用絕對定位，並給予較低的 zIndex 或 讓它先被渲染) */}
        <View style={styles.absoluteTop}>
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.iconBtn}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            {/* 修改中間標題：點擊開啟網格 */}
            <TouchableOpacity style={styles.titleBadge} onPress={toggleGrid}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ThemedText style={styles.titleText}>
                  {title || "所有照片"}
                </ThemedText>
                <Animated.View style={[arrowStyle, { marginLeft: 4 }]}>
                  <Ionicons name="chevron-down" size={16} color="#fff" />
                </Animated.View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                if (pendingDeleteAssets.length === 0) {
                  // 如果是空的，跳出系統提示
                  Alert.alert(
                    "垃圾箱是空的",
                    "向上滑動照片即可將其放入垃圾箱。",
                    [{ text: "我知道了" }],
                  );
                } else {
                  // 如果有照片，才開啟 Modal
                  setIsTrashVisible(true);
                }
              }}
            >
              <Ionicons name="trash-outline" size={24} color="#fff" />
              {pendingDeleteAssets.length > 0 && (
                <View style={styles.badgeContainer}>
                  <ThemedText style={styles.badgeText}>
                    {pendingDeleteAssets.length}
                  </ThemedText>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.fixedInfoContainer}>
            <ThemedText style={styles.infoTextMain}>
              {photos.length > 0
                ? `${currentIndex + 1} / ${photos.length}`
                : "0 / 0"}{" "}
              ·{" "}
              {photos[currentIndex]
                ? new Date(
                    photos[currentIndex].creationTime,
                  ).toLocaleDateString()
                : ""}
            </ThemedText>
          </View>
        </View>

        {/* 3. BOTTOM SECTION */}
        <View style={[styles.bottomSection, { height: BOTTOM_HEIGHT }]}>
          <TouchableOpacity style={styles.actionItemHorizontal}>
            <Ionicons name="help-circle-outline" size={20} color="#fff" />
            <ThemedText style={styles.actionLabelHorizontal}>幫助</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItemHorizontal}
            onPress={() => {
              if (photos[currentIndex])
                handleKeepPhoto(photos[currentIndex].id);
            }}
          >
            <Ionicons name="download-outline" size={20} color="#fff" />
            <ThemedText style={styles.actionLabelHorizontal}>保留</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItemHorizontal}
            onPress={() => {
              if (photos[currentIndex])
                handleRemovePhoto(photos[currentIndex].id);
            }}
          >
            <Ionicons name="close-outline" size={20} color="red" />
            <ThemedText
              style={[styles.actionLabelHorizontal, { color: "red" }]}
            >
              刪除
            </ThemedText>
          </TouchableOpacity>
        </View>
        {/* 3. 修正後的 PhotoGridModal：我們把它包在 Animated.View 裡實現下推 */}
        {isGridVisible && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.customModalWrapper,
              gridModalStyle, // 這是控制從 -SCREEN_HEIGHT 到 0 的位移
            ]}
          >
            <PhotoGridModal
              isVisible={true}
              onClose={toggleGrid}
              photos={photos}
              title={title as string}
              onSelectPhoto={handleJumpToPhoto}
              onBatchDelete={(ids) => {
                ids.forEach((id) => handleRemovePhoto(id));
              }}
            />
          </Animated.View>
        )}
        {/* 引入 TrashModal */}
        <TrashModal
          isVisible={isTrashVisible}
          onClose={() => setIsTrashVisible(false)}
          pendingAssets={pendingDeleteAssets}
          onConfirmDelete={confirmFinalDelete}
          onRestore={restoreAssets}
        />
      </ThemedView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  customModalWrapper: {
    zIndex: 100, // 確保在最上層
    backgroundColor: "#000",
  },
  // 記得檢查 titleBadge 的樣式，確保 row 排列
  titleBadge: {
    backgroundColor: "#333",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  bottomSection: {
    // 這裡的高度可以視情況調小，例如改為 60 或 80
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#000",
    zIndex: 30,
    paddingHorizontal: 10,
    // 移除原本較大的 paddingBottom，讓位置更精確
    paddingVertical: 10,
  },

  actionItemHorizontal: {
    flexDirection: "row", // 關鍵：改為左右排列
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1C1C1E", // 加上微弱背景色讓按鈕感更強（可選）
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20, // 圓角膠囊感
    flex: 1,
    marginHorizontal: 5,
  },

  actionLabelHorizontal: {
    color: "#fff",
    fontSize: 13, // 稍微調大一點點，因為空間變充裕了
    marginLeft: 6, // 圖標與文字的間距
    fontWeight: "600",
  },
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  // 1. 頂部區塊保持絕對定位，但我們給它一個半透明黑背景或純黑，
  // 這樣圖片滑上去時會有一種「鑽進標題欄後方」或「蓋在上方」的層次感。
  absoluteTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: TOP_HEIGHT,
    paddingTop: 60,
    zIndex: 20, // 提升 zIndex 確保按鈕可點擊
    backgroundColor: "rgba(0,0,0,0.7)", // 稍微給一點背景，視覺更高級
  },

  middleSectionFull: {
    flex: 1,
    zIndex: 10, // 圖片層
  },

  card: {
    width: SCREEN_WIDTH,
    // 高度 = 總高 - 頂部高度 - 底部高度
    height: SCREEN_HEIGHT - TOP_HEIGHT - BOTTOM_HEIGHT,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },

  image: {
    width: "100%",
    height: "100%",
    // 使用 contain 確保圖片不論比例如何，都會縮放在 Card 區域內
  },
  // 底部也要固定
  bottomSectionFixed: {
    height: BOTTOM_HEIGHT,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 30,
    backgroundColor: "#000",
    zIndex: 20, // 底部通常要蓋過所有東西
  },
  topSection: { paddingTop: 60, backgroundColor: "#000", zIndex: 0 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  fixedInfoContainer: { alignItems: "center" },
  middleSection: { width: SCREEN_WIDTH },
  badgeContainer: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "red",
    borderRadius: 10, // 圓角
    minWidth: 18,
    height: 18,
    // --- 居中關鍵 ---
    justifyContent: "center",
    alignItems: "center",
    // ---------------
    paddingHorizontal: 2, // 稍微縮減
    borderWidth: 1.5,
    borderColor: "#000",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
    // --- 消除預設偏移關鍵 ---
    textAlign: "center",
    includeFontPadding: false, // 針對 Android 必加：移除字體預設留白
    textAlignVertical: "center", // 針對 Android 的文字垂直居中
    lineHeight: 12, // 給予一個固定的行高，通常比字體大一點點
  },
  titleText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  infoTextMain: { color: "#8E8E93", fontSize: 13, fontWeight: "500" },
  actionLabel: { color: "#fff", fontSize: 11, marginTop: 4 },
  actionItem: { alignItems: "center", flex: 1 },
  iconBtn: { padding: 5, position: "relative" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
});
