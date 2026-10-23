import * as MediaLibrary from "expo-media-library";
import { Platform } from "react-native";

export const ORGANIZED_ALBUM_TITLE = "已整理";
const PAGE_SIZE = 1000;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// getAssetsAsync 預設只回 20 筆，這裡用 endCursor 分頁抓完全部
export async function fetchAllAssets(
  options: Omit<MediaLibrary.AssetsOptions, "first" | "after"> = {},
): Promise<MediaLibrary.Asset[]> {
  const result: MediaLibrary.Asset[] = [];
  let after: string | undefined;
  while (true) {
    const page = await MediaLibrary.getAssetsAsync({
      mediaType: ["photo", "video"],
      ...options,
      first: PAGE_SIZE,
      after,
    });
    result.push(...page.assets);
    if (!page.hasNextPage) return result;
    after = page.endCursor;
  }
}

export async function getOrganizedAssetIds(): Promise<Set<string>> {
  const album = await MediaLibrary.getAlbumAsync(ORGANIZED_ALBUM_TITLE);
  if (!album) return new Set();
  const assets = await fetchAllAssets({ album });
  return new Set(assets.map((a) => a.id));
}

// 注意：Android 上 copy=false 是「移動」檔案到該相簿資料夾，不是加參照
export async function addToOrganizedAlbum(assetIds: string[]) {
  if (assetIds.length === 0) return;
  let rest = assetIds;
  let album = await MediaLibrary.getAlbumAsync(ORGANIZED_ALBUM_TITLE);
  if (!album) {
    // Android 不能建空相簿，建立時要直接帶入第一個 asset
    album = await MediaLibrary.createAlbumAsync(
      ORGANIZED_ALBUM_TITLE,
      assetIds[0],
      false,
    );
    rest = assetIds.slice(1);
  }
  if (rest.length > 0) {
    await MediaLibrary.addAssetsToAlbumAsync(rest, album, false);
  }
}

// iOS 直接看 mediaSubtypes；Android 沒有 subtype，改抓名稱像截圖資料夾的相簿
const SCREENSHOT_ALBUM_PATTERN = /screenshot|截圖|截屏|螢幕擷取/i;

export async function getScreenshotIds(
  assets: MediaLibrary.Asset[],
  albums: MediaLibrary.Album[],
): Promise<Set<string>> {
  if (Platform.OS === "ios") {
    return new Set(
      assets
        .filter((a) => a.mediaSubtypes?.includes("screenshot"))
        .map((a) => a.id),
    );
  }
  const screenshotAlbums = albums.filter((a) =>
    SCREENSHOT_ALBUM_PATTERN.test(a.title),
  );
  const lists = await Promise.all(
    screenshotAlbums.map((album) => fetchAllAssets({ album })),
  );
  return new Set(lists.flat().map((a) => a.id));
}

// 可排序的月份 key，例如 "2024-03"
export function monthKey(timestamp: number) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function isWithinLastWeek(timestamp: number) {
  return timestamp > Date.now() - ONE_WEEK_MS;
}
