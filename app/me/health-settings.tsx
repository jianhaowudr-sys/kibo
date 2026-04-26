import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, TextInput } from 'react-native';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { WheelPicker } from '@/components/common/WheelPicker';
import * as haptic from '@/lib/haptic';

const CUP_PRESETS = [200, 250, 300, 350, 400];
const BOTTLE_PRESETS = [500, 600, 750, 1000];

// 手掌長度 11~25 cm 步進 0.5
const PALM_LEN_VALUES = Array.from({ length: 29 }, (_, i) => 11 + i * 0.5);
// 手掌寬度 6~12 cm 步進 0.5
const PALM_WID_VALUES = Array.from({ length: 13 }, (_, i) => 6 + i * 0.5);

export default function HealthSettings() {
  const palette = useThemePalette();
  const settings = useAppStore((s) => s.healthSettings);
  const update = useAppStore((s) => s.updateHealthSettings);

  const [waterOpen, setWaterOpen] = useState(true);
  const [bowelOpen, setBowelOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);

  const Section = ({ title, open, onToggle, children }: any) => (
    <View style={{ backgroundColor: palette.surface, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: palette.card }}>
      <Pressable onPress={onToggle} style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
        <Text style={{ color: palette.text, fontWeight: '700', flex: 1 }}>{title}</Text>
        <Text style={{ color: palette.mute, fontSize: 18 }}>{open ? '−' : '＋'}</Text>
      </Pressable>
      {open && <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>{children}</View>}
    </View>
  );

  const RowSwitch = ({ label, value, onChange }: any) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
      <Text style={{ color: palette.text, flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );

  const PresetRow = ({ label, presets, value, onSelect }: any) => (
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
          label="提醒喝水（每 N 小時）"
          value={settings.water.reminder.enabled}
          onChange={(v: boolean) => update({ water: { ...settings.water, reminder: { ...settings.water.reminder, enabled: v } } })}
        />
        {settings.water.reminder.enabled && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: palette.mute, fontSize: 12 }}>每</Text>
            {[60, 90, 120, 180].map((m) => {
              const active = settings.water.reminder.intervalMin === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => update({ water: { ...settings.water, reminder: { ...settings.water.reminder, intervalMin: m } } })}
                  style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: active ? palette.primary : palette.card }}
                >
                  <Text style={{ color: active ? palette.bg : palette.text, fontSize: 12 }}>{m}m</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Section>

      <Section title="💩 排便" open={bowelOpen} onToggle={() => setBowelOpen(!bowelOpen)}>
        <RowSwitch
          label="每天固定提醒"
          value={settings.bowel.reminder.enabled}
          onChange={(v: boolean) => update({ bowel: { reminder: { ...settings.bowel.reminder, enabled: v } } })}
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
          onChange={(v: boolean) => update({ sleep: { ...settings.sleep, reminder: { ...settings.sleep.reminder, enabled: v } } })}
        />
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
    </ScrollView>
  );
}
