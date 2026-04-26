import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Alert, Image, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { readMealFromBase64 } from '@/lib/ocr';
import { hasActiveProviderKey } from '@/lib/ai_provider';
import * as haptic from '@/lib/haptic';
import { BOTTOM_BAR_PADDING } from '@/lib/layout';

const EMOJI_PRESETS = ['🍽', '🥤', '🍞', '🍙', '🍱', '🥩', '🍣', '🥗', '🍔', '🍕', '🍜', '🥛', '🍫', '🥐', '🍎', '🥑', '🍳', '🍰'];

export default function NewCustomFood() {
  const palette = useThemePalette();
  const router = useRouter();
  const { initName, initCal, initP, initC, initF } = useLocalSearchParams<any>();
  const addCustomFood = useAppStore((s) => s.addCustomFood);

  const [mode, setMode] = useState<'ai' | 'manual'>(initName ? 'manual' : 'manual');
  const [name, setName] = useState(initName ?? '');
  const [emoji, setEmoji] = useState('🍽');
  const [calories, setCalories] = useState(initCal ?? '');
  const [protein, setProtein] = useState(initP ?? '');
  const [carb, setCarb] = useState(initC ?? '');
  const [fat, setFat] = useState(initF ?? '');
  const [portion, setPortion] = useState('1 份');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickPhoto = async () => {
    haptic.tapLight();
    const r = await ImagePicker.requestCameraPermissionsAsync();
    if (!r.granted) {
      Alert.alert('需要相機權限');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8, base64: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    setPhotoUri(res.assets[0].uri);
    setPhotoBase64(res.assets[0].base64 ?? null);
  };

  const aiParse = async () => {
    if (!photoBase64) {
      Alert.alert('請先拍照');
      return;
    }
    const check = await hasActiveProviderKey();
    if (!check.has) {
      Alert.alert(`需要 ${check.providerLabel} API Key`);
      return;
    }
    setLoading(true);
    try {
      const reading = await readMealFromBase64(photoBase64);
      const main = reading.items?.[0];
      if (main) {
        setName(main.name ?? '');
        setCalories(String(main.calories ?? reading.totalCalories ?? 0));
        setProtein(String(main.protein ?? reading.totalProtein ?? 0));
        setCarb(String(main.carb ?? reading.totalCarb ?? 0));
        setFat(String(main.fat ?? reading.totalFat ?? 0));
        if (main.portion) setPortion(main.portion);
      } else {
        setName(reading.title ?? '');
        setCalories(String(reading.totalCalories ?? 0));
        setProtein(String(reading.totalProtein ?? 0));
        setCarb(String(reading.totalCarb ?? 0));
        setFat(String(reading.totalFat ?? 0));
      }
      haptic.success();
    } catch (e: any) {
      haptic.error();
      Alert.alert('AI 判讀失敗', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    if (!name.trim()) { Alert.alert('請輸入食物名稱'); return; }
    haptic.success();
    await addCustomFood({
      name: name.trim(),
      emoji,
      caloriesKcal: Number(calories) || 0,
      proteinG: Number(protein) || 0,
      carbG: Number(carb) || 0,
      fatG: Number(fat) || 0,
      portion: portion.trim() || null,
      photoUri,
      source: mode === 'ai' ? 'ai' : 'manual',
    });
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_BAR_PADDING }}>
        {/* Segment */}
        <View style={{ flexDirection: 'row', backgroundColor: palette.card, borderRadius: 10, padding: 4, marginBottom: 16 }}>
          {([
            { id: 'ai' as const, label: '📷 拍照 + AI' },
            { id: 'manual' as const, label: '✍️ 手動填' },
          ]).map((o) => {
            const active = mode === o.id;
            return (
              <Pressable
                key={o.id}
                onPress={() => { haptic.tapLight(); setMode(o.id); }}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center',
                  backgroundColor: active ? palette.primary : 'transparent',
                }}
              >
                <Text style={{ color: active ? palette.bg : palette.text, fontWeight: '600' }}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'ai' && (
          <View style={{ marginBottom: 16 }}>
            {photoUri ? (
              <View>
                <Image source={{ uri: photoUri }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 12, marginBottom: 8 }} />
                <Pressable
                  onPress={aiParse}
                  disabled={loading}
                  style={{ backgroundColor: palette.accent, paddingVertical: 12, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : null}
                  <Text style={{ color: palette.bg, fontWeight: '700' }}>{loading ? 'AI 估算中...' : '🤖 AI 自動填欄位'}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={pickPhoto}
                style={{
                  backgroundColor: palette.surface, paddingVertical: 40,
                  borderRadius: 12, alignItems: 'center',
                  borderWidth: 2, borderColor: palette.card, borderStyle: 'dashed',
                }}
              >
                <Text style={{ fontSize: 36, marginBottom: 6 }}>📷</Text>
                <Text style={{ color: palette.primary, fontWeight: '600' }}>拍食物 / 包裝照片</Text>
              </Pressable>
            )}
          </View>
        )}

        <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>名稱</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="例如：乳清蛋白巧克力"
          placeholderTextColor={palette.placeholder}
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

        <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>份量描述（每 1 份）</Text>
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
