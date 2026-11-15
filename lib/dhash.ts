import { inflate } from "pako";

// 相似照片原型：9×8 灰階 → 64-bit dHash（拆成兩個 32-bit 存）
export type Hash = [number, number];

export const HASH_W = 9;
export const HASH_H = 8;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

// 只支援 8-bit、非 interlace 的灰階/RGB/RGBA PNG（ImageManipulator 輸出的就是這種）
export function decodePngGray(b64: string): {
  width: number;
  height: number;
  gray: Uint8Array;
} {
  const bytes = base64ToBytes(b64);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat: Uint8Array[] = [];
  while (pos < bytes.length) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(...bytes.subarray(pos + 4, pos + 8));
    const data = bytes.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = view.getUint32(pos + 8);
      height = view.getUint32(pos + 12);
      const bitDepth = data[8];
      colorType = data[9];
      if (bitDepth !== 8 || data[12] !== 0)
        throw new Error(`不支援的 PNG：depth=${bitDepth} interlace=${data[12]}`);
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`不支援的 PNG colorType=${colorType}`);

  const total = idat.reduce((n, d) => n + d.length, 0);
  const joined = new Uint8Array(total);
  let off = 0;
  for (const d of idat) {
    joined.set(d, off);
    off += d.length;
  }
  const raw = inflate(joined);

  const stride = width * channels;
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  const gray = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = raw[rowStart];
    for (let i = 0; i < stride; i++) {
      const x = raw[rowStart + 1 + i];
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v = x;
      if (filter === 1) v = x + a;
      else if (filter === 2) v = x + b;
      else if (filter === 3) v = x + ((a + b) >> 1);
      else if (filter === 4) v = x + paeth(a, b, c);
      cur[i] = v & 0xff;
    }
    for (let px = 0; px < width; px++) {
      const i = px * channels;
      gray[y * width + px] =
        channels >= 3
          ? (cur[i] * 299 + cur[i + 1] * 587 + cur[i + 2] * 114) / 1000
          : cur[i];
    }
    prev.set(cur);
  }
  return { width, height, gray };
}

// gray 為 9×8：每列比較左右相鄰像素，左 < 右 記 1
export function dHashFromGray(gray: Uint8Array): Hash {
  let hi = 0;
  let lo = 0;
  for (let y = 0; y < HASH_H; y++) {
    for (let x = 0; x < HASH_W - 1; x++) {
      const bit = gray[y * HASH_W + x] < gray[y * HASH_W + x + 1] ? 1 : 0;
      const idx = y * (HASH_W - 1) + x;
      if (idx < 32) hi = (hi | (bit << (31 - idx))) >>> 0;
      else lo = (lo | (bit << (63 - idx))) >>> 0;
    }
  }
  return [hi, lo];
}

function popcount(n: number) {
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export function hamming(a: Hash, b: Hash) {
  return popcount((a[0] ^ b[0]) >>> 0) + popcount((a[1] ^ b[1]) >>> 0);
}

export interface HashedItem {
  id: string;
  hash: Hash;
  time: number;
}

// items 需依時間排序；只跟 maxGapMs 內的照片比（Infinity＝整批兩兩比），
// 距離 ≤ threshold 就連起來（union-find），回傳 2 張以上的組
export function groupSimilar(
  items: HashedItem[],
  threshold: number,
  maxGapMs = Infinity,
): string[][] {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (Math.abs(items[j].time - items[i].time) > maxGapMs) break;
      if (hamming(items[i].hash, items[j].hash) <= threshold) {
        parent[find(j)] = find(i);
      }
    }
  }
  const groups = new Map<number, string[]>();
  items.forEach((item, i) => {
    const root = find(i);
    const g = groups.get(root);
    if (g) g.push(item.id);
    else groups.set(root, [item.id]);
  });
  return [...groups.values()].filter((g) => g.length > 1);
}
