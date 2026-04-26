import { View, Text, ScrollView, Pressable, TextInput, Alert, Image as ExpoImage } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { WeeklyChart } from '@/components/WeeklyChart';
import { StatCard } from '@/components/StatCard';
import { PetCard } from '@/components/PetCard';
import { last7Days, displayDate, formatDuration } from '@/lib/date';
import { startOfDay, startOfMonth, subDays } from 'date-fns';
import * as repo from '@/db/repo';
import { levelFromExp } from '@/lib/exp';
import { resetDatabase } from '@/db/migrate';
import {
  MODELS, PROVIDER_LABEL, PROVIDER_SIGNUP_URL,
  getActiveModelId, setActiveModelId, getProviderKey, setProviderKey,
  type AIModelId, type AIProvider, type ModelInfo,
} from '@/lib/ai_provider';
import { clearMealMemory, getMemoryStats } from '@/lib/memory';
import { exportAll, importAll } from '@/lib/backup';
import { useThemePalette } from '@/lib/useThemePalette';
import { importStrongCSV } from '@/lib/csv_import';
import { type ThemeMode, type ThemeStyle } from '@/lib/theme';
import { PixelCard } from '@/components/common/PixelCard';
import { PixelButton } from '@/components/common/PixelButton';
import { isSupabaseConfigured } from '@/lib/supabase';
import * as haptic from '@/lib/haptic';

type Section = 'stats' | 'body' | 'pets' | 'profile';

const GOALS = [
  { code: 'lose', label: '減脂' },
  { code: 'gain', label: '增肌' },
  { code: 'fit', label: '保持健康' },
  { code: 'strong', label: '變強' },
];

