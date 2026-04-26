import { View, Text, Pressable, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useState, useCallback, useMemo } from 'react';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import * as haptic from '@/lib/haptic';
import { LONG_PRESS_MS } from '@/lib/gestures';
import { BOTTOM_BAR_PADDING } from '@/lib/layout';
import type { Exercise } from '@/db/schema';

const EMOJI_PRESET = ['💪', '🦵', '🔥', '🏋️', '🏃', '🧘', '🤸', '🎯'];

export default function NewRoutine() {
  const palette = useThemePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const exercises = useAppStore((s) => s.exercises);
  const create = useAppStore((s) => s.createRoutineWithExercises);
  const tempIds = useAppStore((s) => s.tempSelectedExerciseIds);
  const setTempIds = useAppStore((s) => s.setTempSelectedIds);
  const clearTemp = useAppStore((s) => s.clearTempSelectedIds);

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💪');
  const [note, setNote] = useState('');

  useFocusEffect(
    useCallback(() => {
      return () => {
        clearTemp();
      };
    }, [clearTemp]),
  );

  const selectedExercises = useMemo(
    () => tempIds.map((id) => exercises.find((e) => e.id === id)).filter(Boolean) as Exercise[],
    [tempIds, exercises]
  );

  const openSelect = () => {
    haptic.tapLight();
    router.push('/exercise/select?mode=multi' as any);
  };

  const removeOne = (id: number) => {
    haptic.tapLight();
    setTempIds(tempIds.filter((x) => x !== id));
  };

  const handleReorder = (newData: Exercise[]) => {
    haptic.success();
    setTempIds(newData.map((e) => e.id));
  };

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('請輸入樣板名稱');
      return;
    }
    if (tempIds.length === 0) {
      Alert.alert('請至少選一個動作');
      return;
    }
    haptic.success();
    await create({
      name: name.trim(),
      emoji,
      note: note.trim() || undefined,
      exerciseIds: tempIds,
    });
    clearTemp();
    router.back();
  };

  const renderRow = ({ item: e, drag, isActive, getIndex }: RenderItemParams<Exercise>) => {
    const idx = getIndex() ?? 0;
    const firstChar = e.name.trim().charAt(0);
    return (
      <Pressable
        onLongPress={() => {
          haptic.tapMedium();
          drag();
        }}
        delayLongPress={LONG_PRESS_MS}
        className="bg-kibo-surface rounded-xl p-3 border border-kibo-card flex-row items-center gap-2 mb-2"
        style={{
          opacity: isActive ? 0.92 : 1,
          transform: [{ scale: isActive ? 1.02 : 1 }],
          shadowColor: palette.text,
          shadowOpacity: isActive ? 0.3 : 0,
          shadowRadius: isActive ? 8 : 0,
          shadowOffset: { width: 0, height: isActive ? 4 : 0 },
          elevation: isActive ? 6 : 0,
        }}
      >
        <Text style={{ color: palette.mute, fontSize: 18, paddingHorizontal: 4 }}>≡</Text>
        <Text className="text-kibo-mute text-xs w-5">{idx + 1}.</Text>
        <View className={`w-10 h-10 rounded-full items-center justify-center ${e.isCustom ? 'bg-kibo-accent/25' : 'bg-kibo-card'}`}>
          <Text className="text-kibo-text font-bold">{firstChar}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-kibo-text font-semibold text-sm">{e.name}</Text>
          <Text className="text-kibo-mute text-[10px]">
            {e.part ?? e.muscleGroup}
            {e.equipment && ` · ${e.equipment}`}
          </Text>
        </View>
        <Pressable onPress={() => removeOne(e.id)} className="p-2">
          <Text className="text-kibo-danger">✕</Text>
        </Pressable>
      </Pressable>
    );
  };

  const ListHeader = useMemo(
    () => (
      <View>
        <Text className="text-kibo-mute text-xs mb-2">樣板名稱</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="例如：週一胸日、腿日"
          placeholderTextColor={palette.placeholder}
          maxLength={24}
          className="bg-kibo-surface text-kibo-text rounded-xl px-4 py-3 mb-4 border border-kibo-card"
        />

        <Text className="text-kibo-mute text-xs mb-2">圖示</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {EMOJI_PRESET.map((e) => (
            <Pressable
              key={e}
              onPress={() => {
                haptic.tapLight();
                setEmoji(e);
              }}
              className={`w-12 h-12 items-center justify-center rounded-xl ${emoji === e ? 'bg-kibo-primary' : 'bg-kibo-surface border border-kibo-card'}`}
            >
              <Text className="text-2xl">{e}</Text>
            </Pressable>
          ))}
        </View>

        <Text className="text-kibo-mute text-xs mb-2">備註（可選）</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="訓練重點、提醒事項"
          placeholderTextColor={palette.placeholder}
          maxLength={60}
          className="bg-kibo-surface text-kibo-text rounded-xl px-4 py-3 mb-4 border border-kibo-card"
        />

        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-kibo-text text-base font-bold">
            動作清單 {selectedExercises.length > 0 && `(${selectedExercises.length})`}
          </Text>
          <Pressable onPress={openSelect}>
            <Text className="text-kibo-primary font-semibold">＋ 選擇動作</Text>
          </Pressable>
        </View>
        {selectedExercises.length > 0 && (
          <Text className="text-kibo-mute text-[10px] mb-3">長按拖曳可調整順序</Text>
        )}

        {selectedExercises.length === 0 && (
          <Pressable
            onPress={openSelect}
            className="bg-kibo-surface border-2 border-dashed border-kibo-card rounded-2xl py-8 items-center"
          >
            <Text className="text-4xl mb-2">💪</Text>
            <Text className="text-kibo-primary font-semibold">點此挑選動作</Text>
            <Text className="text-kibo-mute text-xs mt-1">使用跟訓練時一樣的 UI（搜尋/部位/裝備）</Text>
          </Pressable>
        )}
      </View>
    ),
    [name, emoji, note, selectedExercises.length, palette.placeholder]
  );

  return (
    <View className="flex-1 bg-kibo-bg">
      <DraggableFlatList
        data={selectedExercises}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderRow}
        onDragEnd={({ data }) => handleReorder(data)}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_BAR_PADDING }}
        activationDistance={5}
      />

      <View
        className="absolute bottom-0 left-0 right-0 bg-kibo-surface border-t border-kibo-card px-4 pt-3 flex-row gap-2"
        style={{ paddingBottom: Math.max(12, insets.bottom) }}
      >
        <Pressable
          onPress={() => {
            clearTemp();
            router.back();
          }}
          className="bg-kibo-card rounded-2xl py-4 px-6"
        >
          <Text className="text-kibo-text font-semibold">取消</Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          className="flex-1 bg-kibo-primary rounded-2xl py-4"
        >
          <Text className="text-kibo-bg text-center font-bold text-lg">
            儲存樣板
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
