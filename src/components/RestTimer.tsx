import { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as haptic from '@/lib/haptic';

const PRESETS = [30, 60, 90, 120];

/**
 * 組間計時。
 * - idle：薄 header（emoji + preset s + ▾）
 * - 手動展開（點 header）：顯示秒數預設按鈕 + 開始按鈕（用來預先選秒數）
 * - 計時中（autoStartKey 觸發 / 點開始）：**只**顯示倒數大字，隱藏所有按鈕
 *   倒數結束自動回到 idle 薄 header
 */
export function RestTimer({ autoStartKey }: { autoStartKey?: number }) {
  const [active, setActive] = useState(false);
  const [remaining, setRemaining] = useState(60);
  const [preset, setPreset] = useState(60);
  const [expanded, setExpanded] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (autoStartKey == null || autoStartKey === 0) return;
    setRemaining(preset);
    setActive(true);
    setExpanded(false);
  }, [autoStartKey]);

  useEffect(() => {
    if (!active) return;
    timer.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          haptic.success();
          setActive(false);
          return preset;
        }
        if (r === 4) haptic.tapLight();
        return r - 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [active, preset]);

  const start = () => {
    haptic.tapLight();
    setRemaining(preset);
    setActive(true);
    setExpanded(false);
  };

  const mmss = `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`;

  // 計時中：極簡大字倒數，無按鈕
  if (active) {
    return (
      <View className="bg-kibo-surface rounded-2xl border border-kibo-primary px-4 py-4 items-center">
        <Text className="text-kibo-mute text-[11px] mb-1">⏱ 組間休息</Text>
        <Text className="text-kibo-primary text-5xl font-bold">{mmss}</Text>
      </View>
    );
  }

  // idle：薄 header；展開時顯示秒數選擇 + 開始按鈕
  return (
    <View className="bg-kibo-surface rounded-2xl border border-kibo-card overflow-hidden">
      <Pressable
        onPress={() => { haptic.tapLight(); setExpanded((v) => !v); }}
        className="flex-row items-center justify-between px-4 py-2.5 active:opacity-70"
      >
        <Text className="text-kibo-mute text-xs">⏱ 組間計時</Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-kibo-mute text-xs font-bold">{preset}s</Text>
          <Text className="text-kibo-mute text-xs">{expanded ? '▴' : '▾'}</Text>
        </View>
      </Pressable>

      {expanded && (
        <View className="px-4 pb-4 pt-1 border-t border-kibo-card">
          <View className="flex-row gap-2 mb-3">
            {PRESETS.map((p) => (
              <Pressable
                key={p}
                onPress={() => {
                  haptic.tapLight();
                  setPreset(p);
                  setRemaining(p);
                }}
                className={`flex-1 py-2 rounded-xl ${preset === p ? 'bg-kibo-primary' : 'bg-kibo-card'}`}
              >
                <Text className={`text-center font-semibold ${preset === p ? 'text-kibo-bg' : 'text-kibo-text'}`}>
                  {p}s
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={start}
            className="bg-kibo-success rounded-xl py-3"
          >
            <Text className="text-kibo-bg text-center font-bold">開始休息</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
