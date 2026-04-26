import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import * as repo from '@/db/repo';
import * as haptic from '@/lib/haptic';
import { BOTTOM_BAR_PADDING } from '@/lib/layout';
import type { CustomFood } from '@/db/schema';

const EMOJI_PRESETS = ['🍽', '🥤', '🍞', '🍙', '🍱', '🥩', '🍣', '🥗', '🍔', '🍕', '🍜', '🥛', '🍫', '🥐', '🍎', '🥑', '🍳', '🍰'];

export default function EditCustomFood() {
  const palette = useThemePalette();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const foodId = Number(id);
  const updateCustomFood = useAppStore((s) => s.updateCustomFood);

  const [food, setFood] = useState<CustomFood | null>(null);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🍽');
  const [calories, setCalories] = useState('0');
  const [protein, setProtein] = useState('0');
  const [carb, setCarb] = useState('0');
  const [fat, setFat] = useState('0');
  const [portion, setPortion] = useState('');

  useEffect(() => {
    (async () => {
      const f = await repo.getCustomFood(foodId);
      if (!f) { router.back(); return; }
      setFood(f);
      setName(f.name);
      setEmoji(f.emoji);
      setCalories(String(f.caloriesKcal));
      setProtein(String(f.proteinG));
      setCarb(String(f.carbG));
      setFat(String(f.fatG));
      setPortion(f.portion ?? '');
    })();
  }, [foodId]);

  const onSave = async () => {
    if (!name.trim()) { Alert.alert('請輸入食物名稱'); return; }
    haptic.success();
    await updateCustomFood(foodId, {
      name: name.trim(),
      emoji,
      caloriesKcal: Number(calories) || 0,
      proteinG: Number(protein) || 0,
      carbG: Number(carb) || 0,
      fatG: Number(fat) || 0,
      portion: portion.trim() || null,
    });
    router.back();
  };

  if (!food) return null;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_BAR_PADDING }}>
        {food.useCount > 0 && (
          <Text style={{ color: palette.success, fontSize: 11, marginBottom: 12 }}>
            已用過 {food.useCount} 次
          </Text>
        )}

        <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>名稱</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={{ backgroundColor: palette.surface, color: palette.text, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: palette.card, marginBottom: 12 }}
        />

        <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>圖示</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {EMOJI_PRESETS.map((e) => (
            <Pressable
              key={e}
              onPress={() => { haptic.tapLight(); setEmoji(e); }}
              style={{
                width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
                borderRadius: 8,
                backgroundColor: emoji === e ? palette.primary : palette.surface,
                borderWidth: 1, borderColor: palette.card,
              }}
            >
              <Text style={{ fontSize: 22 }}>{e}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>份量描述</Text>
        <TextInput
          value={portion}
          onChangeText={setPortion}
          placeholder="例如：1 份 30g"
          placeholderTextColor={palette.placeholder}
          style={{ backgroundColor: palette.surface, color: palette.text, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: palette.card, marginBottom: 12 }}
        />

        <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>每份營養</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.mute, fontSize: 10, marginBottom: 2 }}>熱量 (kcal)</Text>
            <TextInput value={calories} onChangeText={setCalories} keyboardType="numeric" style={{ backgroundColor: palette.surface, color: palette.text, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: palette.card, textAlign: 'center' }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.mute, fontSize: 10, marginBottom: 2 }}>蛋白 (g)</Text>
            <TextInput value={protein} onChangeText={setProtein} keyboardType="numeric" style={{ backgroundColor: palette.surface, color: palette.text, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: palette.card, textAlign: 'center' }} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.mute, fontSize: 10, marginBottom: 2 }}>碳水 (g)</Text>
            <TextInput value={carb} onChangeText={setCarb} keyboardType="numeric" style={{ backgroundColor: palette.surface, color: palette.text, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: palette.card, textAlign: 'center' }} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.mute, fontSize: 10, marginBottom: 2 }}>脂肪 (g)</Text>
            <TextInput value={fat} onChangeText={setFat} keyboardType="numeric" style={{ backgroundColor: palette.surface, color: palette.text, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: palette.card, textAlign: 'center' }} />
          </View>
        </View>
      </ScrollView>

      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: palette.surface, borderTopWidth: 1, borderTopColor: palette.card,
        paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, flexDirection: 'row', gap: 8,
      }}>
        <Pressable onPress={() => router.back()} style={{ backgroundColor: palette.card, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12 }}>
          <Text style={{ color: palette.text, fontWeight: '600' }}>取消</Text>
        </Pressable>
        <Pressable onPress={onSave} style={{ flex: 1, backgroundColor: palette.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
          <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 16 }}>儲存</Text>
        </Pressable>
      </View>
    </View>
  );
}
