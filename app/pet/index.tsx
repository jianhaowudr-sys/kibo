import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { PetScene } from '@/components/pet/PetScene';
import { computePetMood, gatherActivity } from '@/lib/pet_messages';
import type { PetAnimation } from '@/lib/sprites/pet';

const MOOD_TO_ANIM: Record<string, PetAnimation> = {
  energetic: 'happy',
  satisfied: 'happy',
  happy: 'idle',
  concerned: 'sad',
  missing: 'sad',
  worried: 'sad',
  neutral: 'idle',
};

export default function PetPage() {
  const palette = useThemePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const pet = useAppStore((s) => s.pets[0] ?? null);
  const egg = useAppStore((s) => s.activeEgg);
  const messages = useAppStore((s) => s.petMessages);

  const [moodAnim, setMoodAnim] = useState<PetAnimation>('idle');
  const [tappedAt, setTappedAt] = useState(0);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const activity = await gatherActivity(user.id, pet?.id ?? null);
      const mood = computePetMood(activity);
      setMoodAnim(MOOD_TO_ANIM[mood] ?? 'idle');
    })();
  }, [user?.id, pet?.id]);

  // 點寵物 → 短暫變 happy
  useEffect(() => {
    if (!tappedAt) return;
    const baseMood = moodAnim;
    setMoodAnim('happy');
    const t = setTimeout(() => setMoodAnim(baseMood), 1500);
    return () => clearTimeout(t);
  }, [tappedAt]);

  const showEgg = !pet && !!egg;
  const eggStage = egg
    ? egg.currentExp >= egg.requiredExp * 0.66 ? 2 : egg.currentExp >= egg.requiredExp * 0.33 ? 1 : 0
    : 0;

  const latest = messages[0];

  return (
    <View style={{ flex: 1 }}>
      <PetScene
        mood={moodAnim}
        showEgg={showEgg}
        eggStage={eggStage}
        onTap={() => setTappedAt(Date.now())}
      />

      {/* 上方資訊 bar */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        backgroundColor: palette.surface, paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 16,
        borderBottomWidth: 1, borderBottomColor: palette.card,
        flexDirection: 'row', alignItems: 'center',
      }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }} accessibilityRole="button" accessibilityLabel="返回">
          <Text style={{ fontSize: 18, color: palette.text }}>←</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/pet/inventory' as any)}
          accessibilityRole="button" accessibilityLabel="開啟圖鑑"
          style={{ marginRight: 12, backgroundColor: palette.card, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}
        >
          <Text style={{ color: palette.text, fontSize: 12, fontWeight: '700' }}>📒 圖鑑</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          {showEgg ? (
            <>
              <Text style={{ color: palette.text, fontWeight: '700', fontSize: 14 }}>蛋孵化中</Text>
              <Text style={{ color: palette.mute, fontSize: 11 }}>{egg!.currentExp} / {egg!.requiredExp} EXP</Text>
            </>
          ) : (
            <>
              <Text style={{ color: palette.text, fontWeight: '700', fontSize: 14, fontFamily: 'Cubic11' }}>
                {pet?.name ?? 'Kibo'}
              </Text>
              <Text style={{ color: palette.mute, fontSize: 11 }}>
                Lv.{pet?.level ?? 1} · 階段 {pet?.stage ?? 1} / 5
              </Text>
              {pet && pet.stage < 5 && (() => {
                const nextStageExp = pet.stage * 1000;
                const remaining = Math.max(0, nextStageExp - pet.exp);
                const pctInStage = Math.min(100, ((pet.exp - (pet.stage - 1) * 1000) / 1000) * 100);
                return (
                  <View style={{ marginTop: 4 }}>
                    <View style={{ height: 4, backgroundColor: palette.card, borderRadius: 2, overflow: 'hidden' }}>
                      <View style={{ height: '100%', width: `${pctInStage}%`, backgroundColor: palette.primary }} />
                    </View>
                    <Text style={{ color: palette.mute, fontSize: 9, marginTop: 2 }}>
                      下一階段需 {remaining} EXP（運動/飲食/睡眠等任何紀錄都餵）
                    </Text>
                  </View>
                );
              })()}
              {pet && pet.stage >= 5 && (
                <Text style={{ color: palette.success, fontSize: 9, marginTop: 2, fontWeight: '700' }}>
                  ✦ 已滿階段 — 下次孵新蛋換新寵
                </Text>
              )}
            </>
          )}
        </View>
      </View>

      {/* 底部訊息 */}
      {latest && (
        <View style={{
          position: 'absolute', bottom: 16, left: 16, right: 16,
          backgroundColor: palette.surface,
          padding: 12, borderRadius: 12,
          borderWidth: 2, borderColor: palette.primary,
        }}>
          <Text style={{ color: palette.text, fontSize: 13, fontFamily: 'Cubic11' }}>
            {latest.text}
          </Text>
        </View>
      )}
    </View>
  );
}
