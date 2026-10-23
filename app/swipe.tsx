import { PhotoGridModal } from "@/components/PhotoGridModal";
import { TrashModal } from "@/components/TrashModal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { usePreventRemove } from "@react-navigation/native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import {
  deleteAssets,
  getLibrarySnapshot,
  keepAssets,
  refreshLibrary,
} from "@/lib/library-store";
import { fetchAllAssets, isWithinLastWeek, monthKey } from "@/lib/media";
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
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/theme";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
// 不含安全區域的內容高度，實際高度會再加上 insets
const TOP_BAR_HEIGHT = 60;
const BOTTOM_BAR_HEIGHT = 70;
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

type SwipeAction = "keep" | "delete";

// 一次操作（單張滑動或網格批次）記錄每張的原位置，供復原插回
interface HistoryEntry {
  action: SwipeAction;
  items: { asset: MediaLibrary.Asset; index: number }[];
}

const SWIPE_DISTANCE = 120;
const SWIPE_VELOCITY = 500;

// --- 子組件：SwipeableCard（上滑刪除、下滑保留）---
const SwipeableCard = ({
  item,
  onSwipe,
  isActive,
  height,
}: {
  item: MediaLibrary.Asset;
  onSwipe: (id: string, action: SwipeAction) => void;
  isActive: boolean;
  height: number;
}) => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const gesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onUpdate((event) => {
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const { translationY: dy, velocityY: vy } = event;
      const up = dy < -SWIPE_DISTANCE || (vy < -SWIPE_VELOCITY && dy < 0);
      const down = dy > SWIPE_DISTANCE || (vy > SWIPE_VELOCITY && dy > 0);
      if (!up && !down) {
        translateY.value = withSpring(0, { damping: 15 });
        return;
      }
      const action: SwipeAction = up ? "delete" : "keep";
      translateY.value = withTiming(
        up ? -SCREEN_HEIGHT : SCREEN_HEIGHT,
        { duration: 250 },
        () => {
          runOnJS(onSwipe)(item.id, action);
        },
      );
      opacity.value = withTiming(0, { duration: 200 });
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    });

  const deleteHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [0, -SWIPE_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));
  const keepHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [0, SWIPE_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateY.value,
      [-200, 0, 200],
      [8, 0, -8],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      translateY.value,
      [-200, 0, 200],
      [0.85, 1, 0.85],
      Extrapolation.CLAMP,
    );
    const translateX = interpolate(
      translateY.value,
      [-200, 0, 200],
      [50, 0, -50],
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
      <Animated.View style={[styles.card, { height }, animatedStyle]}>
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
        <Animated.View
          pointerEvents="none"
          style={[styles.swipeHint, styles.deleteHint, deleteHintStyle]}
        >
          <ThemedText style={styles.swipeHintText}>刪除</ThemedText>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[styles.swipeHint, styles.keepHint, keepHintStyle]}
        >
          <ThemedText style={styles.swipeHintText}>保留</ThemedText>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

