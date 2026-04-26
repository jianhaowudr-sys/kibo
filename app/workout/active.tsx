import { View, Text, ScrollView, Pressable, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { ExerciseSetTable } from '@/components/ExerciseSetTable';
import { RestTimer } from '@/components/RestTimer';
import { formatDuration } from '@/lib/date';
import * as repo from '@/db/repo';
import type { Exercise } from '@/db/schema';
import * as haptic from '@/lib/haptic';
import { BOTTOM_BAR_PADDING } from '@/lib/layout';

export default function ActiveWorkout() {
  const palette = useThemePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const exercises = useAppStore((s) => s.exercises);
  const activeSets = useAppStore((s) => s.activeSets);
  const startedAt = useAppStore((s) => s.workoutStartedAt);
  const finishWorkout = useAppStore((s) => s.finishWorkout);
  const cancelWorkout = useAppStore((s) => s.cancelWorkout);
  const selectedId = useAppStore((s) => s.selectedExerciseId);
  const setSelectedExerciseId = useAppStore((s) => s.setSelectedExerciseId);
  const routineQueue = useAppStore((s) => s.routineQueue);
  const clearRoutineQueue = useAppStore((s) => s.clearRoutineQueue);
  const addExercisesToQueue = useAppStore((s) => s.addExercisesToQueue);
  const removeFromQueue = useAppStore((s) => s.removeFromQueue);
  const fetchLastSetFor = useAppStore((s) => s.fetchLastSetFor);
  const fetchRecentSetsFor = useAppStore((s) => s.fetchRecentSetsFor);
  const recentSetsByExercise = useAppStore((s) => s.recentSetsByExercise);
  const plannedSetsByExercise = useAppStore((s) => s.plannedSetsByExercise);
  const addPlannedSet = useAppStore((s) => s.addPlannedSet);
  const updatePlannedSet = useAppStore((s) => s.updatePlannedSet);
  const removePlannedSet = useAppStore((s) => s.removePlannedSet);
  const commitPlannedSet = useAppStore((s) => s.commitPlannedSet);
  const uncommitSet = useAppStore((s) => s.uncommitSet);

  const [elapsed, setElapsed] = useState(0);
  const [restTriggerKey, setRestTriggerKey] = useState(0);
  const [autoSelected, setAutoSelected] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [savingName, setSavingName] = useState('');
  const [savingEmoji, setSavingEmoji] = useState('💪');
  const [showHistory, setShowHistory] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [workoutNote, setWorkoutNote] = useState('');

  useFocusEffect(
    useCallback(() => {
      const { tempSelectedExerciseIds, clearTempSelectedIds } = useAppStore.getState();
      if (tempSelectedExerciseIds.length > 0) {
        addExercisesToQueue(tempSelectedExerciseIds);
        const firstNew = tempSelectedExerciseIds[0];
        if (selectedId == null && firstNew != null) {
          setSelectedExerciseId(firstNew);
        }
        clearTempSelectedIds();
      }
    }, [addExercisesToQueue, selectedId, setSelectedExerciseId]),
  );

  useEffect(() => {
    if (autoSelected) return;
    if (selectedId == null && routineQueue.length > 0) {
      setSelectedExerciseId(routineQueue[0].id);
      setAutoSelected(true);
    }
  }, [autoSelected, selectedId, routineQueue, setSelectedExerciseId]);

  useEffect(() => {
    if (selectedId != null) {
      fetchLastSetFor(selectedId);
      fetchRecentSetsFor(selectedId, 5);
      const planned = useAppStore.getState().plannedSetsByExercise[selectedId];
      const done = useAppStore.getState().activeSets.filter((s) => s.exercise.id === selectedId);
      if ((!planned || planned.length === 0) && done.length === 0) {
        addPlannedSet(selectedId);
      }
    }
  }, [selectedId, fetchLastSetFor, fetchRecentSetsFor, addPlannedSet]);

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const selectedExercise: Exercise | undefined = exercises.find((e) => e.id === selectedId);
  const totalExp = activeSets.reduce((s, v) => s + v.exp, 0);

  const openMultiSelect = () => {
    haptic.tapLight();
    router.push('/exercise/select?mode=multi' as any);
  };

  const openSingleSelect = () => {
    haptic.tapLight();
    router.push('/exercise/select' as any);
  };

  const onOpenOptions = () => {
    if (!selectedExercise) return;
    setOptionsOpen(true);
  };

  const onCommit = async (key: string) => {
    if (!selectedExercise) return;
    await commitPlannedSet(selectedExercise.id, key);
    setRestTriggerKey((k) => k + 1);
  };

  const finalizeFinish = async (opts: {
    saveSnapshotTo?: number | null;
    overwriteRoutine?: number | null;
    saveAsNew?: { name: string; emoji: string } | null;
  }) => {
    const { saveRoutineSnapshot, saveAsNewRoutine, overwriteRoutineWithActiveSets } = useAppStore.getState();
    if (opts.overwriteRoutine) {
      await overwriteRoutineWithActiveSets(opts.overwriteRoutine);
    } else if (opts.saveSnapshotTo) {
      await saveRoutineSnapshot(opts.saveSnapshotTo);
    }
    if (opts.saveAsNew) {
      await saveAsNewRoutine(opts.saveAsNew.name, opts.saveAsNew.emoji);
    }
    haptic.tapHeavy();
    const result = await finishWorkout(workoutNote.trim() || undefined);
    clearRoutineQueue();
    if (!result) {
      router.back();
      return;
    }
    if (result.hatched) {
      router.replace('/egg/hatch' as any);
      setTimeout(() => {
        router.push({ pathname: '/workout/[id]' as any, params: { id: String(result.workoutId), justFinished: '1' } });
      }, 3000);
    } else {
      haptic.success();
      router.replace({ pathname: '/workout/[id]' as any, params: { id: String(result.workoutId), justFinished: '1' } });
    }
  };

  const onFinish = async () => {
    if (activeSets.length === 0) {
      Alert.alert('還沒有完成任何組', '取消這次訓練？', [
        { text: '繼續', style: 'cancel' },
        {
          text: '取消訓練',
          style: 'destructive',
          onPress: async () => {
            await cancelWorkout();
            router.back();
          },
        },
      ]);
      return;
    }
    const { currentRoutineId } = useAppStore.getState();

    if (!currentRoutineId) {
      await finalizeFinish({});
      return;
    }

    const originalRex = await repo.listRoutineExercises(currentRoutineId);
    const originalIds = new Set(originalRex.map((r) => r.exerciseId));
    const currentIds = new Set(activeSets.map((s) => s.exercise.id));
    const added = [...currentIds].filter((id) => !originalIds.has(id));
    const removed = [...originalIds].filter((id) => !currentIds.has(id));
    const changed = added.length > 0 || removed.length > 0;

    if (!changed) {
      await finalizeFinish({ saveSnapshotTo: currentRoutineId });
      return;
    }

    const summary = `${added.length > 0 ? `+${added.length} 個新增` : ''}${added.length > 0 && removed.length > 0 ? ' · ' : ''}${removed.length > 0 ? `-${removed.length} 個刪除` : ''}`;

    Alert.alert(
      '課表動作有變動',
      `${summary}\n\n要怎麼處理這次的內容？`,
      [
        { text: '不儲存變動', onPress: () => finalizeFinish({}) },
        { text: '💾 覆蓋原課表', onPress: () => finalizeFinish({ overwriteRoutine: currentRoutineId }) },
        {
          text: '📋 另存新課表',
          onPress: () => {
            const defaultName = `${new Date().getMonth() + 1}/${new Date().getDate()} 訓練`;
            setSavingName(defaultName);
            setSavingEmoji('💪');
            setSaveModalOpen(true);
          },
        },
      ],
    );
  };

  const confirmSaveAsNew = async () => {
    setSaveModalOpen(false);
    await finalizeFinish({
      saveAsNew: { name: savingName.trim() || '我的課表', emoji: savingEmoji },
    });
  };
  const confirmSkipSave = async () => {
    setSaveModalOpen(false);
    await finalizeFinish({});
  };

  const onPause = () => {
    Alert.alert('暫停訓練？', '目前內容會保留，可隨時回來繼續', [
      { text: '繼續訓練', style: 'cancel' },
      { text: '暫停離開', onPress: () => router.back() },
      {
        text: '放棄並刪除',
        style: 'destructive',
        onPress: async () => {
          clearRoutineQueue();
          await cancelWorkout();
          router.back();
        },
      },
    ]);
  };

  const EMOJI_PRESET = ['💪', '🦵', '🔥', '🏋️', '🏃', '🧘', '🤸', '🎯'];

  const currentDoneSets = selectedExercise
    ? activeSets.filter((s) => s.exercise.id === selectedExercise.id).map((s) => ({
        id: s.id ?? 0,
        workoutId: 0,
        exerciseId: s.exercise.id,
        orderIdx: s.orderIdx,
        weight: s.weight ?? null,
        reps: s.reps ?? null,
        durationSec: s.durationSec ?? null,
        distanceM: s.distanceM ?? null,
        completed: true,
        exp: s.exp,
        createdAt: new Date(),
        isPR: s.isPR ?? null,
      }))
    : [];
  const currentPlannedSets = selectedExercise ? plannedSetsByExercise[selectedExercise.id] ?? [] : [];
  const recentSets = selectedExercise ? recentSetsByExercise[selectedExercise.id] ?? [] : [];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="bg-kibo-bg"
    >
    <View className="flex-1 bg-kibo-bg">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_BAR_PADDING }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <View className="bg-kibo-surface rounded-2xl p-4 border border-kibo-card mb-4 flex-row justify-between items-center">
          <View>
            <Text className="text-kibo-mute text-xs">訓練時間</Text>
            <Text className="text-kibo-text text-2xl font-bold">{formatDuration(elapsed)}</Text>
          </View>
          <View className="items-end">
            <Text className="text-kibo-mute text-xs">累積 EXP</Text>
            <Text className="text-kibo-accent text-2xl font-bold">{totalExp}</Text>
          </View>
        </View>

        <View className="mb-4">
          <RestTimer autoStartKey={restTriggerKey} />
        </View>

        {/* 訓練備註 */}
        <TextInput
          value={workoutNote}
          onChangeText={setWorkoutNote}
          placeholder="今天感覺怎樣？有什麼想記下的..."
          placeholderTextColor={palette.placeholder}
          multiline
          maxLength={200}
          className="bg-kibo-surface text-kibo-text rounded-xl px-4 py-3 mb-4 border border-kibo-card"
          style={{ minHeight: 50 }}
        />

        <View className="bg-kibo-surface rounded-2xl p-3 border border-kibo-primary mb-3">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-kibo-primary text-xs font-semibold">
              📋 動作清單 ({routineQueue.length})
              {routineQueue.length > 0 && <Text className="text-kibo-mute font-normal"> · 長按移除</Text>}
            </Text>
            <Pressable onPressIn={() => haptic.tapLight()} onPress={openMultiSelect} hitSlop={8}>
              <Text className="text-kibo-primary text-xs font-semibold">＋ 加動作</Text>
            </Pressable>
          </View>

          {routineQueue.length === 0 ? (
            <Pressable
              onPressIn={() => haptic.tapLight()}
              onPress={openMultiSelect}
              className="border border-dashed border-kibo-card rounded-xl py-4 items-center active:opacity-70"
            >
              <Text className="text-kibo-mute text-xs">點這裡挑選要做的動作（可多選）</Text>
            </Pressable>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {routineQueue.map((ex) => {
                const firstChar = ex.name.trim().charAt(0);
                const isActive = selectedId === ex.id;
                const doneCount = activeSets.filter((s) => s.exercise.id === ex.id).length;
                return (
                  <Pressable
                    key={ex.id}
                    onPressIn={() => haptic.tapLight()}
                    onPress={() => setSelectedExerciseId(ex.id)}
                    onLongPress={() => {
                      haptic.warning();
                      Alert.alert(
                        '從清單移除？',
                        ex.name,
                        [
                          { text: '取消', style: 'cancel' },
                          {
                            text: '移除',
                            style: 'destructive',
                            onPress: () => {
                              removeFromQueue(ex.id);
                              if (selectedId === ex.id) setSelectedExerciseId(null);
                            },
                          },
                        ],
                      );
                    }}
                    className={`rounded-full px-3 py-1.5 flex-row items-center gap-2 active:opacity-70 ${
                      isActive ? 'bg-kibo-primary' : 'bg-kibo-card'
                    }`}
                  >
                    <View className="w-6 h-6 rounded-full bg-kibo-bg items-center justify-center">
                      <Text className={`text-[10px] font-bold ${isActive ? 'text-kibo-primary' : 'text-kibo-text'}`}>
                        {doneCount > 0 ? '✓' : firstChar}
                      </Text>
                    </View>
                    <Text className={`text-xs ${isActive ? 'text-kibo-bg font-bold' : 'text-kibo-text'}`}>
                      {ex.name}{doneCount > 0 && ` · ${doneCount}組`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {!selectedExercise && routineQueue.length === 0 && (
          <View className="bg-kibo-surface rounded-2xl p-6 border border-kibo-card items-center mb-4">
            <Text className="text-5xl mb-2">💪</Text>
            <Text className="text-kibo-text font-semibold">點上方「加動作」開始</Text>
          </View>
        )}

        {selectedExercise && (
          <>
            <Pressable
              onPressIn={() => haptic.tapLight()}
              onPress={() => setShowHistory((v) => !v)}
              className="flex-row items-center justify-between px-2 py-2 mb-2 active:opacity-70"
            >
              <Text className="text-kibo-mute text-xs font-semibold">
                📊 近期強度 {recentSets.length > 0 && `(${recentSets.length})`}
              </Text>
              <Text className="text-kibo-mute text-xs">{showHistory ? '收合 ▴' : '展開 ▾'}</Text>
            </Pressable>

            {showHistory && recentSets.length > 0 && (
              <View className="bg-kibo-surface rounded-2xl p-3 border border-kibo-card mb-3">
                <View className="gap-1">
                  {recentSets.map((s) => (
                    <View key={s.id} className="flex-row items-center justify-between px-2 py-1">
                      <Text className="text-kibo-mute text-xs">
                        {new Date(s.createdAt).getMonth() + 1}/{new Date(s.createdAt).getDate()}
                      </Text>
                      <Text className="text-kibo-text text-sm flex-1 text-center">
                        {selectedExercise.unit === 'reps' && `${s.weight ?? '自重'} kg × ${s.reps}`}
                        {selectedExercise.unit === 'seconds' && `${s.durationSec}s`}
                        {selectedExercise.unit === 'minutes' && `${Math.round((s.durationSec ?? 0) / 60)} min${s.distanceM ? ` · ${(s.distanceM / 1000).toFixed(1)} km` : ''}`}
                        {selectedExercise.unit === 'meters' && `${s.distanceM}m`}
                      </Text>
                      <Text className="text-kibo-accent text-xs">+{s.exp}</Text>
                    </View>
                  ))}
                </View>
                <Pressable
                  onPressIn={() => haptic.tapLight()}
                  onPress={() => router.push({ pathname: '/exercise/[id]' as any, params: { id: String(selectedExercise.id) } })}
                  className="mt-2 border-t border-kibo-card pt-2"
                >
                  <Text className="text-kibo-primary text-xs text-center">看完整 PR / 歷史 ›</Text>
                </Pressable>
              </View>
            )}

            {showHistory && recentSets.length === 0 && (
              <View className="bg-kibo-surface rounded-2xl p-3 border border-kibo-card mb-3">
                <Text className="text-kibo-mute text-xs text-center">這動作還沒紀錄，做完第一組後才會有</Text>
              </View>
            )}

            <ExerciseSetTable
              exercise={selectedExercise}
              doneSets={currentDoneSets as any}
              plannedSets={currentPlannedSets}
              onUpdatePlanned={(key, patch) => updatePlannedSet(selectedExercise.id, key, patch)}
              onCommitPlanned={onCommit}
              onRemovePlanned={(key) => removePlannedSet(selectedExercise.id, key)}
              onUncommit={(setId) => uncommitSet(setId)}
              onAddPlanned={() => addPlannedSet(selectedExercise.id)}
              onOpenOptions={onOpenOptions}
            />
          </>
        )}
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 bg-kibo-surface border-t border-kibo-card px-4 pt-3 flex-row gap-2"
        style={{ paddingBottom: Math.max(12, insets.bottom) }}
      >
        <Pressable
          onPressIn={() => haptic.tapLight()}
          onPress={onPause}
          className="bg-kibo-card border border-kibo-mute/40 rounded-2xl py-4 px-6"
        >
          <Text className="text-kibo-text font-semibold">暫停</Text>
        </Pressable>
        <Pressable
          onPressIn={() => haptic.tapMedium()}
          onPress={onFinish}
          className="flex-1 bg-kibo-success rounded-2xl py-4"
        >
          <Text className="text-kibo-bg text-center font-bold text-lg">完成訓練</Text>
        </Pressable>
      </View>

      <Modal visible={optionsOpen} transparent animationType="fade" onRequestClose={() => setOptionsOpen(false)}>
        <Pressable className="flex-1 bg-black/60 justify-center px-6" onPress={() => setOptionsOpen(false)}>
          <Pressable className="bg-kibo-surface rounded-2xl p-5 border border-kibo-card" onPress={(e) => e.stopPropagation()}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-kibo-text text-lg font-bold flex-1" numberOfLines={1}>
                {selectedExercise?.name ?? ''}
              </Text>
              <Pressable
                onPressIn={() => haptic.tapLight()}
                onPress={() => setOptionsOpen(false)}
                hitSlop={10}
                className="w-9 h-9 rounded-full bg-kibo-card items-center justify-center"
              >
                <Text className="text-kibo-text text-lg">✕</Text>
              </Pressable>
            </View>
            <Pressable
              onPressIn={() => haptic.tapLight()}
              onPress={() => {
                setOptionsOpen(false);
                openSingleSelect();
              }}
              className="bg-kibo-card rounded-xl p-4 mb-2 flex-row items-center gap-3 active:opacity-70"
            >
              <Text className="text-2xl">🔁</Text>
              <Text className="text-kibo-text font-semibold flex-1">更換動作</Text>
            </Pressable>
            <Pressable
              onPressIn={() => haptic.tapLight()}
              onPress={() => {
                setOptionsOpen(false);
                if (selectedExercise) {
                  router.push({ pathname: '/exercise/[id]' as any, params: { id: String(selectedExercise.id) } });
                }
              }}
              className="bg-kibo-card rounded-xl p-4 mb-2 flex-row items-center gap-3 active:opacity-70"
            >
              <Text className="text-2xl">📊</Text>
              <Text className="text-kibo-text font-semibold flex-1">看 PR / 歷史</Text>
            </Pressable>
            <Pressable
              onPressIn={() => haptic.tapMedium()}
              onPress={() => {
                setOptionsOpen(false);
                haptic.warning();
                if (selectedId) {
                  removeFromQueue(selectedId);
                  setSelectedExerciseId(null);
                }
              }}
              className="bg-kibo-danger/20 border border-kibo-danger rounded-xl p-4 flex-row items-center gap-3 active:opacity-70"
            >
              <Text className="text-2xl">🗑</Text>
              <Text className="text-kibo-danger font-semibold flex-1">從清單移除</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={saveModalOpen} transparent animationType="slide" onRequestClose={() => setSaveModalOpen(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-kibo-surface rounded-t-3xl border-t border-kibo-card p-6">
            <Text className="text-kibo-text text-xl font-bold mb-1">要把這次存成新課表嗎？</Text>
            <Text className="text-kibo-mute text-xs mb-4">
              下次就能從「課表」一鍵開始相同內容
            </Text>
            <Text className="text-kibo-mute text-xs mb-2">課表名稱</Text>
            <TextInput
              value={savingName}
              onChangeText={setSavingName}
              placeholder="例如：週一胸推"
              placeholderTextColor={palette.placeholder}
              maxLength={20}
              className="bg-kibo-card text-kibo-text rounded-xl px-4 py-3 mb-4"
            />
            <Text className="text-kibo-mute text-xs mb-2">圖示</Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {EMOJI_PRESET.map((e) => (
                <Pressable
                  key={e}
                  onPressIn={() => haptic.tapLight()}
                  onPress={() => setSavingEmoji(e)}
                  className={`w-11 h-11 items-center justify-center rounded-xl ${savingEmoji === e ? 'bg-kibo-primary' : 'bg-kibo-card'}`}
                >
                  <Text className="text-xl">{e}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPressIn={() => haptic.tapMedium()}
              onPress={confirmSaveAsNew}
              className="bg-kibo-primary rounded-2xl py-4 mb-2 active:opacity-70"
            >
              <Text className="text-kibo-bg text-center font-bold text-lg">儲存並完成</Text>
            </Pressable>
            <Pressable
              onPressIn={() => haptic.tapLight()}
              onPress={confirmSkipSave}
              className="bg-kibo-card rounded-2xl py-3 active:opacity-70"
            >
              <Text className="text-kibo-mute text-center font-semibold">不儲存 · 直接完成</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
    </KeyboardAvoidingView>
  );
}
