import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { DEFAULT_DASHBOARD_LAYOUT, stringifyLayout } from '@/lib/dashboard';
import * as healthRepo from '@/db/health_repo';
import * as haptic from '@/lib/haptic';

export default function Onboarding() {
  const palette = useThemePalette();
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const update = useAppStore((s) => s.updateHealthSettings);
  const setLayoutJson = useAppStore((s) => s.setDashboardLayoutJson);
  const refreshUser = useAppStore((s) => s.refreshUser);

  const [step, setStep] = useState(0);
  const [trackWorkout, setTrackWorkout] = useState(true);
  const [trackMeals, setTrackMeals] = useState(true);
  const [trackHealth, setTrackHealth] = useState(true);
  const [trackPeriod, setTrackPeriod] = useState(false);
  const [petName, setPetName] = useState('Kibo');

  const next = () => { haptic.tapLight(); setStep((s) => s + 1); };
  const back = () => { haptic.tapLight(); setStep((s) => Math.max(0, s - 1)); };

  const finish = async () => {
    if (!user) return;
    haptic.success();

    // 套用使用者勾選到 dashboardLayout
    const layout = JSON.parse(JSON.stringify(DEFAULT_DASHBOARD_LAYOUT));
    layout.cards = layout.cards.map((c: any) => {
      if (c.id === 'today-workouts') c.visible = trackWorkout;
      if (c.id === 'today-meals') c.visible = trackMeals;
      if (c.id.startsWith('health-')) {
        if (c.id === 'health-period') c.visible = trackHealth && trackPeriod;
        else c.visible = trackHealth;
      }
      return c;
    });
    await setLayoutJson(stringifyLayout(layout));

    // 月經 opt-in
    if (trackPeriod) {
      await update({ period: { enabled: true, avgCycleDays: 28, avgPeriodDays: 5, predictionEnabled: true, pmsReminderEnabled: false } });
    }

    // 寵物名（如果有 active egg，命名是其後 hatch 後事，這裡只做完成標記）
    await healthRepo.setOnboardingCompleted(user.id);
    await refreshUser();
    router.replace('/(tabs)' as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, padding: 24, justifyContent: 'space-between' }}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        {step === 0 && (
          <View>
            <Text style={{ fontSize: 60, textAlign: 'center', marginBottom: 16 }}>🥚</Text>
            <Text style={{ color: palette.text, fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>
              Kibo 是你的健康伙伴
            </Text>
            <Text style={{ color: palette.mute, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
              用記錄日常運動、飲食、睡眠養大牠。{'\n'}
              不是打卡，是養牠。
            </Text>
          </View>
        )}

        {step === 1 && (
          <View>
            <Text style={{ fontSize: 50, textAlign: 'center', marginBottom: 16 }}>💪🍱😴</Text>
            <Text style={{ color: palette.text, fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>
              養牠的方式
            </Text>
            <Text style={{ color: palette.mute, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
              每天完成「動 / 食 / 息」三件事，{'\n'}
              寵物就會成長 + 心情變好。{'\n'}
              連續累積會解鎖新階段與獎勵。
            </Text>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={{ color: palette.text, fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 24 }}>
              你想追蹤什麼？
            </Text>
            <Toggle palette={palette} label="🏋️ 運動" v={trackWorkout} onChange={setTrackWorkout} />
            <Toggle palette={palette} label="🍱 飲食" v={trackMeals} onChange={setTrackMeals} />
            <Toggle palette={palette} label="💧 喝水 / 💩 排便 / 😴 睡眠" v={trackHealth} onChange={setTrackHealth} />
            <Toggle palette={palette} label="🌸 月經週期 (女性)" v={trackPeriod} onChange={setTrackPeriod} />
            <Text style={{ color: palette.mute, fontSize: 11, textAlign: 'center', marginTop: 12 }}>
              之後可以隨時在「我」分頁修改
            </Text>
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={{ fontSize: 60, textAlign: 'center', marginBottom: 16 }}>🥚</Text>
            <Text style={{ color: palette.text, fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 12 }}>
              這是你的蛋
            </Text>
            <Text style={{ color: palette.mute, fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
              幫牠取個名字，孵化後會延用
            </Text>
            <TextInput
              value={petName}
              onChangeText={setPetName}
              maxLength={12}
              placeholder="輸入名字"
              placeholderTextColor={palette.placeholder}
              style={{
                backgroundColor: palette.surface,
                color: palette.text,
                fontSize: 18,
                fontWeight: '600',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: palette.card,
                textAlign: 'center',
              }}
            />
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {step > 0 && (
          <Pressable onPress={back} style={{ backgroundColor: palette.card, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 }}>
            <Text style={{ color: palette.text, fontWeight: '600' }}>← 上一步</Text>
          </Pressable>
        )}
        <Pressable
          onPress={step === 3 ? finish : next}
          style={{ flex: 1, backgroundColor: palette.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
        >
          <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 16 }}>
            {step === 3 ? '開始 →' : '下一步 →'}
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              width: i === step ? 24 : 8, height: 6, borderRadius: 3,
              backgroundColor: i === step ? palette.primary : palette.card,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function Toggle({ palette, label, v, onChange }: any) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: palette.surface, padding: 16, borderRadius: 12, marginBottom: 8,
      borderWidth: 1, borderColor: palette.card,
    }}>
      <Text style={{ color: palette.text, flex: 1, fontWeight: '600' }}>{label}</Text>
      <Switch value={v} onValueChange={onChange} />
    </View>
  );
}
