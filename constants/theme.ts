// App 固定深色主題（app.json userInterfaceStyle: dark），視覺方向「暗房」：
// 暖黑底不讓照片偏色、琥珀＝保留／底片日期印、暗紅＝刪除
export const Colors = {
  background: "#0E0D0C",
  surface: "#1A1816", // 按鈕、底片帶、底欄
  surfaceRaised: "#262320", // 列表項目、徽章
  surfaceMuted: "#34302B",
  border: "#2E2A26",
  text: "#EDE8DF",
  textSecondary: "#9A948A",
  textTertiary: "#5C564E",
  textFaint: "rgba(237,232,223,0.2)",
  inverse: "#EDE8DF", // 淺底元件（主要按鈕）
  onInverse: "#0E0D0C",
  accent: "#C8A15A", // 選取、底片日期印
  keep: "#C8A15A",
  onKeep: "#0E0D0C",
  danger: "#D0583F",
  scrimLight: "rgba(0,0,0,0.3)", // 圖片上的遮罩
  scrim: "rgba(0,0,0,0.5)",
  scrimStrong: "rgba(14,13,12,0.75)",
};

// 數字專用窄體（app/_layout.tsx 載入）；中文維持系統字
export const Fonts = {
  number: "BarlowCondensed_500Medium",
  numberBold: "BarlowCondensed_700Bold",
};
