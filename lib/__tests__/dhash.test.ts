import { deflate } from "pako";
import {
  decodePngGray,
  dHashFromGray,
  groupSimilar,
  hamming,
  type Hash,
} from "../dhash";

// 組一張最小 PNG（CRC 不驗，填 0），每列可指定 filter
function makePng(
  width: number,
  height: number,
  colorType: number,
  channels: number,
  rows: { filter: number; data: number[] }[],
) {
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    new DataView(out.buffer).setUint32(0, data.length);
    out.set([...type].map((c) => c.charCodeAt(0)), 4);
    out.set(data, 8);
    return out;
  };
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  const raw = new Uint8Array(rows.length * (width * channels + 1));
  rows.forEach((r, y) => {
    raw[y * (width * channels + 1)] = r.filter;
    raw.set(r.data, y * (width * channels + 1) + 1);
  });
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflate(raw)),
    chunk("IEND", new Uint8Array()),
  ];
  const bytes = Uint8Array.from(parts.flatMap((p) => [...p]));
  return btoa(String.fromCharCode(...bytes));
}

describe("decodePngGray", () => {
  it("解 RGBA + Sub/Up filter", () => {
    const b64 = makePng(2, 2, 6, 4, [
      // Sub：第二像素 = 前一像素 + 差值
      { filter: 1, data: [10, 10, 10, 255, 5, 5, 5, 0] },
      // Up：等於上一列 + 差值
      { filter: 2, data: [1, 1, 1, 0, 1, 1, 1, 0] },
    ]);
    const { width, height, gray } = decodePngGray(b64);
    expect([width, height]).toEqual([2, 2]);
    expect([...gray]).toEqual([10, 15, 11, 16]);
  });

  it("解灰階 Paeth", () => {
    const b64 = makePng(2, 1, 0, 1, [{ filter: 4, data: [7, 3] }]);
    // 第一列 b=c=0，Paeth 選 a
    expect([...decodePngGray(b64).gray]).toEqual([7, 10]);
  });
});

describe("dHash", () => {
  it("遞增列全 1、遞減列全 0", () => {
    const up = Uint8Array.from({ length: 72 }, (_, i) => i % 9);
    const down = Uint8Array.from({ length: 72 }, (_, i) => 9 - (i % 9));
    expect(dHashFromGray(up)).toEqual([0xffffffff, 0xffffffff]);
    expect(dHashFromGray(down)).toEqual([0, 0]);
    expect(hamming(dHashFromGray(up), dHashFromGray(down))).toBe(64);
  });
});

describe("groupSimilar", () => {
  const h = (hi: number): Hash => [hi, 0];
  it("距離內串成一組、單張不回傳", () => {
    const items = [
      { id: "a", hash: h(0b0000), time: 0 },
      { id: "b", hash: h(0b0011), time: 1 },
      { id: "c", hash: h(0b1111), time: 2 }, // 跟 b 差 2，跟 a 差 4
      { id: "d", hash: h(0xff00ff00), time: 3 },
    ];
    expect(groupSimilar(items, 2)).toEqual([["a", "b", "c"]]);
    expect(groupSimilar(items, 1)).toEqual([]);
  });

  it("超過時間窗不比", () => {
    const items = [
      { id: "a", hash: h(0), time: 0 },
      { id: "b", hash: h(0), time: 100 },
    ];
    expect(groupSimilar(items, 0, 50)).toEqual([]);
    expect(groupSimilar(items, 0)).toEqual([["a", "b"]]);
  });
});
