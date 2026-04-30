import { View, Text, ScrollView, Image, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import * as repo from '@/db/repo';
import { useAppStore } from '@/stores/useAppStore';
import { displayDate } from '@/lib/date';
import * as haptic from '@/lib/haptic';
import { resolvePhotoUri } from '@/lib/photo_storage';
import type { BodyMeasurement } from '@/db/schema';

const FIELDS: { key: keyof BodyMeasurement; label: string; unit: string }[] = [
  { key: 'weightKg', label: '體重', unit: 'kg' },
  { key: 'bodyFatPct', label: '體脂率', unit: '%' },
  { key: 'skeletalMuscleKg', label: '骨骼肌量', unit: 'kg' },
  { key: 'muscleMassKg', label: '肌肉量', unit: 'kg' },
  { key: 'proteinKg', label: '蛋白質量', unit: 'kg' },
  { key: 'bodyFatKg', label: '體脂肪量', unit: 'kg' },
  { key: 'mineralKg', label: '骨鹽量', unit: 'kg' },
  { key: 'bodyWaterKg', label: '身體水分', unit: 'kg' },
  { key: 'bmr', label: '基礎代謝', unit: 'kcal' },
  { key: 'visceralFatLevel', label: '內臟脂肪', unit: '級' },
  { key: 'bodyScore', label: '身體分數', unit: '' },
];

export default function BodyDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [m, setM] = useState<BodyMeasurement | null>(null);
  const deleteFn = useAppStore((s) => s.deleteBodyMeasurement);

  useEffect(() => {
    (async () => {
      const r = await repo.getBodyMeasurement(Number(id));
      setM(r);
    })();
  }, [id]);

  if (!m) return null;

  const onDelete = () => {
    Alert.alert('刪除這筆紀錄？', displayDate(m.measuredAt), [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          haptic.warning();
          await deleteFn(m.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-kibo-bg" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-4">
        <Text className="text-kibo-mute text-xs">測量日期</Text>
        <Text className="text-kibo-text text-2xl font-bold mt-1">{displayDate(m.measuredAt)}</Text>
      </View>

      {(() => {
        const uri = resolvePhotoUri(m.photoUri);
        return uri ? (
          <View className="mb-4">
            <Image source={{ uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 16 }} resizeMode="contain" />
          </View>
        ) : null;
      })()}

      <Text className="text-kibo-text text-base font-bold mb-2">體組成</Text>
      <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-4">
        {FIELDS.map((f, i) => {
          const v = m[f.key];
          if (v == null) return null;
          return (
            <View key={f.key} className={`flex-row items-center justify-between py-2 ${i > 0 ? 'border-t border-kibo-card' : ''}`}>
              <Text className="text-kibo-mute text-sm">{f.label}</Text>
              <Text className="text-kibo-text font-semibold">
                {String(v)} <Text className="text-kibo-mute text-xs">{f.unit}</Text>
              </Text>
            </View>
          );
        })}
      </View>

      {m.note && (
        <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-4">
          <Text className="text-kibo-mute text-xs mb-1">備註</Text>
          <Text className="text-kibo-text">{m.note}</Text>
        </View>
      )}

      <Pressable
        onPress={onDelete}
        className="bg-kibo-danger/20 border border-kibo-danger rounded-2xl py-3"
      >
        <Text className="text-kibo-danger text-center font-semibold">刪除這筆紀錄</Text>
      </Pressable>
    </ScrollView>
  );
}