export default function MeScreen() {
  const palette = useThemePalette();
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const weeklyExp = useAppStore((s) => s.weeklyExp);
  const workoutDates = useAppStore((s) => s.workoutDates);
  const weeklyCount = useAppStore((s) => s.weeklyCount);
  const pets = useAppStore((s) => s.pets);
  const activeEgg = useAppStore((s) => s.activeEgg);
  const bodyMeasurements = useAppStore((s) => s.bodyMeasurements);
  const refreshHistory = useAppStore((s) => s.refreshHistory);
  const refreshBodyMeasurements = useAppStore((s) => s.refreshBodyMeasurements);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const bootstrap = useAppStore((s) => s.bootstrap);

  const [section, setSection] = useState<Section>('stats');
  const [activeModelId, setActiveModelIdState] = useState<AIModelId>('openai-gpt-4o');
  const [keysByProvider, setKeysByProvider] = useState<Record<AIProvider, string>>({
    openai: '', anthropic: '', gemini: '', minimax: '', 'minimax-cn': '',
  });
  const [keyMasked, setKeyMasked] = useState(true);
  const [memStats, setMemStats] = useState<{ count: number; totalLogs: number; topNames: string[] }>({ count: 0, totalLogs: 0, topNames: [] });
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const themeStyle = useAppStore((s) => s.themeStyle);
  const setThemeStyle = useAppStore((s) => s.setThemeStyle);
  const lowPowerMode = useAppStore((s) => s.lowPowerMode);
  const setLowPowerMode = useAppStore((s) => s.setLowPowerMode);
  const authSession = useAppStore((s) => s.authSession);
  const authLoading = useAppStore((s) => s.authLoading);
  const signUpEmail = useAppStore((s) => s.signUpEmail);
  const signInEmail = useAppStore((s) => s.signInEmail);
  const resetPasswordEmail = useAppStore((s) => s.resetPasswordEmail);
  const syncCloud = useAppStore((s) => s.syncCloud);
  const syncStatus = useAppStore((s) => s.syncStatus);
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt);
  const [syncing, setSyncing] = useState(false);
  const logout = useAppStore((s) => s.logout);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  const [statsRange, setStatsRange] = useState<'today' | '7d' | '14d' | 'thisMonth' | '30d'>('7d');
  const [statsPanel, setStatsPanel] = useState<string | null>('workout');
  const [workoutStats, setWorkoutStats] = useState<{ count: number; totalExp: number; totalVolume: number; totalDurSec: number; uniqueDays: number } | null>(null);
  const [mealStats, setMealStats] = useState<{ count: number; uniqueDays: number; totalCalories: number; totalProtein: number; totalCarb: number; totalFat: number; avgCalPerDay: number; avgProteinPerDay: number } | null>(null);
  const [bodyDelta, setBodyDelta] = useState<Awaited<ReturnType<typeof repo.rangeBodyDelta>> | null>(null);
  const toggleStatsPanel = (k: string) => {
    haptic.tapLight();
    setStatsPanel((p) => (p === k ? null : k));
  };
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const togglePanel = (k: string) => {
    haptic.tapLight();
    setOpenPanel((prev) => (prev === k ? null : k));
  };

  const [name, setName] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState('fit');
  const [dailyExpGoal, setDailyExpGoal] = useState('');
  const [weeklyDaysGoal, setWeeklyDaysGoal] = useState('');
  const [dailyCaloriesGoal, setDailyCaloriesGoal] = useState('');
  const [dailyProteinGoal, setDailyProteinGoal] = useState('');

  const reloadMemStats = () => {
    getMemoryStats().then(setMemStats);
  };

  useEffect(() => {
    refreshHistory();
    refreshBodyMeasurements();
    (async () => {
      const id = await getActiveModelId();
      setActiveModelIdState(id);
      const [o, a, g, mi, mc] = await Promise.all([
        getProviderKey('openai'),
        getProviderKey('anthropic'),
        getProviderKey('gemini'),
        getProviderKey('minimax'),
        getProviderKey('minimax-cn'),
      ]);
      setKeysByProvider({
        openai: o ?? '',
        anthropic: a ?? '',
        gemini: g ?? '',
        minimax: mi ?? '',
        'minimax-cn': mc ?? '',
      });
    })();
    reloadMemStats();
  }, [refreshHistory, refreshBodyMeasurements]);

  const activeModel: ModelInfo = MODELS.find((m) => m.id === activeModelId) ?? MODELS[0];
  const activeProvider: AIProvider = activeModel.provider;

  const onPickModel = async (id: AIModelId) => {
    haptic.tapLight();
    setActiveModelIdState(id);
    await setActiveModelId(id);
  };

  const onSaveProviderKey = async () => {
    haptic.tapMedium();
    await setProviderKey(activeProvider, keysByProvider[activeProvider].trim());
    haptic.success();
    Alert.alert('✅ API Key 已儲存', `${PROVIDER_LABEL[activeProvider]} 的 Key 已更新`);
  };

  const chooseTheme = async (m: ThemeMode) => {
    haptic.tapLight();
    await setThemeMode(m);
  };

  const chooseThemeStyle = async (s: ThemeStyle) => {
    haptic.tapLight();
    await setThemeStyle(s);
  };

  useEffect(() => {
    if (section === 'profile') reloadMemStats();
  }, [section]);

  useEffect(() => {
    if (section !== 'stats' || !user) return;
    const now = new Date();
    const end = now.getTime();
    let start: number;
    if (statsRange === 'today') start = startOfDay(now).getTime();
    else if (statsRange === '7d') start = subDays(startOfDay(now), 6).getTime();
    else if (statsRange === '14d') start = subDays(startOfDay(now), 13).getTime();
    else if (statsRange === 'thisMonth') start = startOfMonth(now).getTime();
    else start = subDays(startOfDay(now), 29).getTime();

    (async () => {
      const [w, m, b] = await Promise.all([
        repo.rangeWorkoutSummary(user.id, start, end),
        repo.rangeMealSummary(user.id, start, end),
        repo.rangeBodyDelta(user.id, start, end),
      ]);
      setWorkoutStats(w);
      setMealStats(m);
      setBodyDelta(b);
    })();
  }, [section, statsRange, user]);

  const onClearMemory = () => {
    Alert.alert(
      '清空食物記憶？',
      `會清除 ${memStats.count} 項、共 ${memStats.totalLogs} 次紀錄。\nAI 判讀會回到初始準度，之後重新累積。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '確定清空',
          style: 'destructive',
          onPress: async () => {
            haptic.warning();
            await clearMealMemory();
            reloadMemStats();
            Alert.alert('✅ 已清空');
          },
        },
      ],
    );
  };


  useEffect(() => {
    if (user) {
      setName(user.name);
      setHeight(user.heightCm?.toString() ?? '');
      setWeight(user.weightKg?.toString() ?? '');
      setGoal(user.goal);
      setDailyExpGoal(user.dailyExpGoal.toString());
      setWeeklyDaysGoal(user.weeklyDaysGoal.toString());
      setDailyCaloriesGoal(user.dailyCaloriesGoal.toString());
      setDailyProteinGoal(user.dailyProteinGoal.toString());
    }
  }, [user]);

  if (!user) return null;

  const lvl = levelFromExp(user.totalExp);
  const days = last7Days();
  const data: Record<string, number> = {};
  for (const d of days) data[d] = weeklyExp[d] ?? 0;
  const weekTotal = days.reduce((s, k) => s + (weeklyExp[k] ?? 0), 0);
  const bmi = user.heightCm && user.weightKg
    ? (user.weightKg / Math.pow(user.heightCm / 100, 2)).toFixed(1)
    : '-';
  const weeklyGoal = user.weeklyDaysGoal || 3;
  const goalPct = Math.min(1, weeklyCount / weeklyGoal);

  const save = async () => {
    haptic.tapMedium();
    await updateProfile({
      name: name.trim() || '健身新手',
      heightCm: height ? Number(height) : null,
      weightKg: weight ? Number(weight) : null,
      goal,
      dailyExpGoal: dailyExpGoal ? Number(dailyExpGoal) : 100,
      weeklyDaysGoal: weeklyDaysGoal ? Number(weeklyDaysGoal) : 3,
      dailyCaloriesGoal: dailyCaloriesGoal ? Number(dailyCaloriesGoal) : 2000,
      dailyProteinGoal: dailyProteinGoal ? Number(dailyProteinGoal) : 100,
    });
    haptic.success();
    Alert.alert('✅ 已儲存');
  };

  const reset = () => {
    Alert.alert('重置所有資料？', '訓練紀錄、課表、寵物、蛋都會刪除', [
      { text: '取消', style: 'cancel' },
      {
        text: '確定重置',
        style: 'destructive',
        onPress: async () => {
          haptic.warning();
          await resetDatabase();
          await bootstrap();
          Alert.alert('✅ 已重置');
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-kibo-bg">
      <View className="flex-row bg-kibo-surface border-b border-kibo-card">
        {(['stats', 'body', 'pets', 'profile'] as Section[]).map((s) => (
          <Pressable
            key={s}
            onPress={() => {
              haptic.tapLight();
              setSection(s);
            }}
            className={`flex-1 py-3 ${section === s ? 'border-b-2 border-kibo-primary' : ''}`}
          >
            <Text className={`text-center font-semibold text-xs ${section === s ? 'text-kibo-primary' : 'text-kibo-mute'}`}>
              {s === 'stats' ? '📊 數據' : s === 'body' ? '📷 體態' : s === 'pets' ? '🐣 寵物' : '⚙️ 設定'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {section === 'stats' && (
          <>
            {/* 範圍 pill selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              <View className="flex-row gap-2">
                {([
                  { code: 'today' as const, label: '今日' },
                  { code: '7d' as const, label: '近 1 週' },
                  { code: '14d' as const, label: '近 2 週' },
                  { code: 'thisMonth' as const, label: '本月' },
                  { code: '30d' as const, label: '近 1 個月' },
                ]).map((o) => {
                  const active = statsRange === o.code;
                  return (
                    <Pressable
                      key={o.code}
                      onPressIn={() => haptic.tapLight()}
                      onPress={() => setStatsRange(o.code)}
                      className={`px-4 py-2 rounded-full ${active ? 'bg-kibo-primary' : 'bg-kibo-surface border border-kibo-card'}`}
                    >
                      <Text className={`text-xs font-semibold ${active ? 'text-kibo-bg' : 'text-kibo-text'}`}>
                        {o.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* 總覽卡片 */}
            <View className="flex-row gap-3 mb-3">
              <StatCard label="訓練家等級" value={lvl.level} icon="🏆" color="text-kibo-accent" />
              <StatCard label="連續天數" value={user.streak} suffix="天" icon="🔥" color="text-kibo-accent" />
            </View>

            <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-3">
              <Text className="text-kibo-mute text-xs mb-2">升等進度</Text>
              <View className="flex-row items-baseline justify-between mb-2">
                <Text className="text-kibo-text text-2xl font-bold">LV.{lvl.level}</Text>
                <Text className="text-kibo-mute text-xs">{lvl.current} / {lvl.required} EXP</Text>
              </View>
              <View className="h-3 bg-kibo-card rounded-full overflow-hidden">
                <View
                  className="h-3 bg-kibo-primary rounded-full"
                  style={{ width: `${(lvl.current / lvl.required) * 100}%` }}
                />
              </View>
            </View>

            <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-kibo-mute text-xs">本週目標</Text>
                <Text className="text-kibo-text text-sm font-semibold">{weeklyCount} / {weeklyGoal} 天</Text>
              </View>
              <View className="h-3 bg-kibo-card rounded-full overflow-hidden">
                <View
                  className={`h-3 rounded-full ${goalPct >= 1 ? 'bg-kibo-success' : 'bg-kibo-accent'}`}
                  style={{ width: `${goalPct * 100}%` }}
                />
              </View>
            </View>

            {/* 近 7 日圖表（常駐） */}
            <View className="mb-3">
              <WeeklyChart data={data} />
            </View>

            {/* Panel: 訓練數據 */}
            <Panel
              id="workout"
              open={statsPanel === 'workout'}
              onToggle={toggleStatsPanel}
              icon="💪"
              title="訓練數據"
              summary={workoutStats ? `${workoutStats.count} 次 · ${workoutStats.totalExp} EXP · ${workoutStats.uniqueDays} 天` : '載入中'}
            >
              {workoutStats && (
                <>
                  <View className="flex-row gap-2 mb-2">
                    <StatCard label="訓練次數" value={workoutStats.count} suffix="次" icon="🏋️" />
                    <StatCard label="訓練天數" value={workoutStats.uniqueDays} suffix="天" icon="📅" />
                  </View>
                  <View className="flex-row gap-2 mb-2">
                    <StatCard label="累計 EXP" value={workoutStats.totalExp} icon="⚡" color="text-kibo-success" />
                    <StatCard label="總時長" value={formatDuration(workoutStats.totalDurSec)} icon="⏱" />
                  </View>
                  <View className="flex-row gap-2">
                    <StatCard label="訓練量" value={workoutStats.totalVolume.toFixed(0)} suffix="kg·reps" icon="📊" />
                  </View>
                </>
              )}
            </Panel>

            {/* Panel: 飲食數據 */}
            <Panel
              id="meal"
              open={statsPanel === 'meal'}
              onToggle={toggleStatsPanel}
              icon="🍱"
              title="飲食數據"
              summary={mealStats ? `${mealStats.count} 餐 · ${mealStats.uniqueDays} 天 · 日均 ${mealStats.avgCalPerDay} kcal` : '載入中'}
            >
              {mealStats && (
                <>
                  <View className="flex-row gap-2 mb-2">
                    <StatCard label="記錄餐數" value={mealStats.count} suffix="餐" icon="🍽" />
                    <StatCard label="記錄天數" value={mealStats.uniqueDays} suffix="天" icon="📅" />
                  </View>
                  <View className="flex-row gap-2 mb-2">
                    <StatCard label="日均熱量" value={mealStats.avgCalPerDay} suffix="kcal" icon="🔥" color="text-kibo-primary" />
                    <StatCard label="日均蛋白" value={mealStats.avgProteinPerDay} suffix="g" icon="🥩" color="text-kibo-success" />
                  </View>
                  <View className="bg-kibo-card rounded-xl p-3">
                    <Text className="text-kibo-mute text-[10px] mb-1">區間累計</Text>
                    <Text className="text-kibo-text text-xs">
                      熱量 {Math.round(mealStats.totalCalories)} kcal · 蛋白 {Math.round(mealStats.totalProtein)}g · 碳水 {Math.round(mealStats.totalCarb)}g · 脂肪 {Math.round(mealStats.totalFat)}g
                    </Text>
                  </View>
                </>
              )}
            </Panel>

            {/* Panel: 體態變化 */}
            <Panel
              id="body"
              open={statsPanel === 'body'}
              onToggle={toggleStatsPanel}
              icon="📸"
              title="體態變化"
              summary={bodyDelta?.count ? `${bodyDelta.count} 筆 · 體重${bodyDelta.weightDelta != null ? (bodyDelta.weightDelta >= 0 ? `+${bodyDelta.weightDelta}` : bodyDelta.weightDelta) : '-'}kg` : '無資料'}
            >
              {!bodyDelta || bodyDelta.count === 0 ? (
                <Text className="text-kibo-mute text-xs text-center py-4">
                  此區間沒有 InBody 紀錄。到「體態」分頁新增紀錄
                </Text>
              ) : (
                <>
                  <View className="flex-row gap-2 mb-2">
                    <DeltaCard label="體重" delta={bodyDelta.weightDelta} unit="kg" />
                    <DeltaCard label="體脂率" delta={bodyDelta.bodyFatDelta} unit="%" inverse />
                  </View>
                  <View className="flex-row gap-2">
                    <DeltaCard label="骨骼肌" delta={bodyDelta.muscleDelta} unit="kg" positiveGood />
                  </View>
                  <View className="mt-3 bg-kibo-card rounded-xl p-3">
                    <Text className="text-kibo-mute text-[10px] mb-1">
                      首次 {bodyDelta.first && displayDate(bodyDelta.first.measuredAt)} → 最近 {bodyDelta.last && displayDate(bodyDelta.last.measuredAt)}
                    </Text>
                  </View>
                </>
              )}
            </Panel>

            {/* Panel: 綜合活動 */}
            <Panel
              id="overall"
              open={statsPanel === 'overall'}
              onToggle={toggleStatsPanel}
              icon="🎯"
              title="綜合活動"
              summary={`累計訓練 ${user.totalWorkouts} 次 · 總 ${user.totalExp} EXP · 連續 ${user.streak} 天`}
            >
              <View className="flex-row gap-2 mb-2">
                <StatCard label="累計訓練" value={user.totalWorkouts} suffix="次" icon="💪" />
                <StatCard label="累計 EXP" value={user.totalExp} icon="⚡" color="text-kibo-success" />
              </View>
              <View className="flex-row gap-2">
                <StatCard label="連續天數" value={user.streak} suffix="天" icon="🔥" color="text-kibo-accent" />
                <StatCard label="30 天訓練" value={workoutDates.length} suffix="天" icon="📅" />
              </View>
            </Panel>
          </>
        )}

        {section === 'body' && (
          <>
            <Pressable
              onPress={() => {
                haptic.tapMedium();
                router.push('/body/new' as any);
              }}
              className="bg-kibo-primary rounded-2xl py-4 mb-3 active:opacity-70"
            >
              <Text className="text-kibo-bg text-center font-bold">📷 新增 InBody 紀錄</Text>
              <Text className="text-kibo-bg/70 text-center text-xs mt-1">拍照 → AI 自動判讀</Text>
            </Pressable>

            {bodyMeasurements.length > 0 && (
              <>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-kibo-text text-base font-bold">最近紀錄 ({bodyMeasurements.length})</Text>
                  <Pressable
                    onPress={() => {
                      haptic.tapLight();
                      router.push('/body' as any);
                    }}
                  >
                    <Text className="text-kibo-primary text-sm">全部 ›</Text>
                  </Pressable>
                </View>
                <View className="gap-2 mb-4">
                  {bodyMeasurements.slice(0, 5).map((m) => (
                    <Pressable
                      key={m.id}
                      onPress={() => {
                        haptic.tapLight();
                        router.push({ pathname: '/body/[id]' as any, params: { id: String(m.id) } });
                      }}
                      className="bg-kibo-surface rounded-2xl p-3 border border-kibo-card flex-row items-center gap-3 active:opacity-70"
                    >
                      <Text className="text-2xl">📊</Text>
                      <View className="flex-1">
                        <Text className="text-kibo-text font-semibold text-sm">{displayDate(m.measuredAt)}</Text>
                        <Text className="text-kibo-mute text-xs mt-0.5">
                          {m.weightKg ? `${m.weightKg}kg` : ''}
                          {m.bodyFatPct != null ? ` · 體脂 ${m.bodyFatPct}%` : ''}
                          {m.skeletalMuscleKg ? ` · 肌肉 ${m.skeletalMuscleKg}kg` : ''}
                        </Text>
                      </View>
                      <Text className="text-kibo-primary">›</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {bodyMeasurements.length === 0 && (
              <View className="bg-kibo-surface rounded-2xl p-6 border border-kibo-card items-center">
                <Text className="text-5xl mb-2">📸</Text>
                <Text className="text-kibo-text font-semibold">還沒有 InBody 紀錄</Text>
                <Text className="text-kibo-mute text-xs text-center mt-1">
                  上傳 InBody 照片，AI 自動填好所有體組成數據{'\n'}建立長期趨勢
                </Text>
              </View>
            )}

            <Text className="text-kibo-mute text-[10px] text-center mt-4">
              🔑 AI 判讀用的 OpenAI API Key 設定已搬到「⚙️ 設定」分頁
            </Text>
          </>
        )}

        {section === 'pets' && (
          <>
            {activeEgg && (
              <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-4">
                <Text className="text-kibo-mute text-xs mb-2">🥚 成長中的蛋</Text>
                <View className="flex-row items-center gap-3">
                  <Text className="text-5xl">🥚</Text>
                  <View className="flex-1">
                    <Text className="text-kibo-text font-bold">
                      {activeEgg.type === 'strength' ? '力量蛋' : activeEgg.type === 'cardio' ? '耐力蛋' : '柔韌蛋'}
                    </Text>
                    <Text className="text-kibo-mute text-xs">
                      {activeEgg.currentExp} / {activeEgg.requiredExp} EXP
                    </Text>
                    <View className="h-2 bg-kibo-card rounded-full overflow-hidden mt-2">
                      <View
                        className="h-2 bg-kibo-primary rounded-full"
                        style={{ width: `${Math.min(100, (activeEgg.currentExp / activeEgg.requiredExp) * 100)}%` }}
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}
            <Text className="text-kibo-text text-base font-bold mb-2">
              夥伴圖鑑 {pets.length > 0 && `(${pets.length})`}
            </Text>
            {pets.length === 0 ? (
              <View className="bg-kibo-surface rounded-2xl p-6 border border-kibo-card items-center">
                <Text className="text-5xl mb-2">🐣</Text>
                <Text className="text-kibo-mute text-center">還沒有夥伴</Text>
                <Text className="text-kibo-mute text-xs text-center mt-1">
                  訓練累積 EXP 孵出第一隻
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {pets.map((pet) => <PetCard key={pet.id} pet={pet} />)}
              </View>
            )}
          </>
        )}

        {section === 'profile' && (
          <>
            {/* 🔐 帳號（常駐） */}
            {!isSupabaseConfigured() ? (
              <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-3">
                <Text className="text-kibo-mute text-xs mb-2">🔐 帳號</Text>
                <Text className="text-kibo-text text-sm mb-2">尚未設定雲端同步</Text>
                <Text className="text-kibo-mute text-[10px] leading-4">
                  要啟用 Google 登入 + 雲端同步，需先在 Supabase 建立專案並設定 Google OAuth。
                  設定完成後，把 Project URL 與 anon key 提供給開發者，會自動接通。
                </Text>
              </View>
            ) : authSession ? (
              <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-3">
                <Text className="text-kibo-mute text-xs mb-3">🔐 已登入</Text>
                <View className="flex-row items-center gap-3 mb-3">
                  <View className="w-12 h-12 rounded-full bg-kibo-card items-center justify-center">
                    <Text className="text-kibo-text text-xl">👤</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-kibo-text font-semibold" numberOfLines={1}>
                      {authSession.user?.email}
                    </Text>
                    <Text className="text-kibo-mute text-[10px]">
                      {syncStatus === 'syncing' ? '☁️ 同步中…'
                        : syncStatus === 'error' ? '⚠️ 同步失敗'
                        : lastSyncedAt ? `✓ 上次同步 ${new Date(lastSyncedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`
                        : '已啟用雲端同步'}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPressIn={() => haptic.tapMedium()}
                  disabled={syncing}
                  onPress={async () => {
                    setSyncing(true);
                    try {
                      const r = await syncCloud();
                      haptic.success();
                      Alert.alert('☁️ 同步完成', `上傳 ${r.pushed} 筆，下載 ${r.pulled} 筆`);
                    } catch (e: any) {
                      haptic.error();
                      Alert.alert('同步失敗', e?.message ?? String(e));
                    } finally {
                      setSyncing(false);
                    }
                  }}
                  className="bg-kibo-primary rounded-xl py-2 mb-2"
                >
                  <Text className="text-kibo-bg text-center font-semibold text-sm">
                    {syncing ? '同步中...' : '☁️ 立即同步'}
                  </Text>
                </Pressable>
                <Pressable
                  onPressIn={() => haptic.tapLight()}
                  onPress={async () => {
                    await logout();
                    haptic.success();
                  }}
                  className="bg-kibo-danger/20 border border-kibo-danger rounded-xl py-2"
                >
                  <Text className="text-kibo-danger text-center font-semibold text-sm">登出</Text>
                </Pressable>
              </View>
            ) : (
              <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-3">
                <Text className="text-kibo-mute text-xs mb-3">
                  🔐 {authMode === 'signin' ? '登入雲端' : '建立帳號'}
                </Text>

                <View className="flex-row gap-2 mb-3">
                  <Pressable
                    onPressIn={() => haptic.tapLight()}
                    onPress={() => setAuthMode('signin')}
                    className={`flex-1 py-2 rounded-lg ${authMode === 'signin' ? 'bg-kibo-primary' : 'bg-kibo-card'}`}
                  >
                    <Text className={`text-center text-xs font-semibold ${authMode === 'signin' ? 'text-kibo-bg' : 'text-kibo-text'}`}>
                      登入
                    </Text>
                  </Pressable>
                  <Pressable
                    onPressIn={() => haptic.tapLight()}
                    onPress={() => setAuthMode('signup')}
                    className={`flex-1 py-2 rounded-lg ${authMode === 'signup' ? 'bg-kibo-primary' : 'bg-kibo-card'}`}
                  >
                    <Text className={`text-center text-xs font-semibold ${authMode === 'signup' ? 'text-kibo-bg' : 'text-kibo-text'}`}>
                      註冊
                    </Text>
                  </Pressable>
                </View>

                <TextInput
                  value={authEmail}
                  onChangeText={setAuthEmail}
                  placeholder="email"
                  placeholderTextColor={palette.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="bg-kibo-card text-kibo-text rounded-xl px-3 py-2 mb-2"
                />
                <TextInput
                  value={authPassword}
                  onChangeText={setAuthPassword}
                  placeholder="密碼（至少 6 字元）"
                  placeholderTextColor={palette.placeholder}
                  secureTextEntry
                  autoCapitalize="none"
                  className="bg-kibo-card text-kibo-text rounded-xl px-3 py-2 mb-3"
                />

                <Pressable
                  onPressIn={() => haptic.tapMedium()}
                  onPress={async () => {
                    const email = authEmail.trim();
                    if (!email || !authPassword) {
                      Alert.alert('請填 email 和密碼');
                      return;
                    }
                    if (authPassword.length < 6) {
                      Alert.alert('密碼至少 6 字元');
                      return;
                    }
                    try {
                      if (authMode === 'signup') {
                        const r = await signUpEmail(email, authPassword);
                        haptic.success();
                        if (r.needConfirm) {
                          Alert.alert(
                            '✉️ 請收信驗證',
                            `驗證信已寄到 ${email}，點信內連結啟用帳號後再回來登入。`,
                          );
                          setAuthMode('signin');
                        } else {
                          Alert.alert('✅ 註冊成功！');
                        }
                      } else {
                        await signInEmail(email, authPassword);
                        haptic.success();
                      }
                      setAuthPassword('');
                    } catch (e: any) {
                      haptic.error();
                      Alert.alert(authMode === 'signup' ? '註冊失敗' : '登入失敗', e?.message ?? String(e));
                    }
                  }}
                  disabled={authLoading}
                  className="bg-kibo-primary rounded-xl py-3 mb-2"
                >
                  <Text className="text-kibo-bg text-center font-bold">
                    {authLoading
                      ? '處理中...'
                      : authMode === 'signin' ? '登入' : '建立帳號'}
                  </Text>
                </Pressable>

                {authMode === 'signin' && (
                  <Pressable
                    onPressIn={() => haptic.tapLight()}
                    onPress={async () => {
                      const email = authEmail.trim();
                      if (!email) {
                        Alert.alert('請先填 email 再點忘記密碼');
                        return;
                      }
                      try {
                        await resetPasswordEmail(email);
                        haptic.success();
                        Alert.alert('✉️ 重設密碼信已寄出', `請收 ${email} 的信件。`);
                      } catch (e: any) {
                        haptic.error();
                        Alert.alert('失敗', e?.message ?? String(e));
                      }
                    }}
                  >
                    <Text className="text-kibo-mute text-center text-xs underline">忘記密碼</Text>
                  </Pressable>
                )}

                <Text className="text-kibo-mute text-[10px] mt-2 leading-4">
                  登入後資料會同步到雲端，換手機也能找回
                </Text>
              </View>
            )}

            {/* 🎨 外觀（合併：明暗模式 + 視覺風格 + 低負擔模式）*/}
            <Panel
              id="appearance"
              open={openPanel === 'appearance'}
              onToggle={togglePanel}
              icon="🎨"
              title="外觀"
              summary={`${themeMode === 'light' ? '白天' : themeMode === 'dark' ? '夜晚' : '系統'} · ${themeStyle === 'pixel' ? '像素風' : '現代'}${lowPowerMode ? ' · 低負擔' : ''}`}
            >
              <Text className="text-kibo-mute text-xs mb-2">明暗模式</Text>
              <View className="flex-row gap-2 mb-4">
                {([
                  { code: 'light' as const, label: '☀️ 白天' },
                  { code: 'dark' as const, label: '🌙 夜晚' },
                  { code: 'system' as const, label: '⚙️ 系統' },
                ]).map((o) => {
                  const active = themeMode === o.code;
                  return (
                    <Pressable
                      key={o.code}
                      onPressIn={() => haptic.tapLight()}
                      onPress={() => chooseTheme(o.code)}
                      className={`flex-1 py-3 rounded-xl items-center ${active ? 'bg-kibo-primary' : 'bg-kibo-card'}`}
                    >
                      <Text className={`font-semibold text-sm ${active ? 'text-kibo-bg' : 'text-kibo-text'}`}>
                        {o.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text className="text-kibo-mute text-xs mb-2">視覺風格</Text>
              <View className="flex-row gap-2 mb-3">
                {([
                  { code: 'modern' as const, label: '🌐 現代' },
                  { code: 'pixel' as const, label: '👾 像素風' },
                ]).map((o) => {
                  const active = themeStyle === o.code;
                  return (
                    <Pressable
                      key={o.code}
                      onPressIn={() => haptic.tapLight()}
                      onPress={() => chooseThemeStyle(o.code)}
                      className={`flex-1 py-3 rounded-xl items-center ${active ? 'bg-kibo-primary' : 'bg-kibo-card'}`}
                    >
                      <Text className={`font-semibold text-sm ${active ? 'text-kibo-bg' : 'text-kibo-text'}`}>
                        {o.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text className="text-kibo-mute text-[10px] mb-2">預覽：</Text>
              <PixelCard variant="default" padding={12} style={{ marginBottom: 8 }}>
                <Text style={{ color: palette.text, fontFamily: themeStyle === 'pixel' ? 'Cubic11' : undefined, fontSize: 14 }}>
                  Kibo 像素卡片
                </Text>
                <Text style={{ color: palette.mute, fontSize: 11, marginTop: 4 }}>
                  chunky border + hard shadow
                </Text>
              </PixelCard>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <PixelButton label="按按看" variant="primary" size="sm" />
                <PixelButton label="Accent" variant="accent" size="sm" />
              </View>

              {/* 低負擔模式 */}
              <Text className="text-kibo-mute text-xs mb-2">效能</Text>
              <Pressable
                onPress={() => { haptic.tapLight(); setLowPowerMode(!lowPowerMode); }}
                className={`flex-row items-center justify-between p-3 rounded-xl ${lowPowerMode ? 'bg-kibo-primary' : 'bg-kibo-card'}`}
              >
                <View style={{ flex: 1 }}>
                  <Text className={`font-semibold ${lowPowerMode ? 'text-kibo-bg' : 'text-kibo-text'}`}>
                    ⚡ 低負擔模式
                  </Text>
                  <Text className={`text-[10px] mt-0.5 ${lowPowerMode ? 'text-kibo-bg/70' : 'text-kibo-mute'}`}>
                    卡頓時打開：滾輪退化成按鈕、像素動畫暫停、AI 序列分析
                  </Text>
                </View>
                <Text className={`${lowPowerMode ? 'text-kibo-bg' : 'text-kibo-text'} font-bold ml-2`}>
                  {lowPowerMode ? 'ON' : 'OFF'}
                </Text>
              </Pressable>
            </Panel>

            {/* ⚙️ 健康設定 */}
            <Pressable
              onPress={() => { haptic.tapLight(); router.push('/me/health-settings' as any); }}
              className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-3 flex-row items-center"
            >
              <Text className="text-kibo-text font-semibold flex-1">⚙️ 健康設定</Text>
              <Text className="text-kibo-mute">▶</Text>
            </Pressable>

            {/* 🙋 個人資料 */}
            <Panel
              id="profile"
              open={openPanel === 'profile'}
              onToggle={togglePanel}
              icon="🙋"
              title="個人資料"
              summary={`${name || '未命名'} · ${height || '-'}cm / ${weight || '-'}kg`}
            >
              <Text className="text-kibo-mute text-[10px] mb-1">暱稱</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="健身新手"
                placeholderTextColor={palette.placeholder}
                className="bg-kibo-card text-kibo-text rounded-xl px-3 py-2 mb-3"
              />
              <View className="flex-row gap-2 mb-3">
                <View className="flex-1">
                  <Text className="text-kibo-mute text-[10px] mb-1">身高 (cm)</Text>
                  <TextInput
                    value={height}
                    onChangeText={setHeight}
                    keyboardType="numeric"
                    placeholder="170"
                    placeholderTextColor={palette.placeholder}
                    className="bg-kibo-card text-kibo-text rounded-xl px-3 py-2"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-kibo-mute text-[10px] mb-1">體重 (kg)</Text>
                  <TextInput
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="numeric"
                    placeholder="65"
                    placeholderTextColor={palette.placeholder}
                    className="bg-kibo-card text-kibo-text rounded-xl px-3 py-2"
                  />
                </View>
              </View>
              <Text className="text-kibo-mute text-[10px] mb-1">健身目標</Text>
              <View className="flex-row flex-wrap gap-2">
                {GOALS.map((g) => (
                  <Pressable
                    key={g.code}
                    onPressIn={() => haptic.tapLight()}
                    onPress={() => setGoal(g.code)}
                    className={`px-4 py-2 rounded-xl ${goal === g.code ? 'bg-kibo-primary' : 'bg-kibo-card'}`}
                  >
                    <Text className={goal === g.code ? 'text-kibo-bg font-semibold' : 'text-kibo-text'}>
                      {g.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPressIn={() => haptic.tapMedium()}
                onPress={save}
                className="bg-kibo-primary rounded-xl py-2.5 mt-4 active:opacity-70"
              >
                <Text className="text-kibo-bg text-center font-bold text-sm">儲存個人資料</Text>
              </Pressable>
            </Panel>

            {/* 🎯 每日/每週目標 */}
            <Panel
              id="goals"
              open={openPanel === 'goals'}
              onToggle={togglePanel}
              icon="🎯"
              title="每日/每週目標"
              summary={`EXP ${dailyExpGoal || '-'} · ${weeklyDaysGoal || '-'}天/週 · ${dailyCaloriesGoal || '-'} kcal · 蛋白 ${dailyProteinGoal || '-'}g`}
            >
              <View className="flex-row gap-2 mb-3">
                <View className="flex-1">
                  <Text className="text-kibo-mute text-[10px] mb-1">每日 EXP</Text>
                  <TextInput
                    value={dailyExpGoal}
                    onChangeText={setDailyExpGoal}
                    keyboardType="numeric"
                    placeholder="100"
                    placeholderTextColor={palette.placeholder}
                    className="bg-kibo-card text-kibo-text rounded-xl px-3 py-2"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-kibo-mute text-[10px] mb-1">每週天數</Text>
                  <TextInput
                    value={weeklyDaysGoal}
                    onChangeText={setWeeklyDaysGoal}
                    keyboardType="numeric"
                    placeholder="3"
                    placeholderTextColor={palette.placeholder}
                    className="bg-kibo-card text-kibo-text rounded-xl px-3 py-2"
                  />
                </View>
              </View>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="text-kibo-mute text-[10px] mb-1">每日熱量 (kcal)</Text>
                  <TextInput
                    value={dailyCaloriesGoal}
                    onChangeText={setDailyCaloriesGoal}
                    keyboardType="numeric"
                    placeholder="2000"
                    placeholderTextColor={palette.placeholder}
                    className="bg-kibo-card text-kibo-text rounded-xl px-3 py-2"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-kibo-mute text-[10px] mb-1">每日蛋白質 (g)</Text>
                  <TextInput
                    value={dailyProteinGoal}
                    onChangeText={setDailyProteinGoal}
                    keyboardType="numeric"
                    placeholder="100"
                    placeholderTextColor={palette.placeholder}
                    className="bg-kibo-card text-kibo-text rounded-xl px-3 py-2"
                  />
                </View>
              </View>
              <Pressable
                onPressIn={() => haptic.tapMedium()}
                onPress={save}
                className="bg-kibo-primary rounded-xl py-2.5 mt-4 active:opacity-70"
              >
                <Text className="text-kibo-bg text-center font-bold text-sm">儲存目標</Text>
              </Pressable>
            </Panel>

            {/* 🤖 AI 判讀 */}
            <Panel
              id="ai"
              open={openPanel === 'ai'}
              onToggle={togglePanel}
              icon="🤖"
              title="AI 判讀模型"
              summary={`${MODELS.find((m) => m.id === activeModelId)?.displayName ?? '未選'} · ${MODELS.find((m) => m.id === activeModelId)?.estCostNtd ?? ''}/張`}
            >
              <Text className="text-kibo-mute text-xs mb-2">選擇模型（InBody + 飲食共用）</Text>
              <View className="gap-2 mb-3">
                {MODELS.map((m) => {
                  const active = m.id === activeModelId;
                  const tierColor = m.tier === 'economy' ? 'text-kibo-success' : m.tier === 'balanced' ? 'text-kibo-primary' : 'text-kibo-accent';
                  return (
                    <Pressable
                      key={m.id}
                      onPressIn={() => haptic.tapLight()}
                      onPress={() => onPickModel(m.id)}
                      className={`rounded-xl p-3 border ${active ? 'border-kibo-primary bg-kibo-primary/10' : 'border-kibo-card bg-kibo-card'}`}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className={`font-semibold text-sm ${active ? 'text-kibo-primary' : 'text-kibo-text'}`}>
                          {active ? '✓ ' : ''}{m.displayName}
                        </Text>
                        <Text className={`text-[10px] font-bold ${tierColor}`}>
                          {m.estCostNtd}/張
                        </Text>
                      </View>
                      <Text className="text-kibo-mute text-[10px] mt-1">
                        準度：{m.visionQuality} · {m.notes}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View className="border-t border-kibo-card pt-3">
                <Text className="text-kibo-mute text-xs mb-2">
                  🔑 {PROVIDER_LABEL[activeProvider]} API Key
                </Text>
                <View className="flex-row gap-2 mb-2">
                  <TextInput
                    value={keysByProvider[activeProvider]}
                    onChangeText={(v) => setKeysByProvider((p) => ({ ...p, [activeProvider]: v }))}
                    placeholder={
                      activeProvider === 'openai' ? 'sk-...'
                        : activeProvider === 'anthropic' ? 'sk-ant-...'
                        : activeProvider === 'gemini' ? 'AIza...'
                        : 'eyJhbGc...（JWT token）'
                    }
                    placeholderTextColor={palette.placeholder}
                    secureTextEntry={keyMasked}
                    autoCapitalize="none"
                    className="flex-1 bg-kibo-card text-kibo-text rounded-xl px-3 py-2 text-xs"
                  />
                  <Pressable
                    onPressIn={() => haptic.tapLight()}
                    onPress={() => setKeyMasked((p) => !p)}
                    className="bg-kibo-card rounded-xl px-3 justify-center"
                  >
                    <Text className="text-kibo-mute">{keyMasked ? '👁' : '🙈'}</Text>
                  </Pressable>
                </View>
                <Pressable
                  onPressIn={() => haptic.tapLight()}
                  onPress={onSaveProviderKey}
                  className="bg-kibo-primary/20 border border-kibo-primary rounded-xl py-2 mb-2"
                >
                  <Text className="text-kibo-primary text-center font-semibold text-sm">
                    儲存 Key
                  </Text>
                </Pressable>
                <Text className="text-kibo-mute text-[10px] leading-4">
                  只存本機不上傳 · {PROVIDER_SIGNUP_URL[activeProvider]}
                </Text>
                <Text className="text-kibo-mute text-[10px] mt-2 leading-4">
                  💡 飲食判讀 × 3 次取中位數，實際費用 ≈ 顯示 × 3
                </Text>
              </View>
            </Panel>

            {/* 🧠 食物記憶 */}
            <Panel
              id="memory"
              open={openPanel === 'memory'}
              onToggle={togglePanel}
              icon="🧠"
              title="AI 食物記憶"
              summary={`${memStats.count} 項 · ${memStats.totalLogs} 筆紀錄`}
            >
              {memStats.topNames.length > 0 ? (
                <View className="flex-row flex-wrap gap-1 mb-3">
                  {memStats.topNames.map((n, i) => (
                    <View key={i} className="bg-kibo-card rounded-full px-2 py-1">
                      <Text className="text-kibo-text text-[10px]">{n}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-kibo-mute text-xs mb-3">
                  還沒有記憶。記錄越多餐，AI 判讀越準。
                </Text>
              )}
              <Pressable
                onPressIn={() => memStats.count > 0 && haptic.tapLight()}
                onPress={onClearMemory}
                disabled={memStats.count === 0}
                className={`rounded-xl py-2 ${memStats.count === 0 ? 'bg-kibo-card opacity-50' : 'bg-kibo-danger/20 border border-kibo-danger'}`}
              >
                <Text className={`text-center font-semibold text-sm ${memStats.count === 0 ? 'text-kibo-mute' : 'text-kibo-danger'}`}>
                  清空食物記憶
                </Text>
              </Pressable>
            </Panel>

            {/* 💾 資料備份 */}
            <Panel
              id="backup"
              open={openPanel === 'backup'}
              onToggle={togglePanel}
              icon="💾"
              title="資料備份"
              summary="匯出 / 匯入所有紀錄"
            >
              <Pressable
                onPressIn={() => haptic.tapMedium()}
                onPress={async () => {
                  try {
                    await exportAll();
                    haptic.success();
                  } catch (e: any) {
                    haptic.error();
                    Alert.alert('匯出失敗', e?.message ?? String(e));
                  }
                }}
                className="bg-kibo-primary/20 border border-kibo-primary rounded-xl py-2.5 mb-2"
              >
                <Text className="text-kibo-primary text-center font-semibold">📤 匯出全部資料</Text>
              </Pressable>
              <Pressable
                onPressIn={() => haptic.tapMedium()}
                onPress={() => {
                  Alert.alert(
                    '匯入備份？',
                    '會覆蓋目前所有資料。建議先匯出一份備份。',
                    [
                      { text: '取消', style: 'cancel' },
                      {
                        text: '選擇檔案匯入',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            const result = await importAll();
                            if (result.imported) {
                              await bootstrap();
                              haptic.success();
                              Alert.alert('✅ 匯入成功', `${result.tables} 張表、${result.rows} 筆紀錄已還原`);
                            }
                          } catch (e: any) {
                            haptic.error();
                            Alert.alert('匯入失敗', e?.message ?? String(e));
                          }
                        },
                      },
                    ],
                  );
                }}
                className="bg-kibo-accent/20 border border-kibo-accent rounded-xl py-2.5 mb-2"
              >
                <Text className="text-kibo-accent text-center font-semibold">📥 從備份檔匯入（JSON）</Text>
              </Pressable>

              <Pressable
                onPressIn={() => haptic.tapMedium()}
                onPress={() => {
                  Alert.alert(
                    '從 Strong App CSV 匯入',
                    '會「累加」到你現有資料，不會覆蓋。同日期已存在的訓練會自動跳過。\n\n支援格式：Strong / Hevy 等健身 app 匯出的標準 CSV。',
                    [
                      { text: '取消', style: 'cancel' },
                      {
                        text: '選擇 CSV 匯入',
                        onPress: async () => {
                          try {
                            const result = await importStrongCSV();
                            if (!result) return;
                            await bootstrap();
                            haptic.success();
                            Alert.alert(
                              '✅ CSV 匯入完成',
                              `新增 ${result.workoutsCreated} 次訓練\n新增 ${result.setsCreated} 組紀錄\n新增 ${result.newExercises} 個自訂動作\n略過 ${result.skippedRows} 筆（同日期已存在）`,
                            );
                          } catch (e: any) {
                            haptic.error();
                            Alert.alert('匯入失敗', e?.message ?? String(e));
                          }
                        },
                      },
                    ],
                  );
                }}
                className="bg-kibo-success/20 border border-kibo-success rounded-xl py-2.5"
              >
                <Text className="text-kibo-success text-center font-semibold">📊 從 Strong CSV 匯入（累加）</Text>
              </Pressable>

              <Text className="text-kibo-mute text-[10px] mt-2 leading-4">
                匯出 = 完整備份（JSON）；Strong CSV = 累加匯入歷史紀錄不覆蓋。
              </Text>
            </Panel>

            {/* ⚠️ 進階 */}
            <Panel
              id="danger"
              open={openPanel === 'danger'}
              onToggle={togglePanel}
              icon="⚠️"
              title="進階（危險區）"
              summary="重置所有資料"
            >
              <Pressable
                onPressIn={() => haptic.warning()}
                onPress={reset}
                className="bg-kibo-danger/20 border border-kibo-danger rounded-xl py-3"
              >
                <Text className="text-kibo-danger text-center font-semibold">重置所有資料</Text>
              </Pressable>
              <Text className="text-kibo-mute text-[10px] mt-2 leading-4">
                會刪除所有訓練紀錄、課表、寵物、蛋、InBody 與飲食紀錄。無法復原。
              </Text>
            </Panel>

            <Text className="text-kibo-mute text-center text-xs mt-6">Kibo v1.2</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function DeltaCard({
  label,
  delta,
  unit,
  inverse = false,
  positiveGood = false,
}: {
  label: string;
  delta: number | null;
  unit: string;
  inverse?: boolean;
  positiveGood?: boolean;
}) {
  if (delta == null) {
    return (
      <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card flex-1">
        <Text className="text-kibo-mute text-xs">{label}</Text>
        <Text className="text-kibo-mute text-lg mt-1">無資料</Text>
      </View>
    );
  }
  const good = positiveGood ? delta > 0 : inverse ? delta < 0 : delta < 0;
  const color = delta === 0 ? 'text-kibo-mute' : good ? 'text-kibo-success' : 'text-kibo-danger';
  return (
    <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card flex-1">
      <Text className="text-kibo-mute text-xs">{label} 變化</Text>
      <Text className={`text-xl font-bold mt-1 ${color}`}>
        {delta > 0 ? '+' : ''}{delta}
        <Text className="text-kibo-mute text-xs"> {unit}</Text>
      </Text>
    </View>
  );
}

function Panel({
  id,
  open,
  onToggle,
  icon,
  title,
  summary,
  children,
}: {
  id: string;
  open: boolean;
  onToggle: (id: string) => void;
  icon: string;
  title: string;
  summary?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-kibo-surface rounded-2xl border border-kibo-card mb-3 overflow-hidden">
      <Pressable
        onPressIn={() => haptic.tapLight()}
        onPress={() => onToggle(id)}
        className="flex-row items-center gap-3 p-4 active:opacity-70"
      >
        <Text className="text-xl">{icon}</Text>
        <View className="flex-1">
          <Text className="text-kibo-text font-semibold">{title}</Text>
          {summary && !open && (
            <Text className="text-kibo-mute text-xs mt-0.5" numberOfLines={1}>{summary}</Text>
          )}
        </View>
        <Text className="text-kibo-mute text-sm">{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open && (
        <View className="px-4 pb-4">
          {children}
        </View>
      )}
    </View>
  );
}
