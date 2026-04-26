import React, { useMemo } from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import { PixelSprite } from './PixelSprite';
import { type PetAnimation } from '@/lib/sprites/pet';
import { framesForStage, STAGE_LABEL } from '@/lib/sprites/pet_stages';
import { EGG_FRAMES } from '@/lib/sprites/egg';
import { useThemePalette } from '@/lib/useThemePalette';
import { useAppStore } from '@/stores/useAppStore';
import * as haptic from '@/lib/haptic';

type Props = {
  /** 寵物心情，決定動畫 */
  mood?: PetAnimation;
  /** 點寵物的回呼（摸頭） */
  onTap?: () => void;
  /** 顯示蛋而非寵物（孵化前） */
  showEgg?: boolean;
  /** 蛋的 stage 0~2 */
  eggStage?: number;
};

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * 全螢幕寵物場景：
 *  - 上方：天空（漸層）
 *  - 中央：寵物 sprite，按心情切換動畫
 *  - 下方：地面（像素草地）
 *  - 點寵物：tap 動畫 + 觸覺
 */
export function PetScene({ mood = 'idle', onTap, showEgg, eggStage = 0 }: Props) {
  const palette = useThemePalette();
  const pet = useAppStore((s) => s.pets[0] ?? null);
  const settings = useAppStore((s) => s.healthSettings);

  const stage = pet?.stage ?? 1;
  const frames = useMemo(() => {
    if (showEgg) return [EGG_FRAMES[Math.min(eggStage, EGG_FRAMES.length - 1)]];
    return framesForStage(stage, mood);
  }, [showEgg, eggStage, mood, stage]);

  const scale = Math.floor((SCREEN_W * 0.7) / 16);
  const isMaster = stage >= 5;

  // 簡單的天空 + 地面背景（純色，未來可換成 background sprite）
  return (
    <View style={{ flex: 1, backgroundColor: '#a8d4ff' }}>
      {/* 雲層裝飾 */}
      <View style={{ position: 'absolute', top: 60, left: 30 }}>
        <Cloud color={palette.bg} />
      </View>
      <View style={{ position: 'absolute', top: 100, right: 40 }}>
        <Cloud color={palette.bg} small />
      </View>

      {/* 主舞台 */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 80 }}>
        {isMaster && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: scale * 22,
              height: scale * 22,
              borderRadius: scale * 11,
              backgroundColor: '#ff77a8',
              opacity: 0.18,
            }}
          />
        )}
        <Pressable
          onPress={() => {
            haptic.tapMedium();
            onTap?.();
          }}
        >
          <PixelSprite frames={frames as any} scale={scale} frameMs={500} />
        </Pressable>
        {!showEgg && pet && (
          <>
            <Text style={{ marginTop: 16, fontSize: 18, fontWeight: '700', color: '#1d2b53', fontFamily: 'Cubic11' }}>
              {pet.name}
            </Text>
            <Text style={{ marginTop: 4, fontSize: 11, color: '#83769c' }}>
              {STAGE_LABEL[stage] ?? `階段 ${stage}`} · 心情 {moodLabel(mood)}
            </Text>
          </>
        )}
      </View>

      {/* 地面 */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 80, backgroundColor: '#7eb852',
      }}>
        <View style={{
          height: 6, backgroundColor: '#5fa840',
        }} />
      </View>
    </View>
  );
}

function Cloud({ color, small }: { color: string; small?: boolean }) {
  const s = small ? 4 : 6;
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: s * 4, height: s * 2, backgroundColor: color, borderRadius: s }} />
      <View style={{ position: 'absolute', left: s, top: -s, width: s * 3, height: s * 2, backgroundColor: color, borderRadius: s }} />
    </View>
  );
}

function moodLabel(m: PetAnimation): string {
  const map: Record<PetAnimation, string> = {
    idle: '正常 🙂',
    happy: '開心 😊',
    sad: '低落 🥺',
    sleep: '睡覺 💤',
    eat: '吃東西 🍴',
  };
  return map[m] ?? '正常';
}

export default PetScene;
