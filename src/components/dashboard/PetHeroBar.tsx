import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { PixelSprite } from '@/components/pet/PixelSprite';
import { framesForStage, STAGE_LABEL } from '@/lib/sprites/pet_stages';
import { EGG_FRAMES } from '@/lib/sprites/egg';
import { computePetMood, gatherActivity, type PetMood } from '@/lib/pet_messages';
import { useLowPower } from '@/hooks/useLowPower';
import * as haptic from '@/lib/haptic';

const MOOD_LABEL: Record<PetMood, string> = {
  energetic: '元氣滿滿',
  satisfied: '飽足滿意',
  happy: '心情不錯',
  concerned: '有點寂寞',
  missing: '想念你',
  worried: '擔心你',
  neutral: '一切正常',
};

const MOOD_TO_ANIM: Record<PetMood, 'idle' | 'happy' | 'sad'> = {
  energetic: 'happy',
  satisfied: 'happy',
  happy: 'idle',
  concerned: 'sad',
  missing: 'sad',
  worried: 'sad',
  neutral: 'idle',
};

export function PetHeroBar() {
  const palette = useThemePalette();
  const router = useRouter();
  const lowPower = useLowPower();
  const user = useAppStore((s) => s.user);
  const pet = useAppStore((s) => s.pets[0] ?? null);
  const egg = useAppStore((s) => s.activeEgg);
  const [mood, setMood] = useState<PetMood>('happy');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const a = await gatherActivity(user.id, pet?.id ?? null);
      setMood(computePetMood(a));
    })();
  }, [user?.id, pet?.id]);

  const showEgg = !pet && !!egg;
  const eggStage = egg
    ? egg.currentExp >= egg.requiredExp * 0.66 ? 2 : egg.currentExp >= egg.requiredExp * 0.33 ? 1 : 0
    : 0;
  const frames = showEgg
    ? [EGG_FRAMES[Math.min(eggStage, EGG_FRAMES.length - 1)]]
    : framesForStage(pet?.stage ?? 1, MOOD_TO_ANIM[mood] ?? 'idle');

  const onPress = () => {
    haptic.tapLight();
    router.push('/pet' as any);
  };

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.card,
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
        <PixelSprite frames={frames as any} scale={3} frameMs={500} paused={lowPower} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: palette.text, fontWeight: '700', fontSize: 16 }} numberOfLines={1}>
          {showEgg ? '蛋孵化中' : pet?.name ?? 'Kibo'}
        </Text>
        {showEgg ? (
          <Text style={{ color: palette.mute, fontSize: 12, marginTop: 2 }}>
            {egg!.currentExp} / {egg!.requiredExp} EXP
          </Text>
        ) : (
          <Text style={{ color: palette.mute, fontSize: 12, marginTop: 2 }}>
            {STAGE_LABEL[pet?.stage ?? 1] ?? '幼年'} · {MOOD_LABEL[mood]}
          </Text>
        )}
      </View>
      <Text style={{ color: palette.mute, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

export default PetHeroBar;
