import * as MediaLibrary from "expo-media-library/legacy";
import { Platform } from "react-native";

jest.mock("expo-media-library/legacy", () => ({
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getAlbumsAsync: jest.fn(async () => []),
  deleteAssetsAsync: jest.fn(),
  addListener: jest.fn(),
}));

const mockFetchAll = jest.fn();
jest.mock("../media", () => ({
  addToOrganizedAlbum: jest.fn(async () => {}),
  fetchAllAssets: (...args: unknown[]) => mockFetchAll(...args),
  getFavoriteIds: jest.fn(async () => new Set()),
  getOrganizedAssetIds: jest.fn(async () => new Set()),
  getScreenshotIds: jest.fn(async () => new Set()),
}));

type Store = typeof import("../library-store");

// 每個測試用一份乾淨的模組狀態（store 跟它看到的 mock 要從同一份 registry 拿）
let store: Store;
let deleteMock: jest.Mock;
beforeEach(async () => {
  jest.clearAllMocks();
  mockFetchAll.mockResolvedValue([{ id: "a" }, { id: "b" }]);
  Platform.OS = "ios";
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    store = require("../library-store");
    deleteMock = (require("expo-media-library/legacy") as typeof MediaLibrary)
      .deleteAssetsAsync as jest.Mock;
  });
  await store.refreshLibrary();
});

describe("deleteAssets", () => {
  it("成功：回 true 並從快取移除", async () => {
    deleteMock.mockResolvedValue(true);
    await expect(store.deleteAssets(["a"])).resolves.toBe(true);
    expect(store.getLibrarySnapshot().assets.map((a) => a.id)).toEqual(["b"]);
  });

  it("iOS 在系統確認框按取消（reject 3072）：回 false，不當成錯誤", async () => {
    deleteMock.mockRejectedValue(
      new Error(
        "Couldn't remove assets: The operation couldn't be completed. (PHPhotosErrorDomain error 3072.)",
      ),
    );
    await expect(store.deleteAssets(["a"])).resolves.toBe(false);
    expect(store.getLibrarySnapshot().assets).toHaveLength(2);
  });

  it("中文系統的取消訊息也認得", async () => {
    deleteMock.mockRejectedValue(
      new Error("Couldn't remove assets: 無法完成操作。（PHPhotosErrorDomain錯誤3072。）"),
    );
    await expect(store.deleteAssets(["a"])).resolves.toBe(false);
  });

  it("其他錯誤照樣丟出（畫面會顯示刪除失敗）", async () => {
    deleteMock.mockRejectedValue(new Error("Couldn't remove assets: disk error"));
    await expect(store.deleteAssets(["a"])).rejects.toThrow("disk error");
  });
});

describe("keepAssets", () => {
  it("iOS：保留後不重掃", async () => {
    await store.keepAssets(["a"]);
    mockFetchAll.mockClear();
    await store.refreshLibrary();
    expect(mockFetchAll).not.toHaveBeenCalled();
    expect(store.getLibrarySnapshot().organizedIds.has("a")).toBe(true);
  });

  it("Android：保留後 id 可能變，下次 refresh 會重掃", async () => {
    Platform.OS = "android";
    await store.keepAssets(["a"]);
    mockFetchAll.mockClear();
    await store.refreshLibrary();
    expect(mockFetchAll).toHaveBeenCalled();
  });
});
