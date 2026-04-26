import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, FlatList, Image } from 'react-native';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import * as haptic from '@/lib/haptic';
import type { CustomFood, MealItem } from '@/db/schema';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 選好食物 + 份數後回傳，呼叫端負責加進這餐 items */
  onPick: (item: MealItem) => void;
};

const MULTIPLIER_PRESETS = [0.5, 1, 1.5, 2, 3];

export function FoodPickerModal({ visible, onClose, onPick }: Props) {
  const palette = useThemePalette();
  const customFoods = useAppStore((s) => s.customFoods);
  const refreshCustomFoods = useAppStore((s) => s.refreshCustomFoods);
  const useCustomFood = useAppStore((s) => s.useCustomFood);

  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<CustomFood | null>(null);
  const [multiplier, setMultiplier] = useState(1);

  useEffect(() => {
    if (visible) refreshCustomFoods();
  }, [visible]);

  const filtered = useMemo(() => {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return customFoods;
    return customFoods.filter((f) => f.name.toLowerCase().includes(trimmed));
  }, [customFoods, q]);

  const onConfirm = async () => {
    if (!selected) return;
    haptic.success();
    const item = await useCustomFood(selected.id, multiplier);
    if (item) {
      onPick(item as MealItem);
      onClose();
      // reset
      setSelected(null); setMultiplier(1); setQ('');
    }
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: palette.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, height: '85%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700', flex: 1 }}>
              {selected ? `選擇份數：${selected.name}` : '我的食物庫'}
            </Text>
            <Pressable onPress={() => { setSelected(null); onClose(); }} hitSlop={8}>
              <Text style={{ color: palette.mute, fontSize: 22 }}>✕</Text>
            </Pressable>
          </View>

          {!selected ? (
            <>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="搜尋食物名稱..."
                placeholderTextColor={palette.placeholder}
                style={{
                  backgroundColor: palette.surface, color: palette.text,
                  padding: 12, borderRadius: 10, borderWidth: 1, borderColor: palette.card, marginBottom: 12,
                }}
              />
              <FlatList
                data={filtered}
                keyExtractor={(it) => String(it.id)}
                ListEmptyComponent={
                  <View style={{ alignItems: 'center', padding: 24 }}>
                    <Text style={{ fontSize: 36, marginBottom: 8 }}>🍽</Text>
                    <Text style={{ color: palette.mute, fontSize: 12, textAlign: 'center' }}>
                      {q ? '沒有相符的食物' : '尚未建立食物。\n到「我 → 食物庫」新增'}
                    </Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => { haptic.tapLight(); setSelected(item); }}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: palette.surface, padding: 12,
                      borderRadius: 10, marginBottom: 6,
                      borderWidth: 1, borderColor: palette.card,
                    }}
                  >
                    {item.photoUri ? (
                      <Image source={{ uri: item.photoUri }} style={{ width: 36, height: 36, borderRadius: 6, marginRight: 10 }} />
                    ) : (
                      <Text style={{ fontSize: 28, marginRight: 10 }}>{item.emoji}</Text>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: palette.text, fontWeight: '600' }}>{item.name}</Text>
                      <Text style={{ color: palette.mute, fontSize: 11 }}>
                        {item.caloriesKcal} kcal · 蛋白 {item.proteinG}g
                        {item.portion ? ` · ${item.portion}` : ''}
                      </Text>
                    </View>
                    <Text style={{ color: palette.mute }}>›</Text>
                  </Pressable>
                )}
              />
            </>
          ) : (
            <View style={{ flex: 1 }}>
              <View style={{ backgroundColor: palette.surface, padding: 14, borderRadius: 12, marginBottom: 16 }}>
                <Text style={{ color: palette.mute, fontSize: 11 }}>每份營養</Text>
                <Text style={{ color: palette.text, fontWeight: '700', fontSize: 14, marginTop: 2 }}>
                  {selected.caloriesKcal} kcal · 蛋白 {selected.proteinG}g · 碳水 {selected.carbG}g · 脂 {selected.fatG}g
                </Text>
              </View>

              <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 8 }}>份數</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {MULTIPLIER_PRESETS.map((m) => {
                  const active = multiplier === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => { haptic.tapLight(); setMultiplier(m); }}
                      style={{
                        paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10,
                        backgroundColor: active ? palette.primary : palette.card,
                      }}
                    >
                      <Text style={{ color: active ? palette.bg : palette.text, fontWeight: '700', fontSize: 16 }}>
                        × {m}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={{ backgroundColor: palette.card, padding: 14, borderRadius: 12, marginBottom: 16 }}>
                <Text style={{ color: palette.mute, fontSize: 11 }}>本次紀錄</Text>
                <Text style={{ color: palette.primary, fontWeight: '700', fontSize: 18, marginTop: 4 }}>
                  {Math.round(selected.caloriesKcal * multiplier)} kcal
                </Text>
                <Text style={{ color: palette.mute, fontSize: 12, marginTop: 2 }}>
                  蛋白 {Math.round(selected.proteinG * multiplier * 10) / 10}g · 碳水 {Math.round(selected.carbG * multiplier * 10) / 10}g · 脂 {Math.round(selected.fatG * multiplier * 10) / 10}g
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable onPress={() => setSelected(null)} style={{ backgroundColor: palette.card, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12 }}>
                  <Text style={{ color: palette.text, fontWeight: '600' }}>← 換</Text>
                </Pressable>
                <Pressable onPress={onConfirm} style={{ flex: 1, backgroundColor: palette.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 16 }}>加入這餐</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default FoodPickerModal;
