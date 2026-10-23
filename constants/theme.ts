// App 固定深色主題（app.json userInterfaceStyle: dark），色值沿用 iOS 深色系統色
export const Colors = {
  background: "#000",
  surface: "#1C1C1E", // 按鈕、分頁、底欄
  surfaceRaised: "#2C2C2E", // 列表項目、徽章
  surfaceMuted: "#3A3A3C",
  border: "#333",
  text: "#fff",
  textSecondary: "#8E8E93",
  textTertiary: "#48484A",
  textFaint: "rgba(255,255,255,0.2)",
  inverse: "#fff", // 白底元件（選中的分頁、主要按鈕）
  onInverse: "#000",
  accent: "#007AFF",
  danger: "#FF3B30",
  scrimLight: "rgba(0,0,0,0.3)", // 圖片上的遮罩
  scrim: "rgba(0,0,0,0.5)",
  scrimStrong: "rgba(0,0,0,0.7)",
};

// 首頁「按月份」的色塊輪替
export const MonthColors = [
  "#A1CEDC",
  "#9ED5B2",
  "#F3E5AB",
  "#D2B48C",
  "#E8A1A2",
  "#B39EB5",
];
