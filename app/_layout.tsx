import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        {/* 1. Tabs 隱藏 Header */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* 2. Swipe 頁面也要隱藏 Header，因為我們在頁面裡自訂了 */}
        <Stack.Screen name="swipe" options={{ headerShown: false }} />

        {/* 3. Modal 設定 */}
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
