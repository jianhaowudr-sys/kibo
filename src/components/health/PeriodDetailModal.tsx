import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView } from 'react-native';
import { useThemePalette } from '@/lib/useThemePalette';
import * as haptic from '@/lib/haptic';
import type { PeriodFlow } from '@/db/schema';

const FLOWS: { id: PeriodFlow; label: string; emoji: string }[] = [
  { id: 'spot', label: '點滴', emoji: '🌸' },
  { id: 'light', label: '少量', emoji: '🩸' },
  { id: 'medium', label: '中量', emoji: '🌹' },
  { id: 'heavy', label: '大量', emoji: '🌺' },
];

const SYMPTOMS = [
  { id: 'cramp', label: '經痛' },
  { id: 'mood', label: '情緒起伏' },
  { id: 'headache', label: '頭痛' },
  { id: 'bloating', label: '脹氣' },
  { id: 'fatigue', label: '疲倦' },
  { id: 'nausea', label: '噁心' },
  { id: 'tender', label: '胸部脹痛' },
  { id: 'acne', label: '痘痘' },
];

type Props = {
  visible: boolean;
  initial?: { flow: PeriodFlow; symptoms: string[]; notes: string; isCycleStart: boolean };
  onClose: () => void;
  onSave: (data: { flow: PeriodFlow; symptoms: string[]; notes: string; isCycleStart: boolean }) => void | Promise<void>;
};

export function PeriodDetailModal({ visible, initial, onClose, onSave }: Props) {
  const palette = useThemePalette();
  const [flow, setFlow] = useState<PeriodFlow>('medium');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isCycleStart, setIsCycleStart] = useState(false);

  useEffect(() => {
    if (visible && initial) {
      setFlow(initial.flow);
      setSymptoms(initial.symptoms);
      setNotes(initial.notes);
      setIsCycleStart(initial.isCycleStart);
    } else if (visible) {
      setFlow('medium');
      setSymptoms([]);
      setNotes('');
      setIsCycleStart(false);
    }
  }, [visible, initial]);

  const toggleSymptom = (id: string) => {
    haptic.tapLight();
    setSymptoms((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: palette.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '90%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700', flex: 1 }}>經期詳填</Text>
            <Pressable onPress={onClose} hitSlop={8}><Text style={{ color: palette.mute, fontSize: 22 }}>✕</Text></Pressable>
          </View>

          <ScrollView style={{ maxHeight: 480 }}>
            <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 8 }}>流量</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {FLOWS.map((f) => {
                const active = flow === f.id;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => { haptic.tapLight(); setFlow(f.id); }}
                    style={{
                      flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
                      backgroundColor: active ? palette.accent : palette.card,
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{f.emoji}</Text>
                    <Text style={{ color: active ? palette.bg : palette.text, fontSize: 11, fontWeight: '600', marginTop: 4 }}>
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 8 }}>症狀（可複選）</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {SYMPTOMS.map((s) => {
                const active = symptoms.includes(s.id);
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => toggleSymptom(s.id)}
                    style={{
                      paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16,
                      backgroundColor: active ? palette.primary : palette.card,
                    }}
                  >
                    <Text style={{ color: active ? palette.bg : palette.text, fontSize: 12, fontWeight: '600' }}>
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => { haptic.tapLight(); setIsCycleStart(!isCycleStart); }}
              style={{
                flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10,
                backgroundColor: isCycleStart ? palette.accent : palette.card, marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 18, marginRight: 10 }}>{isCycleStart ? '✓' : '○'}</Text>
              <Text style={{ color: isCycleStart ? palette.bg : palette.text, fontWeight: '600' }}>
                這天是新週期第一天
              </Text>
            </Pressable>

            <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 4 }}>備註</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="非必填"
              placeholderTextColor={palette.placeholder}
              multiline
              style={{
                backgroundColor: palette.surface, color: palette.text, borderRadius: 10, padding: 10,
                borderWidth: 1, borderColor: palette.card, marginBottom: 16, minHeight: 60,
              }}
            />
          </ScrollView>

          <Pressable
            onPress={async () => {
              haptic.success();
              await onSave({ flow, symptoms, notes, isCycleStart });
            }}
            style={{ backgroundColor: palette.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
          >
            <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 16 }}>儲存</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default PeriodDetailModal;
