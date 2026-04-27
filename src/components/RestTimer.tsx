import { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as haptic from '@/lib/haptic';

const PRESETS = [30, 60, 90, 120];

/**
 * 組間計時。預設收合（只顯示薄 header），點 header 展開秒數選擇 + 開始按鈕。
 * 計時啟動中（autoStartKey 觸發 / 點開始）時會自動展開，方便看倒數。
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
    setExpanded(true);
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
  };
  const stop = () => {
    haptic.tapLight();
    setActive(false);
    setRemaining(preset);
  };

  const mmss = `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`;

  return (
    <View className="bg-kibo-surface rounded-2xl border border-kibo-card overflow-hidden">
      {/* 永遠顯示的薄 header（點擊展開/收合） */}
      <Pressable
        onPress={() => { haptic.tapLight(); setExpanded((v) => !v); }}
        className="flex-row items-center justify-between px-4 py-2.5 active:opacity-70"
      >
        <Text className="text-kibo-mute text-xs">⏱ 組間計時</Text>
        <View className="flex-row items-center gap-2">
          <Text className={`font-bold ${active ? 'text-kibo-primary text-base' : 'text-kibo-mute text-xs'}`}>
            {active ? mmss : `${preset}s`}
          </Text>
          <Text className="text-kibo-mute text-xs">{expanded ? '▴' : '▾'}</Text>
        </View>
      </Pressable>

      {expanded && (
        <View className="px-4 pb-4 pt-1 border-t border-kibo-card">
          {active && (
            <Text className="text-kibo-text text-3xl font-bold text-center mb-3">{mmss}</Text>
          )}
          <View className="flex-row gap-2 mb-3">
            {PRESETS.map((p) => (
              <Pressable
                key={p}
                onPress={() => {
                  haptic.tapLight();
                  setPreset(p);
                  setRemaining(p);
                  setActive(false);
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
            onPress={active ? stop : start}
            className={`${active ? 'bg-kibo-danger' : 'bg-kibo-success'} rounded-xl py-3`}
          >
            <Text className="text-kibo-bg text-center font-bold">
              {active ? '停止' : '開始休息'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
