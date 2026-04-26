import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
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
        backgroundColor: 'rgba(255,241,232,0.8)', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16,
        borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)',
        flexDirection: 'row', alignItems: 'center',
      }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/pet/inventory' as any)}
          style={{ marginRight: 12, backgroundColor: '#1d2b53', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff1e8', fontSize: 12, fontWeight: '700' }}>📒 圖鑑</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          {showEgg ? (
            <>
              <Text style={{ color: '#1d2b53', fontWeight: '700', fontSize: 14 }}>蛋孵化中</Text>
              <Text style={{ color: '#83769c', fontSize: 11 }}>{egg!.currentExp} / {egg!.requiredExp} EXP</Text>
            </>
          ) : (
            <>
              <Text style={{ color: '#1d2b53', fontWeight: '700', fontSize: 14, fontFamily: 'Cubic11' }}>
                {pet?.name ?? 'Kibo'}
              </Text>
              <Text style={{ color: '#83769c', fontSize: 11 }}>Lv.{pet?.level ?? 1} · 階段 {pet?.stage ?? 1}</Text>
            </>
          )}
        </View>
      </View>

      {/* 底部訊息 */}
      {latest && (
        <View style={{
          position: 'absolute', bottom: 16, left: 16, right: 16,
          backgroundColor: 'rgba(255,241,232,0.95)',
          padding: 12, borderRadius: 12,
          borderWidth: 2, borderColor: '#1d2b53',
        }}>
          <Text style={{ color: '#1d2b53', fontSize: 13, fontFamily: 'Cubic11' }}>
            {latest.text}
          </Text>
        </View>
      )}
    </View>
  );
}
