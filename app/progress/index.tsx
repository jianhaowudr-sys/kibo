import { View, Text, Pressable, FlatList, Image, Alert, Dimensions, ScrollView } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import * as haptic from '@/lib/haptic';
import { useAppStore } from '@/stores/useAppStore';
import { resolvePhotoUri } from '@/lib/photo_storage';
import { ANGLE_LABELS, ANGLE_ORDER } from '@/lib/progress_photo';
import type { ProgressPhoto } from '@/db/schema';
import { displayDate } from '@/lib/date';

type Angle = 'front' | 'side' | 'back';

const SCREEN_W = Dimensions.get('window').width;
const PLAY_INTERVAL_MS = 600;

export default function ProgressTimeline() {
  const router = useRouter();
  const refresh = useAppStore((s) => s.refreshProgressPhotos);
  const all = useAppStore((s) => s.progressPhotos);
  const remove = useAppStore((s) => s.deleteProgressPhoto);

  const [angle, setAngle] = useState<Angle>('front');
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const flatRef = useRef<FlatList<ProgressPhoto>>(null);
  const playTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  // ⚠ Zustand selector 不能回傳衍生 array — 在元件內 useMemo 篩選
  const photos = useMemo(
    () => all.filter((p) => p.angle === angle).sort((a, b) => +a.capturedAt - +b.capturedAt),
    [all, angle],
  );

  // angle 切換時重置 index
  useEffect(() => {
    setIndex(0);
    if (flatRef.current && photos.length > 0) {
      try { flatRef.current.scrollToIndex({ index: 0, animated: false }); } catch {}
    }
  }, [angle, photos.length]);

  // 播放邏輯
  useEffect(() => {
    if (!playing) return;
    if (index >= photos.length - 1) {
      setPlaying(false);
      return;
    }
    playTimer.current = setTimeout(() => {
      const next = Math.min(index + 1, photos.length - 1);
      try { flatRef.current?.scrollToIndex({ index: next, animated: true }); } catch {}
      setIndex(next);
    }, PLAY_INTERVAL_MS);
    return () => {
      if (playTimer.current) clearTimeout(playTimer.current);
    };
  }, [playing, index, photos.length]);

  const startPlay = () => {
    if (photos.length < 2) return;
    haptic.tapMedium();
    if (index >= photos.length - 1) {
      setIndex(0);
      try { flatRef.current?.scrollToIndex({ index: 0, animated: false }); } catch {}
    }
    setPlaying(true);
  };

  const stopPlay = () => {
    if (playTimer.current) clearTimeout(playTimer.current);
    setPlaying(false);
  };

  const onAdd = () => {
    haptic.tapLight();
    router.push('/progress/angle-picker' as any);
  };

  const current = photos[index] ?? null;
  const first = photos[0] ?? null;
  const weightDelta = current && first && current.weightKg != null && first.weightKg != null
    ? current.weightKg - first.weightKg
    : null;
  const bodyFatDelta = current && first && current.bodyFatPct != null && first.bodyFatPct != null
    ? current.bodyFatPct - first.bodyFatPct
    : null;

  const onDeleteCurrent = () => {
    if (!current) return;
    Alert.alert('刪除這張？', '無法復原。', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          haptic.warning();
          stopPlay();
          await remove(current.id);
          setIndex(0);
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-kibo-bg">
      {/* angle tabs */}
      <View className="flex-row gap-2 px-4 pt-3 pb-2">
        {ANGLE_ORDER.map((a) => {
          const active = angle === a;
          return (
            <Pressable
              key={a}
              onPress={() => { haptic.tapLight(); stopPlay(); setAngle(a); }}
              className={`px-4 py-2 rounded-xl ${active ? 'bg-kibo-primary' : 'bg-kibo-card'}`}
            >
              <Text className={`text-sm font-bold ${active ? 'text-kibo-bg' : 'text-kibo-text'}`}>
                {ANGLE_LABELS[a]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {photos.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-7xl mb-4">📸</Text>
          <Text className="text-kibo-text font-bold text-base mb-2">還沒拍 {ANGLE_LABELS[angle]}進度照</Text>
          <Text className="text-kibo-mute text-xs text-center mb-8">
            拍第一張開始追蹤，之後每張都會疊上一張當對齊參考。
          </Text>
          <Pressable
            onPress={() => {
              haptic.tapMedium();
              router.push({ pathname: '/progress/capture', params: { angle } } as any);
            }}
            className="bg-kibo-primary rounded-2xl px-8 py-4"
          >
            <Text className="text-kibo-bg font-bold">拍第一張</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FlatList
            ref={flatRef}
            data={photos}
            keyExtractor={(p) => String(p.id)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
              if (i !== index) setIndex(i);
            }}
            getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
            renderItem={({ item }) => {
              const uri = resolvePhotoUri(item.photoUri);
              return (
                <View style={{ width: SCREEN_W, aspectRatio: 3 / 4, backgroundColor: '#000' }}>
                  {uri ? (
                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <Text className="text-kibo-mute text-xs">⚠ 照片已遺失</Text>
                    </View>
                  )}
                </View>
              );
            }}
          />

          {/* meta row */}
          <View className="px-4 pt-3">
            {current && (
              <>
                <Text className="text-kibo-text text-base font-bold">
                  {displayDate(current.capturedAt)}
                </Text>
                <View className="flex-row gap-3 mt-1">
                  {current.weightKg != null && (
                    <Text className="text-kibo-mute text-xs">{current.weightKg.toFixed(1)} kg</Text>
                  )}
                  {current.bodyFatPct != null && (
                    <Text className="text-kibo-mute text-xs">體脂 {current.bodyFatPct.toFixed(1)}%</Text>
                  )}
                </View>
                {(weightDelta != null || bodyFatDelta != null) && index > 0 && (
                  <View className="flex-row gap-3 mt-1">
                    {weightDelta != null && (
                      <Text className={`text-xs ${weightDelta < 0 ? 'text-kibo-success' : 'text-kibo-danger'}`}>
                        {weightDelta > 0 ? '↑' : '↓'} {Math.abs(weightDelta).toFixed(1)} kg vs 第一張
                      </Text>
                    )}
                    {bodyFatDelta != null && (
                      <Text className={`text-xs ${bodyFatDelta < 0 ? 'text-kibo-success' : 'text-kibo-danger'}`}>
                        體脂 {bodyFatDelta > 0 ? '↑' : '↓'} {Math.abs(bodyFatDelta).toFixed(1)}%
                      </Text>
                    )}
                  </View>
                )}
                {current.note && (
                  <Text className="text-kibo-mute text-xs mt-2 italic">{current.note}</Text>
                )}
              </>
            )}
          </View>

          {/* dot row — tap to jump */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 px-4" contentContainerStyle={{ alignItems: 'center', gap: 8 }}>
            {photos.map((p, i) => (
              <Pressable
                key={p.id}
                onPress={() => {
                  haptic.tapLight();
                  stopPlay();
                  try { flatRef.current?.scrollToIndex({ index: i, animated: true }); } catch {}
                  setIndex(i);
                }}
                style={{
                  width: i === index ? 14 : 8,
                  height: i === index ? 14 : 8,
                  borderRadius: 7,
                  backgroundColor: i === index ? '#fff' : 'rgba(255,255,255,0.4)',
                }}
              />
            ))}
          </ScrollView>

          {/* action bar */}
          <View className="flex-row gap-3 px-4 pt-4 pb-6">
            <Pressable
              onPress={onAdd}
              className="flex-1 bg-kibo-surface rounded-2xl p-3 border border-kibo-card items-center"
            >
              <Text className="text-kibo-text font-semibold text-xs">＋ 新增</Text>
            </Pressable>
            <Pressable
              onPress={playing ? stopPlay : startPlay}
              disabled={photos.length < 2}
              className={`flex-1 rounded-2xl p-3 border items-center ${
                photos.length < 2
                  ? 'bg-kibo-card border-kibo-card'
                  : playing
                    ? 'bg-kibo-danger border-kibo-danger'
                    : 'bg-kibo-primary border-kibo-primary'
              }`}
            >
              <Text className={`font-semibold text-xs ${
                photos.length < 2 ? 'text-kibo-mute' : playing ? 'text-white' : 'text-kibo-bg'
              }`}>
                {playing ? '■ 停止' : '▶ 播放'}
              </Text>
            </Pressable>
            <Pressable
              onPress={onDeleteCurrent}
              className="flex-1 bg-kibo-surface rounded-2xl p-3 border border-kibo-card items-center"
            >
              <Text className="text-kibo-danger font-semibold text-xs">🗑 刪除</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
