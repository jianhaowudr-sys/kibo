import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useMemo } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { BODY_PARTS, EQUIPMENTS, UNIT_LABELS } from '@/data/exercises_v2';
import type { BodyPart, EquipmentType } from '@/db/schema';
import * as haptic from '@/lib/haptic';

type Tab = 'new' | 'list';
type UnitCode = 'reps' | 'minutes' | 'seconds' | 'meters';

export default function NewExercise() {
  const palette = useThemePalette();
  const router = useRouter();
  const exercises = useAppStore((s) => s.exercises);
  const createCustomExercise = useAppStore((s) => s.createCustomExercise);
  const deleteCustomExercise = useAppStore((s) => s.deleteCustomExercise);

  const [tab, setTab] = useState<Tab>('new');

  const [name, setName] = useState('');
  const [part, setPart] = useState<BodyPart | null>(null);
  const [equipment, setEquipment] = useState<EquipmentType | null>(null);
  const [unit, setUnit] = useState<UnitCode>('reps');
  const [showPart, setShowPart] = useState(false);
  const [showEquip, setShowEquip] = useState(false);
  const [showUnit, setShowUnit] = useState(false);

  const customExercises = useMemo(
    () => exercises.filter((e) => e.isCustom).sort((a, b) => b.id - a.id),
    [exercises],
  );

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('請填運動名稱');
      return;
    }
    if (!part) {
      Alert.alert('請選部位');
      return;
    }
    haptic.tapMedium();
    try {
      const category = part === '有氧' ? 'cardio' : part === '活動度' ? 'flexibility' : 'strength';
      await createCustomExercise({
        name: name.trim(),
        part,
        equipment: equipment ?? undefined,
        unit,
        muscleGroup: part,
      });
      haptic.success();
      setName('');
      setPart(null);
      setEquipment(null);
      setUnit('reps');
      setTab('list');
    } catch (e: any) {
      haptic.error();
      Alert.alert('建立失敗', e?.message ?? String(e));
    }
  };

  const onDelete = (id: number, exName: string) => {
    Alert.alert('刪除自訂運動？', exName, [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          haptic.warning();
          await deleteCustomExercise(id);
        },
      },
    ]);
  };

  const UNIT_OPTIONS: { code: UnitCode; label: string }[] = [
    { code: 'reps', label: UNIT_LABELS.reps },
    { code: 'minutes', label: UNIT_LABELS.minutes },
    { code: 'seconds', label: UNIT_LABELS.seconds },
    { code: 'meters', label: UNIT_LABELS.meters },
  ];

  return (
    <View className="flex-1 bg-kibo-bg">
      <View className="flex-row bg-kibo-surface border-b border-kibo-card">
        <Pressable
          onPress={() => {
            haptic.tapLight();
            setTab('new');
          }}
          className={`flex-1 py-3 items-center ${tab === 'new' ? 'border-b-2 border-kibo-primary' : ''}`}
        >
          <Text className={tab === 'new' ? 'text-kibo-primary font-bold' : 'text-kibo-mute'}>
            ＋ 新增運動
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            haptic.tapLight();
            setTab('list');
          }}
          className={`flex-1 py-3 items-center ${tab === 'list' ? 'border-b-2 border-kibo-primary' : ''}`}
        >
          <Text className={tab === 'list' ? 'text-kibo-primary font-bold' : 'text-kibo-mute'}>
            ≡ 已創建 ({customExercises.length})
          </Text>
        </Pressable>
      </View>

      {tab === 'new' ? (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text className="text-kibo-mute text-xs mb-2">運動名稱</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="運動名稱"
            placeholderTextColor={palette.placeholder}
            maxLength={30}
            className="bg-kibo-surface text-kibo-text rounded-xl px-4 py-3 mb-4 border border-kibo-card"
          />

          <Text className="text-kibo-mute text-xs mb-2">部位</Text>
          <Pressable
            onPress={() => {
              haptic.tapLight();
              setShowPart(true);
            }}
            className="bg-kibo-surface border border-kibo-card rounded-xl px-4 py-3 mb-4 flex-row items-center justify-between"
          >
            <Text className={part ? 'text-kibo-text' : 'text-kibo-mute'}>
              {part ?? '選擇部位'}
            </Text>
            <Text className="text-kibo-mute">▼</Text>
          </Pressable>

          <Text className="text-kibo-mute text-xs mb-2">裝備</Text>
          <Pressable
            onPress={() => {
              haptic.tapLight();
              setShowEquip(true);
            }}
            className="bg-kibo-surface border border-kibo-card rounded-xl px-4 py-3 mb-4 flex-row items-center justify-between"
          >
            <Text className={equipment ? 'text-kibo-text' : 'text-kibo-mute'}>
              {equipment ?? '選擇裝備（可選）'}
            </Text>
            <Text className="text-kibo-mute">▼</Text>
          </Pressable>

          <Text className="text-kibo-mute text-xs mb-2">記錄方式</Text>
          <Pressable
            onPress={() => {
              haptic.tapLight();
              setShowUnit(true);
            }}
            className="bg-kibo-surface border border-kibo-card rounded-xl px-4 py-3 mb-6 flex-row items-center justify-between"
          >
            <Text className="text-kibo-text">{UNIT_LABELS[unit]}</Text>
            <Text className="text-kibo-mute">▼</Text>
          </Pressable>

          <Pressable
            onPress={save}
            className="bg-kibo-primary rounded-2xl py-4"
          >
            <Text className="text-kibo-bg text-center font-bold text-lg">建立運動</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
          {customExercises.length === 0 && (
            <View className="py-12 items-center">
              <Text className="text-4xl mb-2">📋</Text>
              <Text className="text-kibo-mute">還沒有自訂運動</Text>
              <Pressable
                onPress={() => setTab('new')}
                className="mt-4 bg-kibo-primary rounded-xl px-5 py-2"
              >
                <Text className="text-kibo-bg font-bold">建立第一個</Text>
              </Pressable>
            </View>
          )}
          {customExercises.map((e) => {
            const firstChar = e.name.trim().charAt(0);
            return (
              <View
                key={e.id}
                className="flex-row items-center gap-3 px-2 py-3"
              >
                <View className="w-12 h-12 rounded-full items-center justify-center bg-kibo-accent/25">
                  <Text className="text-kibo-text text-xl font-bold">{firstChar}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-kibo-text font-semibold">{e.name}</Text>
                  <Text className="text-kibo-mute text-xs mt-0.5">
                    {e.part}
                    {e.equipment && ` · ${e.equipment}`}
                    {' · '}{UNIT_LABELS[e.unit as UnitCode] ?? e.unit}
                  </Text>
                </View>
                <Pressable onPress={() => onDelete(e.id, e.name)} className="p-2">
                  <Text className="text-kibo-danger">✕</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}

      <PickerModal
        visible={showPart}
        title="選擇部位"
        options={BODY_PARTS as unknown as string[]}
        value={part ?? ''}
        onClose={() => setShowPart(false)}
        onSelect={(v) => {
          setPart(v as BodyPart);
          setShowPart(false);
        }}
      />
      <PickerModal
        visible={showEquip}
        title="選擇裝備"
        options={['（無）', ...EQUIPMENTS]}
        value={equipment ?? '（無）'}
        onClose={() => setShowEquip(false)}
        onSelect={(v) => {
          setEquipment(v === '（無）' ? null : (v as EquipmentType));
          setShowEquip(false);
        }}
      />
      <PickerModal
        visible={showUnit}
        title="選擇記錄方式"
        options={UNIT_OPTIONS.map((u) => u.label)}
        value={UNIT_LABELS[unit]}
        onClose={() => setShowUnit(false)}
        onSelect={(v) => {
          const opt = UNIT_OPTIONS.find((u) => u.label === v);
          if (opt) setUnit(opt.code);
          setShowUnit(false);
        }}
      />
    </View>
  );
}

function PickerModal({
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
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
                onPress={() => onSelect(o)}
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