// --- 主螢幕 ---
export default function SwipeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { title, type, albumId, monthId } = useLocalSearchParams<{
    title?: string;
    type?: string;
    albumId?: string;
    monthId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const topHeight = insets.top + TOP_BAR_HEIGHT;
  const bottomHeight = insets.bottom + BOTTOM_BAR_HEIGHT;
  const cardHeight = SCREEN_HEIGHT - topHeight - bottomHeight;
  const [photos, setPhotos] = useState<MediaLibrary.Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTrashVisible, setIsTrashVisible] = useState(false);
  const [pendingDeleteAssets, setPendingDeleteAssets] = useState<
    MediaLibrary.Asset[]
  >([]);
  // 保留也先暫存，離開時才批次寫入「已整理」，讓復原只需改本機狀態
  const [pendingKeepAssets, setPendingKeepAssets] = useState<
    MediaLibrary.Asset[]
  >([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
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
  // 照片被移走後，索引不能超出範圍
  useEffect(() => {
    if (photos.length > 0 && currentIndex >= photos.length) {
      setCurrentIndex(photos.length - 1);
    }
  }, [photos.length, currentIndex]);

  // 跳轉至特定照片
  const handleJumpToPhoto = (index: number) => {
    setCurrentIndex(index);
    flatListRef.current?.scrollToIndex({ index, animated: false });
    // 縮回由 PhotoGridModal 選完後呼叫的 onClose 處理
  };
  const loadCategoryPhotos = useCallback(async () => {
    setLoading(true);
    try {
      // 一般情況直接命中首頁載好的快取，不重掃
      await refreshLibrary();
      const { assets, organizedIds } = getLibrarySnapshot();
      // asset 本身不帶所屬相簿，相簿模式只能另外抓該相簿
      const source =
        type === "album" && albumId
          ? await fetchAllAssets({ album: albumId, sortBy: ["creationTime"] })
          : assets;

      const filtered = source.filter((asset) => {
        if (organizedIds.has(asset.id)) return false;
        switch (type) {
          case "weekly":
            return isWithinLastWeek(asset.creationTime);
          case "month":
            return monthKey(asset.creationTime) === monthId;
          case "unorganized_video":
            return asset.mediaType === "video";
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
  }, [type, albumId, monthId]);

  useEffect(() => {
    loadCategoryPhotos();
  }, [loadCategoryPhotos]);

  // 核心：照片飛走後從主列表移除，放進對應的暫存區並記錄歷史
  const stageAssets = useCallback(
    (action: SwipeAction, ids: string[]) => {
      const idSet = new Set(ids);
      const items = photos.flatMap((asset, index) =>
        idSet.has(asset.id) ? [{ asset, index }] : [],
      );
      if (items.length === 0) return;
      const assets = items.map((i) => i.asset);
      const setPending =
        action === "keep" ? setPendingKeepAssets : setPendingDeleteAssets;
      setPending((prev) => [...prev, ...assets]);
      setPhotos((prev) => prev.filter((p) => !idSet.has(p.id)));
      setHistory((prev) => [...prev, { action, items }]);
      if (action === "keep") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    [photos],
  );

  const handleSwipe = useCallback(
    (id: string, action: SwipeAction) => stageAssets(action, [id]),
    [stageAssets],
  );

  // 復原最近一次仍有效的操作（已從垃圾桶恢復或已真正刪除的會跳過）
  const undoLast = () => {
    for (let h = history.length - 1; h >= 0; h--) {
      const entry = history[h];
      const pending =
        entry.action === "keep" ? pendingKeepAssets : pendingDeleteAssets;
      const pendingIds = new Set(pending.map((a) => a.id));
      const items = entry.items
        .filter((i) => pendingIds.has(i.asset.id))
        .sort((a, b) => a.index - b.index);
      if (items.length === 0) continue;

      const ids = new Set(items.map((i) => i.asset.id));
      const setPending =
        entry.action === "keep" ? setPendingKeepAssets : setPendingDeleteAssets;
      setPending((prev) => prev.filter((a) => !ids.has(a.id)));
      setHistory(history.slice(0, h));

      const next = [...photos];
      for (const { asset, index } of items) {
        next.splice(Math.min(index, next.length), 0, asset);
      }
      setPhotos(next);
      const target = Math.min(items[0].index, next.length - 1);
      setCurrentIndex(target);
      requestAnimationFrame(() =>
        flatListRef.current?.scrollToIndex({ index: target, animated: false }),
      );
      Haptics.selectionAsync();
      return;
    }
    setHistory([]);
  };

  // 把暫存的保留寫入「已整理」相簿
  const commitKeeps = async () => {
    if (pendingKeepAssets.length === 0) return true;
    try {
      await keepAssets(pendingKeepAssets.map((a) => a.id));
      setPendingKeepAssets([]);
      return true;
    } catch (error) {
      console.error("歸類失敗:", error);
      Alert.alert("歸類失敗", "無法將照片/影片移入「已整理」相簿");
      return false;
    }
  };

  // 確定刪除：調用 MediaLibrary API 真正刪除設備照片
  const confirmFinalDelete = async (ids: string[]) => {
    try {
      const deleted = await deleteAssets(ids);
      if (!deleted) return false;
      setPendingDeleteAssets((prev) => prev.filter((a) => !ids.includes(a.id)));
      if (pendingDeleteAssets.length === ids.length) setIsTrashVisible(false);
      return true;
    } catch {
      Alert.alert("刪除失敗", "無法刪除系統相簿中的照片");
      return false;
    }
  };

  // 離開時寫入暫存的保留；垃圾桶還有東西才詢問，避免待刪清單默默消失
  const hasPending =
    pendingKeepAssets.length > 0 || pendingDeleteAssets.length > 0;
  usePreventRemove(hasPending, ({ data }) => {
    const leave = async (withDelete: boolean) => {
      if (!(await commitKeeps())) return;
      if (
        withDelete &&
        !(await confirmFinalDelete(pendingDeleteAssets.map((a) => a.id)))
      )
        return;
      navigation.dispatch(data.action);
    };

    if (pendingDeleteAssets.length === 0) {
      leave(false);
      return;
    }
    const keepNote =
      pendingKeepAssets.length > 0
        ? `保留的 ${pendingKeepAssets.length} 張會移到「已整理」。\n`
        : "";
    Alert.alert(
      "垃圾桶還有項目",
      `${keepNote}垃圾桶還有 ${pendingDeleteAssets.length} 張尚未刪除，不刪除的話會放回未整理。`,
      [
        { text: "取消", style: "cancel" },
        { text: "不刪除，離開", onPress: () => leave(false) },
        {
          text: "刪除後離開",
          style: "destructive",
          onPress: () => leave(true),
        },
      ],
    );
  });

  // 恢復照片：放回待整理清單
  const restoreAssets = (ids: string[]) => {
    const assetsToRestore = pendingDeleteAssets.filter((a) =>
      ids.includes(a.id),
    );
    // 插在目前這張後面：畫面不跳動，往下滑就會看到恢復的項目
    setPhotos((prev) => {
      const insertAt = Math.min(currentIndex + 1, prev.length);
      return [
        ...prev.slice(0, insertAt),
        ...assetsToRestore,
        ...prev.slice(insertAt),
      ];
    });
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
        <ActivityIndicator color={Colors.text} />
      </ThemedView>
    );

  return (
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
                  onSwipe={handleSwipe}
                  // 關鍵修正：傳入 isActive 讓子組件知道現在輪到哪張照片/影片
                  isActive={currentIndex === index}
                  height={cardHeight}
                />
              )}
              getItemLayout={(_, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              contentContainerStyle={{ paddingTop: topHeight }}
              // 每張卡片都可能是影片 player，限制同時掛載的數量
              windowSize={3}
              initialNumToRender={2}
              maxToRenderPerBatch={2}
            />
          ) : (
            <View style={styles.center}>
              <ThemedText>全部滑完囉！</ThemedText>
            </View>
          )}
        </View>

        {/* 2. TOP SECTION (使用絕對定位，並給予較低的 zIndex 或 讓它先被渲染) */}
        <View
          style={[
            styles.absoluteTop,
            { height: topHeight, paddingTop: insets.top },
          ]}
        >
          <View style={styles.topBar}>
            <View style={styles.topBarSide}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.iconBtn}
              >
                <Ionicons name="close" size={28} color={Colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() =>
                  Alert.alert(
                    "怎麼使用",
                    [
                      "・左右滑動切換照片",
                      "・往上滑或按「刪除」放入垃圾桶",
                      "・往下滑或按「保留」，離開時移到「已整理」相簿，之後不會再出現",
                      "・按「復原」可撤回上一步",
                      "・點上方標題可開啟網格跳轉或批次選取",
                      "・右上角垃圾桶可恢復或真正刪除",
                    ].join("\n"),
                    [{ text: "我知道了" }],
                  )
                }
              >
                <Ionicons
                  name="help-circle-outline"
                  size={24}
                  color={Colors.text}
                />
              </TouchableOpacity>
            </View>
            {/* 修改中間標題：點擊開啟網格 */}
            <TouchableOpacity style={styles.titleBadge} onPress={toggleGrid}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ThemedText style={styles.titleText}>
                  {title || "所有照片"}
                </ThemedText>
                <Animated.View style={[arrowStyle, { marginLeft: 4 }]}>
                  <Ionicons name="chevron-down" size={16} color={Colors.text} />
                </Animated.View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, styles.topBarSide, styles.topBarRight]}
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
              <Ionicons name="trash-outline" size={24} color={Colors.text} />
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
        <View
          style={[
            styles.bottomSection,
            { height: bottomHeight, paddingBottom: insets.bottom + 10 },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.actionItemHorizontal,
              history.length === 0 && styles.actionDisabled,
            ]}
            disabled={history.length === 0}
            onPress={undoLast}
          >
            <Ionicons name="arrow-undo-outline" size={20} color={Colors.text} />
            <ThemedText style={styles.actionLabelHorizontal}>復原</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItemHorizontal}
            onPress={() => {
              if (photos[currentIndex])
                stageAssets("keep", [photos[currentIndex].id]);
            }}
          >
            <Ionicons
              name="checkmark-outline"
              size={20}
              color={Colors.success}
            />
            <ThemedText
              style={[styles.actionLabelHorizontal, { color: Colors.success }]}
            >
              保留{pendingKeepAssets.length > 0 ? ` ${pendingKeepAssets.length}` : ""}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItemHorizontal}
            onPress={() => {
              if (photos[currentIndex])
                stageAssets("delete", [photos[currentIndex].id]);
            }}
          >
            <Ionicons name="close-outline" size={20} color={Colors.danger} />
            <ThemedText
              style={[styles.actionLabelHorizontal, { color: Colors.danger }]}
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
              title={title ?? ""}
              onSelectPhoto={handleJumpToPhoto}
              onBatchDelete={(ids) => stageAssets("delete", ids)}
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
  );
}

