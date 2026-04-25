import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useMemo } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { BODY_PARTS, EQUIPMENTS } from '@/data/exercises_v2';
import type { Exercise } from '@/db/schema';
import * as haptic from '@/lib/haptic';

export default function ExerciseSelect() {
  const palette = useThemePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isMulti = mode === 'multi';

  const exercises = useAppStore((s) => s.exercises);
  const setSelected = useAppStore((s) => s.setSelectedExerciseId);
  const deleteCustomExercise = useAppStore((s) => s.deleteCustomExercise);
  const tempIds = useAppStore((s) => s.tempSelectedExerciseIds);
  const toggleTempId = useAppStore((s) => s.toggleTempSelectedId);

  const [query, setQuery] = useState('');
  const [partFilter, setPartFilter] = useState<string>('所有部位');
  const [equipFilter, setEquipFilter] = useState<string>('所有裝備');
  const [showPart, setShowPart] = useState(false);
  const [showEquip, setShowEquip] = useState(false);

  const filtered = useMemo(() => {
    return exercises.filter((e) => {
      if (partFilter !== '所有部位' && e.part !== partFilter) {
        if (!e.part && partFilter !== '所有部位') return false;
        if (e.part !== partFilter) return false;
      }
      if (equipFilter !== '所有裝備' && e.equipment !== equipFilter) return false;
      if (query && !e.name.includes(query) && !e.muscleGroup.includes(query)) return false;
      return true;
    });
  }, [exercises, query, partFilter, equipFilter]);

  const pick = (id: number) => {
    haptic.tapMedium();
    if (isMulti) {
      toggleTempId(id);
    } else {
      setSelected(id);
      router.back();
    }
  };

  const done = () => {
    haptic.success();
    router.back();
  };

  const onOptions = (e: Exercise) => {
    const actions: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [
      {
        text: '📊 看 PR / 歷史',
        onPress: () => router.push({ pathname: '/exercise/[id]' as any, params: { id: String(e.id) } }),
      },
    ];
    if (e.isCustom) {
      actions.push({
        text: '🗑 刪除',
        style: 'destructive',
        onPress: () => {
          Alert.alert('刪除這個自訂動作？', e.name, [
            { text: '取消', style: 'cancel' },
            {
              text: '刪除',
              style: 'destructive',
              onPress: async () => {
                haptic.warning();
                await deleteCustomExercise(e.id);
              },
            },
          ]);
        },
      });
    }
    actions.push({ text: '取消', style: 'cancel' });
    Alert.alert(e.name, e.part ?? '', actions);
  };

  const reset = () => {
    haptic.tapLight();
    setQuery('');
    setPartFilter('所有部位');
    setEquipFilter('所有裝備');
  };

  return (
    <View className="flex-1 bg-kibo-bg">
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row items-center gap-2 mb-3">
          <View className="flex-1 flex-row items-center bg-kibo-surface rounded-full px-4 border border-kibo-card">
            <Text className="text-kibo-mute mr-2">🔍</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="搜尋運動"
              placeholderTextColor={palette.placeholder}
              className="flex-1 text-kibo-text py-2.5"
            />
          </View>
          <Pressable onPress={reset}>
            <Text className="text-kibo-primary font-semibold">重設</Text>
          </Pressable>
        </View>

        <View className="flex-row gap-2">
          <Pressable
            onPress={() => {
              haptic.tapLight();
              setShowPart(true);
            }}
            className="flex-1 flex-row items-center justify-between bg-kibo-surface border border-kibo-card rounded-2xl px-4 py-3"
          >
            <Text className="text-kibo-text">{partFilter}</Text>
            <Text className="text-kibo-mute text-xs">▼</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic.tapLight();
              setShowEquip(true);
            }}
            className="flex-1 flex-row items-center justify-between bg-kibo-surface border border-kibo-card rounded-2xl px-4 py-3"
          >
            <Text className="text-kibo-text">{equipFilter}</Text>
            <Text className="text-kibo-mute text-xs">▼</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={() => {
          haptic.tapLight();
          router.push('/exercise/new' as any);
        }}
        className="mx-4 mb-2 bg-kibo-primary/15 border border-kibo-primary rounded-xl py-2.5 flex-row items-center justify-center gap-2"
      >
        <Text className="text-kibo-primary font-semibold">＋ 新增自訂運動</Text>
      </Pressable>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
        {filtered.length === 0 && (
          <View className="py-12 items-center">
            <Text className="text-4xl mb-2">🔍</Text>
            <Text className="text-kibo-mute">沒有符合的運動</Text>
            <Text className="text-kibo-mute text-xs mt-1">試試重設篩選條件</Text>
          </View>
        )}

        {filtered.map((e) => {
          const firstChar = e.name.trim().charAt(0);
          const selected = isMulti && tempIds.includes(e.id);
          return (
            <Pressable
              key={e.id}
              onPress={() => pick(e.id)}
              className={`flex-row items-center gap-3 px-2 py-3 active:opacity-70 ${selected ? 'bg-kibo-primary/10 rounded-xl' : ''}`}
            >
              <View className={`w-12 h-12 rounded-full items-center justify-center ${selected ? 'bg-kibo-primary' : e.isCustom ? 'bg-kibo-accent/25' : 'bg-kibo-card'}`}>
                <Text className={`text-xl font-bold ${selected ? 'text-kibo-bg' : 'text-kibo-text'}`}>
                  {selected ? '✓' : firstChar}
                </Text>
              </View>
              <View className="flex-1">
                <Text className={`font-semibold ${selected ? 'text-kibo-primary' : 'text-kibo-text'}`} numberOfLines={1}>
                  {e.name}
                  {e.isCustom && <Text className="text-kibo-accent text-xs"> · 自訂</Text>}
                </Text>
                <Text className="text-kibo-mute text-xs mt-0.5">
                  {e.part ?? e.muscleGroup}
                  {e.equipment && ` · ${e.equipment}`}
                </Text>
              </View>
              {!isMulti && (
                <Pressable onPress={() => onOptions(e)} className="p-2">
                  <Text className="text-kibo-mute text-lg">⋯</Text>
                </Pressable>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {isMulti && (
        <View
          className="absolute bottom-0 left-0 right-0 bg-kibo-surface border-t border-kibo-card px-4 pt-3"
          style={{ paddingBottom: Math.max(12, insets.bottom) }}
        >
          <Pressable
            onPress={done}
            className="bg-kibo-primary rounded-2xl py-4"
          >
            <Text className="text-kibo-bg text-center font-bold text-lg">
              完成 ({tempIds.length})
            </Text>
          </Pressable>
        </View>
      )}

      <FilterModal
        visible={showPart}
        title="部位"
        options={['所有部位', ...BODY_PARTS]}
        value={partFilter}
        onClose={() => setShowPart(false)}
        onSelect={(v) => {
          setPartFilter(v);
          setShowPart(false);
        }}
      />
      <FilterModal
        visible={showEquip}
        title="裝備"
        options={['所有裝備', ...EQUIPMENTS]}
        value={equipFilter}
        onClose={() => setShowEquip(false)}
        onSelect={(v) => {
          setEquipFilter(v);
          setShowEquip(false);
        }}
      />
    </View>
  );
}

function FilterModal({
  visible,
  title,
  options,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: string[];
  value: string;
  onClose: () => void;
  onSelect: (v: string) => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable onPress={onClose} className="flex-1 bg-black/60 justify-end">
        <Pressable onPress={(e) => e.stopPropagation()} className="bg-kibo-surface rounded-t-3xl border-t border-kibo-card" style={{ maxHeight: '75%' }}>
          <View className="items-center py-2">
            <View className="w-10 h-1 bg-kibo-card rounded-full" />
          </View>
          <Text className="text-kibo-text text-center font-bold mb-2">{title}</Text>
          <ScrollView>
            {options.map((o) => (
              <Pressable
                key={o}
                onPress={() => {
                  haptic.tapLight();
                  onSelect(o);
                }}
                className={`py-4 px-6 ${o === value ? 'bg-kibo-primary/10' : ''}`}
              >
                <Text className={`text-base ${o === value ? 'text-kibo-primary font-bold' : 'text-kibo-text'}`}>
                  {o}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View className="h-6" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
