import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { TutorialTip } from '@/components/common/TutorialTip';
import * as haptic from '@/lib/haptic';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 強制顯示（起床 prompt 模式），即使昨晚已有紀錄 */
  promptMode?: boolean;
};

/**
 * 睡眠編輯 + 起床 prompt 雙用 modal。
 * 用兩個簡化的「+/- 30 分」按鈕代替 sliders（RN 內建 slider 已棄用，避免額外 lib）。
 */
export function SleepEditModal({ visible, onClose, promptMode }: Props) {
  const palette = useThemePalette();
  const sleepLast = useAppStore((s) => s.sleepLast);
  const settings = useAppStore((s) => s.healthSettings);
  const upsertSleep = useAppStore((s) => s.upsertSleep);

  // 預設：歷史最近一筆 OR 設定的 target
  const defaults = useMemo(() => {
    if (sleepLast) {
      return {
        bedtime: new Date(sleepLast.bedtimeAt instanceof Date ? sleepLast.bedtimeAt : sleepLast.bedtimeAt),
        wake: new Date(sleepLast.wakeAt instanceof Date ? sleepLast.wakeAt : sleepLast.wakeAt),
      };
    }
    const now = new Date();
    const [bH, bM] = settings.sleep.targetBedtime.split(':').map(Number);
    const [wH, wM] = settings.sleep.targetWakeTime.split(':').map(Number);
    const wake = new Date(now);
    wake.setHours(wH, wM, 0, 0);
    const bed = new Date(wake);
    bed.setDate(bed.getDate() - 1);
    bed.setHours(bH, bM, 0, 0);
    return { bedtime: bed, wake };
  }, [sleepLast, settings.sleep.targetBedtime, settings.sleep.targetWakeTime]);

  const [bedtime, setBedtime] = useState(defaults.bedtime);
  const [wake, setWake] = useState(defaults.wake);
  const [quality, setQuality] = useState(3);

  useEffect(() => {
    if (visible) {
      setBedtime(defaults.bedtime);
      setWake(defaults.wake);
      setQuality(sleepLast?.quality ?? 3);
    }
  }, [visible, defaults, sleepLast]);

  const adjustBed = (deltaMin: number) => {
    const next = new Date(bedtime); next.setMinutes(next.getMinutes() + deltaMin); setBedtime(next);
    haptic.tapLight();
  };
  const adjustWake = (deltaMin: number) => {
    const next = new Date(wake); next.setMinutes(next.getMinutes() + deltaMin); setWake(next);
    haptic.tapLight();
  };

  const fmt = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const dur = Math.max(0, Math.round((wake.getTime() - bedtime.getTime()) / 60000));
  const dh = Math.floor(dur / 60);
  const dm = dur % 60;

  const onSave = async () => {
    haptic.success();
    await upsertSleep({ bedtimeAt: bedtime.getTime(), wakeAt: wake.getTime(), quality });
    onClose();
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: palette.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700', flex: 1 }}>
              {promptMode ? '昨晚睡得怎樣？' : '編輯睡眠'}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}><Text style={{ color: palette.mute, fontSize: 22 }}>✕</Text></Pressable>
          </View>

          <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>上床時間</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}>
            <Pressable onPress={() => adjustBed(-30)} style={btn(palette)}><Text style={btnText(palette)}>−30</Text></Pressable>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' }}>{fmt(bedtime)}</Text>
            <Pressable onPress={() => adjustBed(+30)} style={btn(palette)}><Text style={btnText(palette)}>+30</Text></Pressable>
          </View>

          <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>起床時間</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}>
            <Pressable onPress={() => adjustWake(-30)} style={btn(palette)}><Text style={btnText(palette)}>−30</Text></Pressable>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' }}>{fmt(wake)}</Text>
            <Pressable onPress={() => adjustWake(+30)} style={btn(palette)}><Text style={btnText(palette)}>+30</Text></Pressable>
          </View>

          <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>時長</Text>
          <Text style={{ color: palette.primary, fontSize: 22, fontWeight: '700', marginBottom: 16 }}>{dh}h {dm}m</Text>

          <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>感覺</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const emoji = ['😴', '😐', '🙂', '😊', '⚡'][n - 1];
              const active = quality === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => { haptic.tapLight(); setQuality(n); }}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 8, marginHorizontal: 2,
                    borderRadius: 10,
                    backgroundColor: active ? palette.primary : palette.card,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={onSave}
            style={{ backgroundColor: palette.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
          >
            <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 16 }}>記錄</Text>
          </Pressable>
          <TutorialTip id="wake-prompt" delay={500} />
        </View>
      </View>
    </Modal>
  );
}

const btn = (p: any) => ({ backgroundColor: p.card, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 });
const btnText = (p: any) => ({ color: p.text, fontWeight: '600' as const });

export default SleepEditModal;
