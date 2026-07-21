import { Tabs } from 'expo-router';
import { Text, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStyle } from '@/hooks/useThemeStyle';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // 改用 useThemeStyle：原本只 import THEME_COLORS + 自己 resolve，
  // 導致「像素風」模式下 tab bar 連 PICO-8 色票都沒吃到（與全 App 配色不同步）。
  const { palette, isPixel } = useThemeStyle();
  const tabBarHeight = (Platform.OS === 'ios' ? 56 : 60) + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        sceneStyle: { backgroundColor: palette.bg },
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: isPixel ? palette.text : palette.card,
          // 不可用 undefined：tabBarStyle 是 style 陣列最後一個，flattenStyle 會無條件覆寫，
          // undefined 會把 @react-navigation 預設的 hairline 邊框整個抹掉（modern 模式變沒有上框）。
          borderTopWidth: isPixel ? 3 : StyleSheet.hairlineWidth,
          paddingTop: 8,
          paddingBottom: insets.bottom || 8,
          height: tabBarHeight,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          marginTop: 2,
          ...(isPixel ? { fontFamily: 'Cubic11' } : {}),
        },
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.mute,
        headerStyle: { backgroundColor: palette.bg },
        headerTitleStyle: { color: palette.text },
        headerTintColor: palette.text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '首頁',
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="routines"
        options={{
          title: '課表',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="diet"
        options={{
          title: '飲食',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🍱" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: '我',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
