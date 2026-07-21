import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Switch, TextInput, Alert, Platform, Linking } from 'react-native';
import { useAppStore } from '@/stores/useAppStore';
import { ensurePermission } from '@/lib/reminders';
import { useThemePalette } from '@/lib/useThemePalette';
import { WheelPicker } from '@/components/common/WheelPicker';
import * as haptic from '@/lib/haptic';
import { isOffLookupEnabled, setOffLookupEnabled } from '@/lib/food_lookup';
import {
  isHealthAvailable,
  getHealthSyncEnabled,
  setHealthSyncEnabled,
  requestHealthPermissions,
  readTodaySteps,
  readTodayActiveEnergy,
} from '@/lib/health_kit';

const CUP_PRESETS = [200, 250, 300, 350, 400];
const BOTTLE_PRESETS = [500, 600, 750, 1000];
const WATER_TIME_PRESETS = ['8:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];

// 手掌長度 11~25 cm 步進 0.5
const PALM_LEN_VALUES = Array.from({ length: 29 }, (_, i) => 11 + i * 0.5);
// 手掌寬度 6~12 cm 步進 0.5
const PALM_WID_VALUES = Array.from({ length: 13 }, (_, i) => 6 + i * 0.5);

/**
 * ⚠️ 這三個元件必須定義在模組層。
 * 原本定義在 HealthSettings 的 render body 內 → 每次 render 都是**新的元件型別**，
 * React 會卸載並重新掛載整棵子樹，導致睡眠時間等 TextInput **每打一個字就失焦**。
 */
function Section({ title, open, onToggle, children }: any) {
  const palette = useThemePalette();
  return (
    <View style={{ backgroundColor: palette.surface, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: palette.card }}>
      <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
        <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }}>{title}</Text>
        <Text style={{ color: palette.mute, fontSize: 18 }}>{open ? '−' : '＋'}</Text>
      </Pressable>
      {open && <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>{children}</View>}
    </View>
  );

}

