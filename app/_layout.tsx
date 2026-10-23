import { BarlowCondensed_500Medium } from "@expo-google-fonts/barlow-condensed/500Medium";
import { BarlowCondensed_700Bold } from "@expo-google-fonts/barlow-condensed/700Bold";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Colors } from "@/constants/theme";

const NavTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: Colors.background },
};

export default function RootLayout() {
  // 字型是本機資源，載入只要一瞬間，載完前不渲染避免數字跳字型
  const [fontsLoaded] = useFonts({
    BarlowCondensed_500Medium,
    BarlowCondensed_700Bold,
  });
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={NavTheme}>
        <Stack>
          {/* 1. Tabs 隱藏 Header */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

          {/* 2. Swipe 頁面也要隱藏 Header，因為我們在頁面裡自訂了 */}
          <Stack.Screen name="swipe" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
