import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { WheelPicker } from '@/components/common/WheelPicker';
import * as haptic from '@/lib/haptic';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 強制顯示（起床 prompt 模式），即使昨晚已有紀錄 */
  promptMode?: boolean;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINS = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,10,...,55

// 起床日期可選回推 14 天（補昨天前忘記記）
const DAY_OFFSETS = Array.from({ length: 15 }, (_, i) => i); // 0=今天, 1=昨天, ...

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
 * 上下床時間用 hour + minute 兩個 WheelPicker，起床日期可回推 14 天。
 */
export function SleepEditModal({ visible, onClose, promptMode }: Props) {
  const palette = useThemePalette();
  const sleepLast = useAppStore((s) => s.sleepLast);
  const settings = useAppStore((s) => s.healthSettings);
  const upsertSleep = useAppStore((s) => s.upsertSleep);

  // 預設：歷史最近一筆 OR 設定的 target
  const defaults = useMemo(() => {
    if (sleepLast) {
      const wake = new Date(sleepLast.wakeAt instanceof Date ? sleepLast.wakeAt : sleepLast.wakeAt);
      const bed = new Date(sleepLast.bedtimeAt instanceof Date ? sleepLast.bedtimeAt : sleepLast.bedtimeAt);
      return { bedtime: bed, wake };
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

  const [bedH, setBedH] = useState(defaults.bedtime.getHours());
  const [bedM, setBedM] = useState(nearestFiveMin(defaults.bedtime));
  const [wakeH, setWakeH] = useState(defaults.wake.getHours());
  const [wakeM, setWakeM] = useState(nearestFiveMin(defaults.wake));
  const [wakeDayOffset, setWakeDayOffset] = useState(dayOffsetFromToday(defaults.wake));
  const [quality, setQuality] = useState(3);

  useEffect(() => {
    if (visible) {
      setBedH(defaults.bedtime.getHours());
      setBedM(nearestFiveMin(defaults.bedtime));
      setWakeH(defaults.wake.getHours());
      setWakeM(nearestFiveMin(defaults.wake));
      setWakeDayOffset(dayOffsetFromToday(defaults.wake));
      setQuality(sleepLast?.quality ?? 3);
    }
  }, [visible, defaults, sleepLast]);

  // 計算實際 Date：wake 為「(今天 - offset) 的 wakeH:wakeM」
  // bed 預設為 wake 同天的 bedH:bedM；若 bed 比 wake 晚（跨夜情境，例如 bed 23:00 / wake 07:00）→ 退到前一天
  const computeDates = () => {
    const wake = new Date();
    wake.setDate(wake.getDate() - wakeDayOffset);
    wake.setHours(wakeH, wakeM, 0, 0);
    const bed = new Date(wake);
    bed.setHours(bedH, bedM, 0, 0);
    if (bed.getTime() >= wake.getTime()) {
      bed.setDate(bed.getDate() - 1);
    }
    return { bed, wake };
  };

  const { bed: bedDate, wake: wakeDate } = computeDates();
  const dur = Math.max(0, Math.round((wakeDate.getTime() - bedDate.getTime()) / 60000));
  const dh = Math.floor(dur / 60);
  const dm = dur % 60;

  const onSave = async () => {
    haptic.success();
    await upsertSleep({ bedtimeAt: bedDate.getTime(), wakeAt: wakeDate.getTime(), quality });
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
            {/* 起床日期選擇（pill list 橫滑）*/}
            <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>起床日期</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
              {DAY_OFFSETS.map((offset) => {
                const active = wakeDayOffset === offset;
                return (
                  <Pressable
                    key={offset}
                    onPress={() => { haptic.tapLight(); setWakeDayOffset(offset); }}
                    style={{
                      paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16,
                      backgroundColor: active ? palette.primary : palette.card,
                    }}
                  >
                    <Text style={{ color: active ? palette.bg : palette.text, fontWeight: '600', fontSize: 12 }}>
                      {dayOffsetLabel(offset)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <HMRow label={`上床時間（${dayOffsetLabel(dayOffsetFromToday(bedDate))}）`} h={bedH} m={bedM} setH={setBedH} setM={setBedM} />
            <HMRow label={`起床時間（${dayOffsetLabel(wakeDayOffset)}）`} h={wakeH} m={wakeM} setH={setWakeH} setM={setWakeM} />

            <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>時長</Text>
            <Text style={{ color: palette.primary, fontSize: 24, fontWeight: '700', marginBottom: 16 }}>{dh}h {dm}m</Text>

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
            style={{ backgroundColor: palette.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 8 }}
          >
            <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 16 }}>記錄</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default SleepEditModal;
