import { View, Text, Pressable, TextInput, Animated, Easing } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import * as haptic from '@/lib/haptic';
import { useThemePalette } from '@/lib/useThemePalette';

export default function HatchScreen() {
  const palette = useThemePalette();
  const router = useRouter();
  const pending = useAppStore((s) => s.pendingHatch);
  const confirmHatch = useAppStore((s) => s.confirmHatch);

  const [stage, setStage] = useState<'shaking' | 'cracking' | 'hatched' | 'naming'>('shaking');
  const [petName, setPetName] = useState('');

  const shake = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pending) {
      router.back();
      return;
    }
    setPetName(pending.petName);

    Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 80, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]),
      { iterations: 10 },
    ).start();

    const t1 = setTimeout(() => {
      haptic.tapHeavy();
      setStage('cracking');
    }, 1500);

    const t2 = setTimeout(() => {
      haptic.success();
      setStage('hatched');
      Animated.parallel([
        Animated.timing(scale, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 2800);

    const t3 = setTimeout(() => {
      setStage('naming');
    }, 3500);

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
    };
  }, [pending, router, shake, scale, opacity]);

  if (!pending) return null;

  const onConfirm = async () => {
    haptic.success();
    await confirmHatch(petName.trim() || pending.petName);
    router.back();
  };

  const translateX = shake.interpolate({
    inputRange: [-1, 1],
    outputRange: [-10, 10],
  });

  return (
    <View className="flex-1 bg-kibo-bg items-center justify-center p-6">
      {stage !== 'naming' && (
        <>
          <Text className="text-kibo-mute text-sm mb-6">✨ 蛋要孵化了 ✨</Text>
          <Animated.Text
            style={{
              fontSize: 160,
              transform: [{ translateX }, { scale }],
              opacity,
            }}
          >
            🥚
          </Animated.Text>
          {stage === 'cracking' && (
            <Text className="text-kibo-accent text-2xl font-bold mt-4 animate-pulse">
              CRACK! ⚡
            </Text>
          )}
          {stage === 'hatched' && (
            <Text className="text-9xl mt-2">{pending.emoji}</Text>
          )}
        </>
      )}

      {stage === 'naming' && (
        <>
          <Text className="text-kibo-accent text-sm mb-2">🎉 恭喜孵化</Text>
          <Text className="text-9xl mb-4">{pending.emoji}</Text>
          <Text className="text-kibo-text text-2xl font-bold mb-6">{pending.petName}</Text>

          <View className="w-full max-w-sm">
            <Text className="text-kibo-mute text-xs mb-2">給牠取個名字吧：</Text>
            <TextInput
              value={petName}
              onChangeText={setPetName}
              placeholder={pending.petName}
              placeholderTextColor={palette.placeholder}
              maxLength={12}
              className="bg-kibo-surface text-kibo-text rounded-xl px-4 py-3 mb-4 border border-kibo-card text-center text-lg"
            />
            <Pressable
              onPress={onConfirm}
              className="bg-kibo-primary rounded-2xl py-4"
            >
              <Text className="text-kibo-bg text-center font-bold text-lg">
                開始夥伴旅程 →
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