const styles = StyleSheet.create({
  customModalWrapper: {
    zIndex: 100, // 確保在最上層
    backgroundColor: Colors.background,
  },
  // 記得檢查 titleBadge 的樣式，確保 row 排列
  titleBadge: {
    backgroundColor: Colors.surfaceRaised,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  bottomSection: {
    // 這裡的高度可以視情況調小，例如改為 60 或 80
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: Colors.background,
    zIndex: 30,
    paddingHorizontal: 10,
    // 移除原本較大的 paddingBottom，讓位置更精確
    paddingVertical: 10,
  },

  actionItemHorizontal: {
    flexDirection: "row", // 關鍵：改為左右排列
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface, // 加上微弱背景色讓按鈕感更強（可選）
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20, // 圓角膠囊感
    flex: 1,
    marginHorizontal: 5,
  },

  actionLabelHorizontal: {
    color: Colors.text,
    fontSize: 13, // 稍微調大一點點，因為空間變充裕了
    marginLeft: 6, // 圖標與文字的間距
    fontWeight: "600",
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // 1. 頂部區塊保持絕對定位，但我們給它一個半透明黑背景或純黑，
  // 這樣圖片滑上去時會有一種「鑽進標題欄後方」或「蓋在上方」的層次感。
  absoluteTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20, // 提升 zIndex 確保按鈕可點擊
    backgroundColor: Colors.scrimStrong, // 稍微給一點背景，視覺更高級
  },

  middleSectionFull: {
    flex: 1,
    zIndex: 10, // 圖片層
  },

  card: {
    width: SCREEN_WIDTH,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },

  image: {
    width: "100%",
    height: "100%",
    // 使用 contain 確保圖片不論比例如何，都會縮放在 Card 區域內
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  fixedInfoContainer: { alignItems: "center" },
  badgeContainer: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: Colors.danger,
    borderRadius: 10, // 圓角
    minWidth: 18,
    height: 18,
    // --- 居中關鍵 ---
    justifyContent: "center",
    alignItems: "center",
    // ---------------
    paddingHorizontal: 2, // 稍微縮減
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  badgeText: {
    color: Colors.text,
    fontSize: 10,
    fontWeight: "bold",
    // --- 消除預設偏移關鍵 ---
    textAlign: "center",
    includeFontPadding: false, // 針對 Android 必加：移除字體預設留白
    textAlignVertical: "center", // 針對 Android 的文字垂直居中
    lineHeight: 12, // 給予一個固定的行高，通常比字體大一點點
  },
  titleText: { color: Colors.text, fontWeight: "bold", fontSize: 14 },
  infoTextMain: { color: Colors.textSecondary, fontSize: 13, fontWeight: "500" },
  iconBtn: { padding: 5, position: "relative" },
  // 左右兩側等寬，讓中間標題維持置中
  topBarSide: { flexDirection: "row", alignItems: "center", width: 80 },
  topBarRight: { justifyContent: "flex-end" },
  actionDisabled: { opacity: 0.4 },
  swipeHint: {
    position: "absolute",
    alignSelf: "center",
    top: "45%",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  deleteHint: { backgroundColor: Colors.danger },
  keepHint: { backgroundColor: Colors.success },
  swipeHintText: { color: Colors.text, fontSize: 18, fontWeight: "bold" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
});
