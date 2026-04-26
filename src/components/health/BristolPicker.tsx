import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView } from 'react-native';
import { useThemePalette } from '@/lib/useThemePalette';
import * as haptic from '@/lib/haptic';

type Props = {
  visible: boolean;
  initial?: { bristol: number; hasBlood: boolean; hasPain: boolean; notes: string };
  onClose: () => void;
  onSave: (data: { bristol: number; hasBlood: boolean; hasPain: boolean; notes: string }) => void | Promise<void>;
};

const BRISTOL_INFO = [
  { type: 1, emoji: '🌰', label: '硬塊', desc: '硬球狀，難排' },
  { type: 2, emoji: '🥜', label: '塊狀', desc: '香腸狀但顆粒明顯' },
  { type: 3, emoji: '🌽', label: '裂紋', desc: '香腸狀帶裂紋' },
  { type: 4, emoji: '🍌', label: '正常', desc: '香腸狀光滑（理想）' },
  { type: 5, emoji: '🥜', label: '軟塊', desc: '軟塊狀邊緣清楚' },
  { type: 6, emoji: '🥧', label: '糊狀', desc: '糊狀邊緣不清' },
  { type: 7, emoji: '💧', label: '水狀', desc: '完全液體（腹瀉）' },
];

export function BristolPicker({ visible, initial, onClose, onSave }: Props) {
  const palette = useThemePalette();
  const [bristol, setBristol] = useState(4);
  const [hasBlood, setHasBlood] = useState(false);
  const [hasPain, setHasPain] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initial) {
      setBristol(initial.bristol);
      setHasBlood(initial.hasBlood);
      setHasPain(initial.hasPain);
      setNotes(initial.notes);
    } else {
      setBristol(4);
      setHasBlood(false);
      setHasPain(false);
      setNotes('');
    }
  }, [visible, initial]);

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: palette.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 16,
            maxHeight: '85%',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700', flex: 1 }}>排便詳填</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={{ color: palette.mute, fontSize: 22 }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 400 }}>
            <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 8 }}>Bristol 分級</Text>
            {BRISTOL_INFO.map((b) => {
              const active = bristol === b.type;
              return (
                <Pressable
                  key={b.type}
                  onPress={() => { haptic.tapLight(); setBristol(b.type); }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: active ? palette.primary : palette.surface,
                    marginBottom: 6,
                    borderWidth: 1,
                    borderColor: active ? palette.primary : palette.card,
                  }}
                >
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{b.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: active ? palette.bg : palette.text, fontWeight: '600' }}>
                      Type {b.type} · {b.label}
                    </Text>
                    <Text style={{ color: active ? palette.bg : palette.mute, fontSize: 11 }}>{b.desc}</Text>
                  </View>
                </Pressable>
              );
            })}

            <Text style={{ color: palette.mute, fontSize: 12, marginTop: 12, marginBottom: 8 }}>症狀</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <Pressable
                onPress={() => { haptic.tapLight(); setHasBlood(!hasBlood); }}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 10,
                  backgroundColor: hasBlood ? palette.danger : palette.card,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: hasBlood ? palette.bg : palette.text, fontWeight: '600' }}>🩸 有血</Text>
              </Pressable>
              <Pressable
                onPress={() => { haptic.tapLight(); setHasPain(!hasPain); }}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 10,
                  backgroundColor: hasPain ? palette.danger : palette.card,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: hasPain ? palette.bg : palette.text, fontWeight: '600' }}>😣 有痛</Text>
              </Pressable>
            </View>

            <Text style={{ color: palette.mute, fontSize: 12, marginTop: 8, marginBottom: 4 }}>備註</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="非必填"
              placeholderTextColor={palette.placeholder}
              style={{
                backgroundColor: palette.surface,
                color: palette.text,
                borderRadius: 10,
                padding: 10,
                borderWidth: 1,
                borderColor: palette.card,
                marginBottom: 16,
              }}
            />
          </ScrollView>

          <Pressable
            onPress={async () => {
              haptic.success();
              await onSave({ bristol, hasBlood, hasPain, notes });
            }}
            style={{
              backgroundColor: palette.primary,
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 16 }}>儲存</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default BristolPicker;
