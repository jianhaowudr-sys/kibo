import { Tabs } from 'expo-router';
import { Text, Platform, useColorScheme as useSystemColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME_COLORS, type ThemeMode, type ResolvedTheme } from '@/lib/theme';
import { useAppStore } from '@/stores/useAppStore';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

function resolve(mode: ThemeMode, system: 'light' | 'dark' | null | undefined): ResolvedTheme {
  if (mode === 'system') return system === 'light' ? 'light' : 'dark';
  return mode;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const systemScheme = useSystemColorScheme();
  const themeMode = useAppStore((s) => s.themeMode);

  const theme = resolve(themeMode, systemScheme);
  const palette = THEME_COLORS[theme];
  const tabBarHeight = (Platform.OS === 'ios' ? 56 : 60) + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        sceneStyle: { backgroundColor: palette.bg },
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.card,
          paddingTop: 8,
          paddingBottom: insets.bottom || 8,
          height: tabBarHeight,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          marginTop: 2,
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
