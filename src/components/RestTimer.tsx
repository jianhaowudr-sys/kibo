import { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import * as haptic from '@/lib/haptic';

const PRESETS = [30, 60, 90, 120];

export function RestTimer({ autoStartKey }: { autoStartKey?: number }) {
  const [active, setActive] = useState(false);
  const [remaining, setRemaining] = useState(60);
  const [preset, setPreset] = useState(60);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (autoStartKey == null || autoStartKey === 0) return;
    setRemaining(preset);
    setActive(true);
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

  return (
    <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-kibo-mute text-xs">組間計時</Text>
        <Text className="text-kibo-text text-3xl font-bold">
          {Math.floor(remaining / 60)}:{(remaining % 60).toString().padStart(2, '0')}
        </Text>
      </View>
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
  );
}
