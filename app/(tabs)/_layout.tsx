import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
  // 目前只有一個分頁，先隱藏 tab bar；之後新增分頁時再打開
  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}
    >
      <Tabs.Screen name="index" options={{ title: "整理" }} />
    </Tabs>
  );
}
