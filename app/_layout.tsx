import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DarkTheme}>
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
