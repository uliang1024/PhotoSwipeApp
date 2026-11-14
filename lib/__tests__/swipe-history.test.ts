import type * as MediaLibrary from "expo-media-library";
import {
  findUndo,
  planStage,
  reinsert,
  type HistoryEntry,
  type PendingIds,
  type SwipeAction,
} from "../swipe-history";

const asset = (id: string) => ({ id }) as MediaLibrary.Asset;
const ids = (list: MediaLibrary.Asset[]) => list.map((a) => a.id);
const plan = (entries: [string, SwipeAction][]) => new Map(entries);
const pending = (keep: string[], del: string[]): PendingIds => ({
  keep: new Set(keep),
  delete: new Set(del),
});

describe("planStage", () => {
  const photos = ["a", "b", "c", "d"].map(asset);

  it("記下原位置並從清單移除", () => {
    const { items, remaining } = planStage(photos, plan([["c", "delete"]]));
    expect(items).toEqual([{ asset: photos[2], index: 2, action: "delete" }]);
    expect(ids(remaining)).toEqual(["a", "b", "d"]);
  });

  it("同一張連續 stage 兩次（飛走動畫中又按按鈕），第二次不會再 stage", () => {
    const first = planStage(photos, plan([["b", "keep"]]));
    const second = planStage(first.remaining, plan([["b", "delete"]]));
    expect(first.items).toHaveLength(1);
    expect(second.items).toHaveLength(0);
  });

  it("連拍只留這張：一次 stage 整組", () => {
    const { items } = planStage(
      photos,
      plan([
        ["a", "delete"],
        ["b", "keep"],
        ["c", "delete"],
      ]),
    );
    expect(items.map((i) => [i.asset.id, i.action])).toEqual([
      ["a", "delete"],
      ["b", "keep"],
      ["c", "delete"],
    ]);
  });
});

describe("findUndo", () => {
  const history: HistoryEntry[] = [
    { items: [{ asset: asset("a"), index: 0, action: "keep" }] },
    { items: [{ asset: asset("b"), index: 0, action: "delete" }] },
  ];

  it("回傳最近一筆仍在暫存的操作", () => {
    expect(findUndo(history, pending(["a"], ["b"]))?.at).toBe(1);
  });

  it("最近那筆已從垃圾桶恢復／已刪除，就往前找", () => {
    expect(findUndo(history, pending(["a"], []))?.at).toBe(0);
  });

  it("全部都失效時回 null（復原鍵應變灰）", () => {
    expect(findUndo(history, pending([], []))).toBeNull();
  });

  it("同一筆裡只回仍有效的項目，並依原位置排序", () => {
    const h: HistoryEntry[] = [
      {
        items: [
          { asset: asset("c"), index: 2, action: "delete" },
          { asset: asset("a"), index: 0, action: "delete" },
          { asset: asset("b"), index: 1, action: "keep" },
        ],
      },
    ];
    const result = findUndo(h, pending([], ["a", "c"]));
    expect(result?.items.map((i) => i.asset.id)).toEqual(["a", "c"]);
  });
});

describe("reinsert", () => {
  it("復原後回到原本順序", () => {
    const photos = ["a", "b", "c", "d", "e"].map(asset);
    const p = plan([
      ["b", "delete"],
      ["d", "keep"],
    ]);
    const { items, remaining } = planStage(photos, p);
    expect(ids(reinsert(remaining, items))).toEqual(ids(photos));
  });

  it("原位置超出目前長度就接在最後", () => {
    const result = reinsert(
      [asset("a")],
      [{ asset: asset("z"), index: 9, action: "keep" }],
    );
    expect(ids(result)).toEqual(["a", "z"]);
  });
});
