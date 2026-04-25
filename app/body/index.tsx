import { View, Text, ScrollView, Pressable, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { displayDate } from '@/lib/date';
import * as haptic from '@/lib/haptic';
import type { BodyMeasurement } from '@/db/schema';

type Trend = { label: string; unit: string; getter: (m: BodyMeasurement) => number | null; color: string };

const TRENDS: Trend[] = [
  { label: '體重', unit: 'kg', getter: (m) => m.weightKg, color: 'bg-kibo-primary' },
  { label: '體脂率', unit: '%', getter: (m) => m.bodyFatPct, color: 'bg-kibo-danger' },
  { label: '骨骼肌量', unit: 'kg', getter: (m) => m.skeletalMuscleKg, color: 'bg-kibo-success' },
];

function TrendMiniChart({ values, max, min, color }: { values: number[]; max: number; min: number; color: string }) {
  const range = Math.max(0.0001, max - min);
  return (
    <View className="flex-row items-end justify-between h-16 gap-0.5">
      {values.map((v, i) => {
        const h = ((v - min) / range) * 100;
        return (
          <View key={i} style={{ flex: 1, height: `${Math.max(10, h)}%` }} className={`${color} rounded-t`} />
        );
      })}
    </View>
  );
}

export default function BodyHistory() {
  const router = useRouter();
  const list = useAppStore((s) => s.bodyMeasurements);
  const refresh = useAppStore((s) => s.refreshBodyMeasurements);
  const remove = useAppStore((s) => s.deleteBodyMeasurement);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const trends = useMemo(() => {
    const ordered = [...list].reverse();
    return TRENDS.map((t) => {
      const values = ordered.map(t.getter).filter((v): v is number => v != null);
      if (values.length < 2) return { ...t, values: [] as number[], latest: null, change: null };
      const latest = values[values.length - 1];
      const first = values[0];
      return {
        ...t,
        values,
        latest,
        change: latest - first,
        max: Math.max(...values),
        min: Math.min(...values),
      };
    });
  }, [list]);

  const onDelete = (id: number) => {
    Alert.alert('刪除這筆紀錄？', '', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          haptic.warning();
          await remove(id);
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-kibo-bg">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Pressable
          onPress={() => {
            haptic.tapMedium();
            router.push('/body/new' as any);
          }}
          className="bg-kibo-primary rounded-2xl py-4 mb-4 active:opacity-70"
        >
          <Text className="text-kibo-bg text-center font-bold">＋ 新增 InBody 紀錄</Text>
        </Pressable>

        {list.length >= 2 && (
          <>
            <Text className="text-kibo-text text-lg font-bold mb-2">📈 趨勢</Text>
            <View className="gap-2 mb-4">
              {trends.map((t: any) => (
                <View key={t.label} className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-kibo-text font-semibold">{t.label}</Text>
                    {t.latest != null && (
                      <View className="flex-row items-baseline gap-2">
                        <Text className="text-kibo-text text-xl font-bold">{t.latest}</Text>
                        <Text className="text-kibo-mute text-xs">{t.unit}</Text>
                        {t.change != null && (
                          <Text className={`text-xs font-semibold ${t.change > 0 ? 'text-kibo-success' : t.change < 0 ? 'text-kibo-danger' : 'text-kibo-mute'}`}>
                            {t.change > 0 ? '+' : ''}{t.change.toFixed(1)}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  {t.values.length >= 2 && (
                    <TrendMiniChart values={t.values} max={t.max} min={t.min} color={t.color} />
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        <Text className="text-kibo-text text-lg font-bold mb-2">
          紀錄 {list.length > 0 && `(${list.length})`}
        </Text>

        {list.length === 0 && (
          <View className="bg-kibo-surface rounded-2xl p-8 border border-kibo-card items-center">
            <Text className="text-5xl mb-2">📸</Text>
            <Text className="text-kibo-text font-semibold">還沒有 InBody 紀錄</Text>
            <Text className="text-kibo-mute text-xs text-center mt-1">
              拍照上傳 InBody 報告 → AI 自動判讀
            </Text>
          </View>
        )}

        <View className="gap-2">
          {list.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => {
                haptic.tapLight();
                router.push({ pathname: '/body/[id]' as any, params: { id: String(m.id) } });
              }}
              onLongPress={() => onDelete(m.id)}
              className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card flex-row items-center gap-3 active:opacity-70"
            >
              {m.photoUri ? (
                <Image source={{ uri: m.photoUri }} style={{ width: 56, height: 56, borderRadius: 12 }} />
              ) : (
                <View className="w-14 h-14 bg-kibo-card rounded-xl items-center justify-center">
                  <Text className="text-2xl">📊</Text>
                </View>
              )}
              <View className="flex-1">
                <Text className="text-kibo-text font-semibold">
                  {displayDate(m.measuredAt)}
                </Text>
                <Text className="text-kibo-mute text-xs mt-0.5">
                  {m.weightKg ? `${m.weightKg}kg` : ''}
                  {m.bodyFatPct != null ? ` · 體脂 ${m.bodyFatPct}%` : ''}
                  {m.skeletalMuscleKg ? ` · 肌肉 ${m.skeletalMuscleKg}kg` : ''}
                </Text>
              </View>
              <Text className="text-kibo-primary">›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
