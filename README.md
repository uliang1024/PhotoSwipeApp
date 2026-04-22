# PhotoSwipeApp 📸

一個極簡、流暢的 iOS 照片整理工具。透過類似 Tinder 的滑動手勢，讓你在幾分鐘內理清手機中成千上萬的照片與影片。

## ✨ 核心功能
- **滑動整理**：向上滑動放入垃圾箱，點擊「保留」存入「已整理」相簿。
- **智能分類**：自動按月份、週、或影片類型過濾未整理內容。
- **動態視覺**：包含 8 度旋轉動畫與流暢的卡片抽離效果。
- **雲端同步**：支援 Expo 雲端部署，無需與電腦同網域即可使用。

## 🛠️ 技術棧
- **Frontend**: React Native, Expo, TypeScript
- **Animation**: React Native Reanimated
- **Gestures**: React Native Gesture Handler
- **Storage**: Expo Media Library (直接操作系統相簿)

---

## 🚀 開發與執行指南

### 1. 環境準備
確保你的開發電腦已安裝 Node.js。

```bash
# 安裝 Expo CLI
npm install -g expo-cli

# 安裝 EAS CLI (用於雲端部屬)
npm install -g eas-cli
```

### 2. 本地開發步驟
1. 複製專案：
   ```bash
   git clone [你的儲存庫網址]
   cd PhotoSwipeApp
   ```
2. 安裝依賴 (若遇到版本衝突，請務必使用此參數)：
   ```bash
   npm install --legacy-peer-deps
   ```
3. 啟動開發伺服器：
   ```bash
   npx expo start
   ```
   - 按下 `s` 切換至 **Expo Go** 模式。
   - 使用 iPhone 掃描 QR Code 即可預覽。

---

## ☁️ 雲端部屬流程 (Windows 用戶必看)

為了達成「不用連電腦、不用同網路」也能使用，請執行以下步驟：

### 1. 部署到 Expo 雲端
```bash
# 登入 Expo 帳號
eas login

# 發布更新到生產分支
eas update --branch production --message "Update app logic"
```

### 2. 獲取永久連結
前往 [Expo Dashboard](https://expo.dev/)，找到 **Updates** 頁面，複製該版本的 URL（例如 `https://u.expo.dev/xxxx-xxxx?channel-name=production`）。

### 3. 設定 iOS 桌面捷徑 (永久使用)
1. 在 iPhone 打開 **「捷徑 (Shortcuts)」** App。
2. 新增捷徑 -> 動作搜尋 **「打開 URL」**。
3. 網址填入：`exp://u.expo.dev/你的項目ID?channel-name=production` (將 https 改為 exp)。
4. 點擊「分享」-> **「加入主畫面」**。
5. 上傳設計好的 App Icon，命名為 **"PhotoSwipe"**。

---

## 📝 開發筆記

### 關於「已整理」相簿邏輯
App 會自動檢查手機中是否存在名為 `已整理` 的相簿。
- **若按下「保留」**：資產會被移動至該相簿，並從「未整理」列表中消失。
- **若向上滑動**：資產會進入待刪除清單，需點擊垃圾桶圖示進行最後確認刪除。

### 依賴衝突解決
若遇到 `react-native-worklets` 或 `reanimated` 衝突，請優先使用：
`npm install --legacy-peer-deps`

---

## 👤 作者
**Leo** - 一位熱愛開發，追求無限可能的軟體工程師。

---
