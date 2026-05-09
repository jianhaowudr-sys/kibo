import { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as haptic from '@/lib/haptic';

const PRESETS = [15, 30, 60, 90, 120];

/**
 * 動作執行倒數計時器（v1.0.5）。
 *
 * 跟 RestTimer 類似但用途不同：
 * - RestTimer：完成一組後 auto-start，提醒組間休息結束
 * - ExerciseTimer：使用者手動 start，幫看 plank/HIIT 等動作執行時的秒數
 *
 * 倒數結束不自動 commit set；使用者撐完後自己按「完成這組」既有按鈕。
 *
 * - idle：薄 header（emoji + preset s + ▾）
 * - 展開：選秒數 + 開始按鈕
 * - 倒數中：大字倒數 + 中斷按鈕
 */
export function ExerciseTimer({ initialSec = 60 }: { initialSec?: number }) {
  const [active, setActive] = useState(false);
  const [remaining, setRemaining] = useState(initialSec);
  const [preset, setPreset] = useState(initialSec);
  const [expanded, setExpanded] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // initialSec 改變（切換動作）時，idle 狀態同步 preset
  useEffect(() => {
    if (!active) {
      setPreset(initialSec);
      setRemaining(initialSec);
    }
  }, [initialSec, active]);

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
    haptic.tapMedium();
    setRemaining(preset);
    setActive(true);
    setExpanded(false);
  };
  const stop = () => {
    haptic.tapLight();
    setActive(false);
    setRemaining(preset);
  };

  const mmss = `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`;

  if (active) {
    return (
      <View className="bg-kibo-surface rounded-2xl border border-kibo-success px-4 py-4 items-center">
        <Text className="text-kibo-mute text-[11px] mb-1">⏱ 動作倒數</Text>
        <Text className="text-kibo-success text-5xl font-bold">{mmss}</Text>
        <Pressable onPress={stop} className="mt-3 px-4 py-1.5 rounded-full bg-kibo-card">
          <Text className="text-kibo-mute text-xs">中斷</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="bg-kibo-surface rounded-2xl border border-kibo-card overflow-hidden">
      <Pressable
        onPress={() => { haptic.tapLight(); setExpanded((v) => !v); }}
        className="flex-row items-center justify-between px-4 py-2.5 active:opacity-70"
      >
        <Text className="text-kibo-mute text-xs">⏱ 動作倒數</Text>
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
                className={`flex-1 py-2 rounded-xl ${preset === p ? 'bg-kibo-success' : 'bg-kibo-card'}`}
              >
                <Text className={`text-center font-semibold text-xs ${preset === p ? 'text-kibo-bg' : 'text-kibo-text'}`}>
                  {p}s
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={start}
            className="bg-kibo-success rounded-xl py-3"
          >
            <Text className="text-kibo-bg text-center font-bold">開始倒數</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
