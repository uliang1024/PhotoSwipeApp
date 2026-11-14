import type * as MediaLibrary from "expo-media-library";

export type SwipeAction = "keep" | "delete";

export interface HistoryItem {
  asset: MediaLibrary.Asset;
  index: number; // 被移走前在清單中的位置，復原時插回這裡
  action: SwipeAction;
}

// 一次操作（單張滑動、網格批次、連拍只留一張）記錄每張的動作與原位置，供復原插回
export interface HistoryEntry {
  items: HistoryItem[];
}

export type PendingIds = Record<SwipeAction, Set<string>>;

// 依 plan 從目前清單挑出要 stage 的項目；已不在清單的會略過，所以重複呼叫不會重複 stage
export function planStage(
  photos: MediaLibrary.Asset[],
  plan: Map<string, SwipeAction>,
) {
  const items: HistoryItem[] = photos.flatMap((asset, index) => {
    const action = plan.get(asset.id);
    return action ? [{ asset, index, action }] : [];
  });
  const remaining = photos.filter((p) => !plan.has(p.id));
  return { items, remaining };
}

// 找最近一筆仍有效的歷史（已從垃圾桶恢復或已真正刪除的項目不算）
export function findUndo(history: HistoryEntry[], pendingIds: PendingIds) {
  for (let at = history.length - 1; at >= 0; at--) {
    const items = history[at].items
      .filter((i) => pendingIds[i.action].has(i.asset.id))
      .sort((a, b) => a.index - b.index);
    if (items.length > 0) return { at, items };
  }
  return null;
}

// 依原位置由小到大插回
export function reinsert(photos: MediaLibrary.Asset[], items: HistoryItem[]) {
  const next = [...photos];
  for (const { asset, index } of items) {
    next.splice(Math.min(index, next.length), 0, asset);
  }
  return next;
}
