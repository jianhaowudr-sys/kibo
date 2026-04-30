import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { WheelPicker } from '@/components/common/WheelPicker';
import * as haptic from '@/lib/haptic';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 強制顯示（起床 prompt 模式）：上床預設昨天 / 起床預設今天 */
  promptMode?: boolean;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINS = Array.from({ length: 12 }, (_, i) => i * 5);

// 上床 / 起床日期可選回推 14 天（補登記）
const DAY_OFFSETS = Array.from({ length: 15 }, (_, i) => i);

function nearestFiveMin(d: Date): number {
  return Math.round(d.getMinutes() / 5) * 5 % 60;
}

function dayOffsetFromToday(d: Date): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((now.getTime() - target.getTime()) / 86400_000));
}

function dayOffsetLabel(offset: number): string {
  if (offset === 0) return '今天';
  if (offset === 1) return '昨天';
  if (offset === 2) return '前天';
  const d = new Date(); d.setDate(d.getDate() - offset);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 睡眠編輯 + 起床 prompt 雙用 modal。
 * 上床日期 + 起床日期可獨立選擇（皆回推 14 天，方便補登記）。
 * 時間用 hour + minute 兩個 WheelPicker。
 */
export function SleepEditModal({ visible, onClose, promptMode }: Props) {
  const palette = useThemePalette();
  const sleepLast = useAppStore((s) => s.sleepLast);
  const settings = useAppStore((s) => s.healthSettings);
  const upsertSleep = useAppStore((s) => s.upsertSleep);
  const addNap = useAppStore((s) => s.addNap);
  const [kind, setKind] = useState<'main' | 'nap'>('main');

  // 預設值來源：promptMode → 昨晚 / 今早；非 prompt → 既有紀錄 OR 設定 target
  const defaults = useMemo(() => {
    const [bH, bM] = settings.sleep.targetBedtime.split(':').map(Number);
    const [wH, wM] = settings.sleep.targetWakeTime.split(':').map(Number);

    if (promptMode || !sleepLast) {
      const wake = new Date();
      wake.setHours(wH, wM, 0, 0);
      const bed = new Date();
      bed.setDate(bed.getDate() - 1);
      bed.setHours(bH, bM, 0, 0);
      return { bedtime: bed, wake };
    }

    const wake = new Date(sleepLast.wakeAt instanceof Date ? sleepLast.wakeAt : sleepLast.wakeAt);
    const bed = new Date(sleepLast.bedtimeAt instanceof Date ? sleepLast.bedtimeAt : sleepLast.bedtimeAt);
    return { bedtime: bed, wake };
  }, [promptMode, sleepLast, settings.sleep.targetBedtime, settings.sleep.targetWakeTime]);

  const [bedH, setBedH] = useState(defaults.bedtime.getHours());
  const [bedM, setBedM] = useState(nearestFiveMin(defaults.bedtime));
  const [wakeH, setWakeH] = useState(defaults.wake.getHours());
  const [wakeM, setWakeM] = useState(nearestFiveMin(defaults.wake));
  const [bedDayOffset, setBedDayOffset] = useState(dayOffsetFromToday(defaults.bedtime));
  const [wakeDayOffset, setWakeDayOffset] = useState(dayOffsetFromToday(defaults.wake));
  const [quality, setQuality] = useState(3);

  useEffect(() => {
    if (visible) {
      setBedH(defaults.bedtime.getHours());
      setBedM(nearestFiveMin(defaults.bedtime));
      setWakeH(defaults.wake.getHours());
      setWakeM(nearestFiveMin(defaults.wake));
      setBedDayOffset(dayOffsetFromToday(defaults.bedtime));
      setWakeDayOffset(dayOffsetFromToday(defaults.wake));
      setQuality(promptMode ? 3 : (sleepLast?.quality ?? 3));
      setKind('main');
    }
  }, [visible, defaults, sleepLast, promptMode]);

  // bed / wake 各自獨立由 dayOffset + 時分構成
  const computeDates = () => {
    const wake = new Date();
    wake.setDate(wake.getDate() - wakeDayOffset);
    wake.setHours(wakeH, wakeM, 0, 0);
    const bed = new Date();
    bed.setDate(bed.getDate() - bedDayOffset);
    bed.setHours(bedH, bedM, 0, 0);
    return { bed, wake };
  };

  const { bed: bedDate, wake: wakeDate } = computeDates();
  const dur = Math.max(0, Math.round((wakeDate.getTime() - bedDate.getTime()) / 60000));
  const dh = Math.floor(dur / 60);
  const dm = dur % 60;
  const invalid = bedDate.getTime() >= wakeDate.getTime();

  const onSave = async () => {
    if (invalid) {
      haptic.error();
      return;
    }
    haptic.success();
    if (kind === 'nap') {
      await addNap({ bedtimeAt: bedDate.getTime(), wakeAt: wakeDate.getTime(), quality });
    } else {
      await upsertSleep({ bedtimeAt: bedDate.getTime(), wakeAt: wakeDate.getTime(), quality });
    }
    onClose();
  };

  const HMRow = ({ label, h, m, setH, setM }: any) => (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <WheelPicker
          values={HOURS}
          value={h}
          onChange={setH}
          formatLabel={(v) => String(v).padStart(2, '0')}
          width={70}
          itemHeight={36}
          visibleCount={3}
        />
        <Text style={{ color: palette.text, fontSize: 22, fontWeight: '700' }}>:</Text>
        <WheelPicker
          values={MINS}
          value={m}
          onChange={setM}
          formatLabel={(v) => String(v).padStart(2, '0')}
          width={70}
          itemHeight={36}
          visibleCount={3}
        />
      </View>
    </View>
  );

  const DayPills = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 8 }}
      contentContainerStyle={{ gap: 6, paddingRight: 8 }}
    >
      {DAY_OFFSETS.map((offset) => {
        const active = value === offset;
        return (
          <Pressable
            key={offset}
            onPress={() => { haptic.tapLight(); onChange(offset); }}
            style={{
              paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14,
              backgroundColor: active ? palette.primary : palette.card,
            }}
          >
            <Text style={{ color: active ? palette.bg : palette.text, fontWeight: '600', fontSize: 11 }}>
              {dayOffsetLabel(offset)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: palette.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, maxHeight: '90%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700', flex: 1 }}>
              {promptMode ? '昨晚睡得怎樣？' : '編輯睡眠'}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}><Text style={{ color: palette.mute, fontSize: 22 }}>✕</Text></Pressable>
          </View>

          <ScrollView>
            {!promptMode && (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {([
                  { key: 'main', label: '😴 主睡', desc: '昨晚那覺' },
                  { key: 'nap', label: '🛌 小睡', desc: '午休/補眠' },
                ] as const).map((opt) => {
                  const active = kind === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => { haptic.tapLight(); setKind(opt.key); }}
                      style={{
                        flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                        backgroundColor: active ? palette.primary : palette.card,
                      }}
                    >
                      <Text style={{ color: active ? palette.bg : palette.text, fontWeight: '700' }}>{opt.label}</Text>
                      <Text style={{ color: active ? palette.bg : palette.mute, fontSize: 10, marginTop: 2 }}>{opt.desc}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>上床日期</Text>
            <DayPills value={bedDayOffset} onChange={setBedDayOffset} />
            <HMRow label={`上床時間（${dayOffsetLabel(bedDayOffset)}）`} h={bedH} m={bedM} setH={setBedH} setM={setBedM} />

            <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>起床日期</Text>
            <DayPills value={wakeDayOffset} onChange={setWakeDayOffset} />
            <HMRow label={`起床時間（${dayOffsetLabel(wakeDayOffset)}）`} h={wakeH} m={wakeM} setH={setWakeH} setM={setWakeM} />

            <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>時長</Text>
            <Text style={{ color: invalid ? palette.danger : palette.primary, fontSize: 24, fontWeight: '700', marginBottom: 4 }}>
              {invalid ? '⚠️ 起床時間需晚於上床' : `${dh}h ${dm}m`}
            </Text>
            <View style={{ height: 12 }} />

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
          </ScrollView>

          <Pressable
            onPress={onSave}
            disabled={invalid}
            style={{
              backgroundColor: invalid ? palette.card : palette.primary,
              paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 8,
              opacity: invalid ? 0.6 : 1,
            }}
          >
            <Text style={{ color: invalid ? palette.mute : palette.bg, fontWeight: '700', fontSize: 16 }}>記錄</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default SleepEditModal;
