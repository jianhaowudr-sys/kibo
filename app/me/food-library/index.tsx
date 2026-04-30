import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, FlatList, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { SwipeableRow } from '@/components/common/SwipeableRow';
import * as haptic from '@/lib/haptic';
import { resolvePhotoUri } from '@/lib/photo_storage';

export default function FoodLibraryList() {
  const palette = useThemePalette();
  const router = useRouter();
  const customFoods = useAppStore((s) => s.customFoods);
  const refreshCustomFoods = useAppStore((s) => s.refreshCustomFoods);
  const deleteCustomFood = useAppStore((s) => s.deleteCustomFood);
  const addCustomFood = useAppStore((s) => s.addCustomFood);
  const pushUndo = useAppStore((s) => s.pushUndo);

  const [q, setQ] = useState('');

  useFocusEffect(useCallback(() => {
    refreshCustomFoods(q);
  }, [refreshCustomFoods, q]));

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="搜尋食物名稱..."
            placeholderTextColor={palette.placeholder}
            style={{
              flex: 1, backgroundColor: palette.surface, color: palette.text,
              padding: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.card,
            }}
          />
          <Pressable
            onPress={() => { haptic.tapLight(); router.push('/me/food-library/new' as any); }}
            style={{ backgroundColor: palette.primary, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 }}
          >
            <Text style={{ color: palette.bg, fontWeight: '700' }}>+ 新增</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={customFoods}
        keyExtractor={(it) => String(it.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🍽</Text>
            <Text style={{ color: palette.text, fontWeight: '700', marginBottom: 4 }}>尚未建立食物</Text>
            <Text style={{ color: palette.mute, fontSize: 12, textAlign: 'center' }}>
              建立常吃食物（高蛋白、飯糰等）{'\n'}下次記錄餐點時直接選用，不必再拍照
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <SwipeableRow
            onDelete={async () => {
              const snapshot = { ...item };
              await deleteCustomFood(item.id);
              pushUndo({
                id: `food-restore-${item.id}`,
                type: 'food',
                message: `已刪除 ${item.name}`,
                undo: async () => {
                  await addCustomFood({
                    name: snapshot.name,
                    emoji: snapshot.emoji,
                    caloriesKcal: snapshot.caloriesKcal,
                    proteinG: snapshot.proteinG,
                    carbG: snapshot.carbG,
                    fatG: snapshot.fatG,
                    portion: snapshot.portion,
                    photoUri: snapshot.photoUri,
                    source: snapshot.source as any,
                  });
                },
              });
            }}
          >
            <Pressable
              onPress={() => router.push(`/me/food-library/${item.id}` as any)}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: palette.surface, padding: 12,
                borderRadius: 12, marginBottom: 6,
                borderWidth: 1, borderColor: palette.card,
              }}
            >
              {(() => {
                const uri = resolvePhotoUri(item.photoUri);
                return uri ? (
                  <Image source={{ uri }} style={{ width: 44, height: 44, borderRadius: 8, marginRight: 12 }} />
                ) : (
                  <Text style={{ fontSize: 32, marginRight: 12 }}>{item.emoji}</Text>
                );
              })()}
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: '700' }}>{item.name}</Text>
                <Text style={{ color: palette.mute, fontSize: 11 }}>
                  {item.caloriesKcal} kcal · 蛋白 {item.proteinG}g
                  {item.portion ? ` · ${item.portion}` : ''}
                </Text>
                {item.useCount > 0 && (
                  <Text style={{ color: palette.success, fontSize: 10, marginTop: 2 }}>
                    用過 {item.useCount} 次
                  </Text>
                )}
              </View>
              <Text style={{ color: palette.mute }}>›</Text>
            </Pressable>
          </SwipeableRow>
        )}
      />
    </View>
  );
}
