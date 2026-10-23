import * as MediaLibrary from "expo-media-library";
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import {
  addToOrganizedAlbum,
  fetchAllAssets,
  getOrganizedAssetIds,
} from "./media";

// 全 App 共用一份相簿快取，避免每個頁面各自全量掃描
export type LibraryStatus = "idle" | "loading" | "ready" | "denied" | "error";

export interface LibraryState {
  status: LibraryStatus;
  assets: MediaLibrary.Asset[]; // 全部照片＋影片，新到舊
  organizedIds: Set<string>;
  albums: MediaLibrary.Album[];
}

let state: LibraryState = {
  status: "idle",
  assets: [],
  organizedIds: new Set(),
  albums: [],
};
let stale = true;
let inflight: Promise<void> | null = null;
let ignoreChangesUntil = 0;
let watching = false;
const listeners = new Set<() => void>();

function setState(patch: Partial<LibraryState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// 外部相簿有變動、或 App 回到前景時，標記快取過期，下次 refresh 才重掃
function startWatching() {
  if (watching) return;
  watching = true;
  MediaLibrary.addListener(() => {
    if (Date.now() > ignoreChangesUntil) stale = true;
  });
  // 只看「從背景回來」；iOS 系統對話框只會造成 inactive，不算
  let prev = AppState.currentState;
  AppState.addEventListener("change", (next) => {
    if (prev === "background" && next === "active") stale = true;
    prev = next;
  });
}

// 自己做的「保留」也會觸發相簿變動事件，短時間內忽略，避免保留完就重掃
function ignoreOwnChanges() {
  ignoreChangesUntil = Date.now() + 2000;
}

export function getLibrarySnapshot() {
  return state;
}

export function useLibrary() {
  return useSyncExternalStore(subscribe, getLibrarySnapshot);
}

export function refreshLibrary({ force = false } = {}): Promise<void> {
  if (!force && !stale && state.status === "ready") return Promise.resolve();
  if (inflight) return inflight;

  inflight = (async () => {
    if (state.status !== "ready") setState({ status: "loading" });
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        setState({ status: "denied" });
        return;
      }
      startWatching();
      // 先清掉 stale，掃描期間若又有變動會再被標回來
      stale = false;
      const [albums, organizedIds, assets] = await Promise.all([
        MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true }),
        getOrganizedAssetIds(),
        fetchAllAssets({ sortBy: ["creationTime"] }),
      ]);
      setState({ status: "ready", albums, organizedIds, assets });
    } catch (error) {
      console.error("載入相簿失敗:", error);
      stale = true;
      if (state.status !== "ready") setState({ status: "error" });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function keepAssets(assetIds: string[]) {
  if (assetIds.length === 0) return;
  ignoreOwnChanges();
  await addToOrganizedAlbum(assetIds);
  ignoreOwnChanges();
  const organizedIds = new Set(state.organizedIds);
  assetIds.forEach((id) => organizedIds.add(id));
  setState({ organizedIds });
}

// 回傳是否真的刪除成功（使用者可能在系統確認框按取消）
// 刪除會影響各相簿數量，不忽略變動事件，讓首頁下次重掃
export async function deleteAssets(ids: string[]) {
  const deleted = await MediaLibrary.deleteAssetsAsync(ids);
  if (deleted) {
    const removed = new Set(ids);
    setState({ assets: state.assets.filter((a) => !removed.has(a.id)) });
  }
  return deleted;
}
