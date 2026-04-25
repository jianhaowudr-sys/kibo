import { View, Text, Pressable } from 'react-native';
import { useMemo } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  getDay, startOfDay, addMonths, subMonths,
} from 'date-fns';
import * as haptic from '@/lib/haptic';

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export function MonthCalendar({
  month,
  onChangeMonth,
  workoutDates,
  selectedDate,
  onSelect,
}: {
  month: Date;
  onChangeMonth: (d: Date) => void;
  workoutDates: Set<string>;
  selectedDate: Date;
  onSelect: (d: Date) => void;
}) {
  const days = useMemo(() => {
    const first = startOfMonth(month);
    const last = endOfMonth(month);
    const pad = getDay(first);
    const list = eachDayOfInterval({ start: first, end: last });
    return { pad, list };
  }, [month]);

  const today = startOfDay(new Date());

  return (
    <View className="bg-kibo-surface rounded-2xl p-3 border border-kibo-card">
      <View className="flex-row items-center justify-between mb-3 px-2">
        <Pressable
          onPress={() => {
            haptic.tapLight();
            onChangeMonth(subMonths(month, 1));
          }}
          className="p-2"
        >
          <Text className="text-kibo-primary text-lg">‹</Text>
        </Pressable>
        <Text className="text-kibo-text font-bold">
          {format(month, 'yyyy 年 M 月')}
        </Text>
        <Pressable
          onPress={() => {
            haptic.tapLight();
            onChangeMonth(addMonths(month, 1));
          }}
          className="p-2"
        >
          <Text className="text-kibo-primary text-lg">›</Text>
        </Pressable>
      </View>

      <View className="flex-row mb-1">
        {WEEK_LABELS.map((w, i) => (
          <View key={w} className="flex-1 items-center">
            <Text className={`text-[10px] ${i === 0 || i === 6 ? 'text-kibo-mute' : 'text-kibo-mute'}`}>
              {w}
            </Text>
          </View>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {Array.from({ length: days.pad }).map((_, i) => (
          <View key={`pad-${i}`} style={{ width: `${100 / 7}%` }} className="aspect-square p-1" />
        ))}
        {days.list.map((d) => {
          const key = format(d, 'yyyy-MM-dd');
          const hasWorkout = workoutDates.has(key);
          const isToday = isSameDay(d, today);
          const isSelected = isSameDay(d, selectedDate);
          return (
            <Pressable
              key={key}
              onPress={() => {
                haptic.tapLight();
                onSelect(d);
              }}
              style={{ width: `${100 / 7}%` }}
              className="aspect-square p-1"
            >
              <View
                className={`flex-1 items-center justify-center rounded-lg ${
                  isSelected
                    ? 'bg-kibo-primary'
                    : hasWorkout
                      ? 'bg-kibo-success/20 border border-kibo-success'
                      : isToday
                        ? 'border border-kibo-mute'
                        : ''
                }`}
              >
                <Text
                  className={`text-sm ${
                    isSelected
                      ? 'text-kibo-bg font-bold'
                      : hasWorkout
                        ? 'text-kibo-success font-semibold'
                        : isToday
                          ? 'text-kibo-text font-semibold'
                          : 'text-kibo-mute'
                  }`}
                >
                  {format(d, 'd')}
                </Text>
                {hasWorkout && !isSelected && (
                  <View className="w-1 h-1 rounded-full bg-kibo-success mt-0.5" />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