function RowSwitch({ label, value, onChange }: any) {
  const palette = useThemePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
      <Text style={{ color: palette.text, flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );

}

function PresetRow({ label, presets, value, onSelect }: any) {
  const palette = useThemePalette();
  return (
    <View style={{ paddingVertical: 8 }}>
      <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {presets.map((p: number) => {
          const active = value === p;
          return (
            <Pressable
              key={p}
              onPress={() => { haptic.tapLight(); onSelect(p); }}
              style={{
                paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8,
                backgroundColor: active ? palette.primary : palette.card,
              }}
            >
              <Text style={{ color: active ? palette.bg : palette.text, fontWeight: '600', fontSize: 12 }}>{p}ml</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function HealthSettings() {
  const palette = useThemePalette();
  const settings = useAppStore((s) => s.healthSettings);
  const update = useAppStore((s) => s.updateHealthSettings);
  const recomputeSleepDayKeys = useAppStore((s) => s.recomputeSleepDayKeys);

  const onChangeCutoff = (v: number) => {
    haptic.tapLight();
    const prev = settings.sleep.crossNightCutoffHour;
    if (v === prev) return;
    update({ sleep: { ...settings.sleep, crossNightCutoffHour: v } });
    Alert.alert(
      '要重算過去的睡眠歸日嗎？',
      `已把跨夜分日點改成凌晨 ${v}:00。要不要用新規則重算所有過去主睡的歸屬日期？`,
      [
        { text: '稍後', style: 'cancel' },
        {
          text: '重算',
          onPress: async () => {
            haptic.tapMedium();
            const updated = await recomputeSleepDayKeys();
            haptic.success();
            Alert.alert('已重算', `更新了 ${updated} 筆主睡紀錄。`);
          },
        },
      ],
    );
  };

  // 開啟提醒前先確保通知權限；未授權則不開啟並引導去設定（修 iOS 靜默不送達）。
  const enableReminder = async (apply: (on: boolean) => void, v: boolean) => {
    if (!v) { apply(false); return; }
    let perm: 'granted' | 'denied' | 'blocked';
    try {
      perm = await ensurePermission();
    } catch (e) {
      // 沒有 try/catch 的話會變成 unhandled rejection 且使用者完全沒有回饋
      console.warn('[reminders] ensurePermission failed', e);
      Alert.alert('無法開啟提醒', '取得通知權限時發生問題，請稍後再試。');
      return;
    }
    if (perm === 'granted') { apply(true); return; }
    if (perm === 'blocked') {
      Alert.alert('通知未開啟', '請到「設定」開啟 Kibo 的通知後再試一次。', [
        { text: '取消', style: 'cancel' },
        { text: '去設定', onPress: () => Linking.openSettings() },
      ]);
    }
    // denied（使用者當下拒絕但可再問）→ 保持關閉，不另跳提示
  };

  const [waterOpen, setWaterOpen] = useState(true);
  const [bowelOpen, setBowelOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [offEnabled, setOffEnabled] = useState(true);
  useEffect(() => { isOffLookupEnabled().then(setOffEnabled); }, []);

  const [healthOpen, setHealthOpen] = useState(false);
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [healthSyncOn, setHealthSyncOn] = useState(false);
  const [todaySteps, setTodaySteps] = useState(0);
  const [todayEnergy, setTodayEnergy] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !isHealthAvailable()) return;
    setHealthAvailable(true);
    getHealthSyncEnabled().then((on) => {
      setHealthSyncOn(on);
      if (on) {
        readTodaySteps().then(setTodaySteps);
        readTodayActiveEnergy().then(setTodayEnergy);
      }
    });
  }, []);

  const onToggleHealthSync = async (v: boolean) => {
    if (v) {
      const ok = await requestHealthPermissions();
      if (ok) {
        await setHealthSyncEnabled(true);
        setHealthSyncOn(true);
        readTodaySteps().then(setTodaySteps);
        readTodayActiveEnergy().then(setTodayEnergy);
      } else {
        Alert.alert('無法啟用', '請至「設定 App ＞ 隱私權與安全性 ＞ 健康」授權 Kibo 存取健康資料後再試一次。');
      }
    } else {
      await setHealthSyncEnabled(false);
      setHealthSyncOn(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 16 }}>
      <Section title="💧 喝水" open={waterOpen} onToggle={() => setWaterOpen(!waterOpen)}>
        <View style={{ paddingVertical: 8 }}>
          <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>每日目標</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => update({ water: { ...settings.water, dailyGoalMl: Math.max(500, settings.water.dailyGoalMl - 250) } })}
              style={{ backgroundColor: palette.card, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 }}
            >
              <Text style={{ color: palette.text }}>−250</Text>
            </Pressable>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' }}>
              {settings.water.dailyGoalMl} ml
            </Text>
            <Pressable
              onPress={() => update({ water: { ...settings.water, dailyGoalMl: Math.min(5000, settings.water.dailyGoalMl + 250) } })}
              style={{ backgroundColor: palette.card, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 }}
            >
              <Text style={{ color: palette.text }}>+250</Text>
            </Pressable>
          </View>
        </View>

        <PresetRow
          label="偏好杯子（中央 chip）"
          presets={CUP_PRESETS}
          value={settings.water.favoriteCupMl}
          onSelect={(v: number) => update({ water: { ...settings.water, favoriteCupMl: v } })}
        />
        <PresetRow
          label="水壺（右側 chip）"
          presets={BOTTLE_PRESETS}
          value={settings.water.bottleMl}
          onSelect={(v: number) => update({ water: { ...settings.water, bottleMl: v } })}
        />

        <RowSwitch
          label="提醒喝水（固定時間）"
          value={settings.water.reminder.enabled}
          onChange={(v: boolean) => enableReminder((on) => update({ water: { ...settings.water, reminder: { ...settings.water.reminder, enabled: on } } }), v)}
        />
        {settings.water.reminder.enabled && (
          <View>
            <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>提醒時間（可多選）</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {WATER_TIME_PRESETS.map((t) => {
                const times = settings.water.reminder.fixedTimes ?? [];
                const active = times.includes(t);
                return (
                  <Pressable
                    key={t}
                    onPress={() => {
                      const next = active ? times.filter((x) => x !== t) : [...times, t];
                      update({ water: { ...settings.water, reminder: { ...settings.water.reminder, type: 'fixed', fixedTimes: next } } });
                    }}
                    style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: active ? palette.primary : palette.card }}
                  >
                    <Text style={{ color: active ? palette.bg : palette.text, fontSize: 12 }}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </Section>

      <Section title="💩 排便" open={bowelOpen} onToggle={() => setBowelOpen(!bowelOpen)}>
        <RowSwitch
          label="每天固定提醒"
          value={settings.bowel.reminder.enabled}
          onChange={(v: boolean) => enableReminder((on) => update({ bowel: { reminder: { ...settings.bowel.reminder, enabled: on } } }), v)}
        />
        {settings.bowel.reminder.enabled && (
          <Text style={{ color: palette.mute, fontSize: 12 }}>提醒時間：{settings.bowel.reminder.fixedTimes?.[0] ?? '20:00'}</Text>
        )}
      </Section>

      <Section title="😴 睡眠" open={sleepOpen} onToggle={() => setSleepOpen(!sleepOpen)}>
        <View style={{ paddingVertical: 8 }}>
          <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>目標時長</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => update({ sleep: { ...settings.sleep, targetDurationMin: Math.max(300, settings.sleep.targetDurationMin - 30) } })}
              style={{ backgroundColor: palette.card, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 }}
            >
              <Text style={{ color: palette.text }}>−30m</Text>
            </Pressable>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' }}>
              {Math.floor(settings.sleep.targetDurationMin / 60)}h {settings.sleep.targetDurationMin % 60}m
            </Text>
            <Pressable
              onPress={() => update({ sleep: { ...settings.sleep, targetDurationMin: Math.min(720, settings.sleep.targetDurationMin + 30) } })}
              style={{ backgroundColor: palette.card, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 }}
            >
              <Text style={{ color: palette.text }}>+30m</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ paddingVertical: 8 }}>
          <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>目標上床時間</Text>
          <TextInput
            value={settings.sleep.targetBedtime}
            onChangeText={(v) => update({ sleep: { ...settings.sleep, targetBedtime: v } })}
            placeholder="HH:MM"
            placeholderTextColor={palette.placeholder}
            style={{ backgroundColor: palette.card, color: palette.text, padding: 8, borderRadius: 8 }}
          />
        </View>
        <View style={{ paddingVertical: 8 }}>
          <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>目標起床時間</Text>
          <TextInput
            value={settings.sleep.targetWakeTime}
            onChangeText={(v) => update({ sleep: { ...settings.sleep, targetWakeTime: v } })}
            placeholder="HH:MM"
            placeholderTextColor={palette.placeholder}
            style={{ backgroundColor: palette.card, color: palette.text, padding: 8, borderRadius: 8 }}
          />
        </View>
        <RowSwitch
          label="起床自動跳記錄 prompt"
          value={settings.sleep.wakePrompt.enabled}
          onChange={(v: boolean) => update({ sleep: { ...settings.sleep, wakePrompt: { ...settings.sleep.wakePrompt, enabled: v } } })}
        />
        <RowSwitch
          label="睡前提醒"
          value={settings.sleep.reminder.enabled}
          onChange={(v: boolean) => enableReminder((on) => update({ sleep: { ...settings.sleep, reminder: { ...settings.sleep.reminder, enabled: on } } }), v)}
        />
        <View style={{ paddingVertical: 8 }}>
          <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>跨夜分日點</Text>
          <Text style={{ color: palette.mute, fontSize: 11, lineHeight: 16, marginBottom: 6 }}>
            上床時間早於這個小時 → 算前一天的睡眠延伸（熬夜）。預設 4:00。
            {'\n'}例：cutoff = 4 時，「11/10 02:00 上床」算 11/9；「11/10 04:30 上床」算 11/10。
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
            {Array.from({ length: 13 }, (_, i) => i).map((h) => {
              const active = settings.sleep.crossNightCutoffHour === h;
              return (
                <Pressable
                  key={h}
                  onPress={() => onChangeCutoff(h)}
                  style={{
                    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14,
                    backgroundColor: active ? palette.primary : palette.card,
                  }}
                >
                  <Text style={{ color: active ? palette.bg : palette.text, fontWeight: '600', fontSize: 12 }}>
                    {String(h).padStart(2, '0')}:00
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Section>

      <Section title="🌸 月經週期" open={periodOpen} onToggle={() => setPeriodOpen(!periodOpen)}>
        <RowSwitch
          label="啟用月經追蹤"
          value={settings.period.enabled}
          onChange={(v: boolean) => update({ period: { ...settings.period, enabled: v } })}
        />
        {settings.period.enabled && (
          <>
            <View style={{ paddingVertical: 8 }}>
              <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>平均週期天數（3 個週期後自動覆寫）</Text>
              <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700' }}>{settings.period.avgCycleDays} 天</Text>
            </View>
            <View style={{ paddingVertical: 8 }}>
              <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 6 }}>平均經期天數</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[3, 4, 5, 6, 7].map((n) => {
                  const active = settings.period.avgPeriodDays === n;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => update({ period: { ...settings.period, avgPeriodDays: n } })}
                      style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: active ? palette.primary : palette.card }}
                    >
                      <Text style={{ color: active ? palette.bg : palette.text, fontSize: 12 }}>{n}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <RowSwitch
              label="顯示下次經期預估"
              value={settings.period.predictionEnabled}
              onChange={(v: boolean) => update({ period: { ...settings.period, predictionEnabled: v } })}
            />
            <RowSwitch
              label="PMS 提醒（預估前 2 天）"
              value={settings.period.pmsReminderEnabled}
              onChange={(v: boolean) => update({ period: { ...settings.period, pmsReminderEnabled: v } })}
            />
          </>
        )}
      </Section>

      <Section title="📏 我的手掌尺寸（給 AI 估食物份量用）" open={bodyOpen} onToggle={() => setBodyOpen(!bodyOpen)}>
        <Text style={{ color: palette.mute, fontSize: 11, lineHeight: 18, marginBottom: 12 }}>
          填了之後，飲食拍照時可勾選「手掌入鏡」讓 AI 用你的手掌當比例尺，份量估算更精準（解決常見高估問題）。
          {'\n\n'}
          測量方式：張開五指平放在桌面，用尺量：
          {'\n'}• 長：中指尖到手腕橫紋
          {'\n'}• 寬：四指張開根部的橫寬（不含拇指）
        </Text>

        <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', marginBottom: 12 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: palette.mute, fontSize: 11, marginBottom: 4 }}>長 (cm)</Text>
            <WheelPicker
              values={PALM_LEN_VALUES}
              value={settings.body.palmLengthCm}
              onChange={(v) => update({ body: { ...settings.body, palmLengthCm: v as number } })}
              formatLabel={(v) => String(v)}
              width={80}
              itemHeight={36}
              visibleCount={3}
              activeFontSize={22}
            />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: palette.mute, fontSize: 11, marginBottom: 4 }}>寬 (cm)</Text>
            <WheelPicker
              values={PALM_WID_VALUES}
              value={settings.body.palmWidthCm}
              onChange={(v) => update({ body: { ...settings.body, palmWidthCm: v as number } })}
              formatLabel={(v) => String(v)}
              width={80}
              itemHeight={36}
              visibleCount={3}
              activeFontSize={22}
            />
          </View>
        </View>

        <View style={{ backgroundColor: palette.card, padding: 10, borderRadius: 8 }}>
          <Text style={{ color: palette.text, fontSize: 12 }}>
            ✋ 你的手掌：{settings.body.palmLengthCm} × {settings.body.palmWidthCm} cm
          </Text>
          <Text style={{ color: palette.mute, fontSize: 10, marginTop: 4 }}>
            參考：成人男平均 18×9、女平均 16×8
          </Text>
        </View>
      </Section>

      <Section title="📷 條碼掃描" open={scanOpen} onToggle={() => setScanOpen(!scanOpen)}>
        <RowSwitch
          label="查無條碼時聯網查 Open Food Facts"
          value={offEnabled}
          onChange={async (v: boolean) => { setOffEnabled(v); await setOffLookupEnabled(v); }}
        />
        <Text style={{ color: palette.mute, fontSize: 11, marginTop: 4 }}>
          關閉後只用「已掃過的本地紀錄」與「拍營養標」，不會聯網。
        </Text>
      </Section>

      {Platform.OS === 'ios' && healthAvailable && (
        <Section title="🍎 Apple Health" open={healthOpen} onToggle={() => setHealthOpen(!healthOpen)}>
          <RowSwitch label="同步 Apple Health" value={healthSyncOn} onChange={onToggleHealthSync} />
          {healthSyncOn && (
            <Text style={{ color: palette.mute, fontSize: 12, marginTop: 4 }}>
              今日 · 步數 {todaySteps} ・ 活動能量 {todayEnergy} kcal
            </Text>
          )}
        </Section>
      )}
    </ScrollView>
  );
}
