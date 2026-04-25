import type { NewExercise } from '@/db/schema';

export const DEFAULT_EXERCISES: NewExercise[] = [
  { name: '深蹲', category: 'strength', muscleGroup: '腿', unit: 'reps', icon: '🦵', expPerUnit: 1.2 },
  { name: '硬舉', category: 'strength', muscleGroup: '背', unit: 'reps', icon: '🏋️', expPerUnit: 1.5 },
  { name: '臥推', category: 'strength', muscleGroup: '胸', unit: 'reps', icon: '💪', expPerUnit: 1.3 },
  { name: '肩推', category: 'strength', muscleGroup: '肩', unit: 'reps', icon: '🤸', expPerUnit: 1.2 },
  { name: '引體向上', category: 'strength', muscleGroup: '背', unit: 'reps', icon: '🧗', expPerUnit: 2.0 },
  { name: '划船', category: 'strength', muscleGroup: '背', unit: 'reps', icon: '🚣', expPerUnit: 1.2 },
  { name: '二頭彎舉', category: 'strength', muscleGroup: '手臂', unit: 'reps', icon: '💪', expPerUnit: 1.0 },
  { name: '三頭下壓', category: 'strength', muscleGroup: '手臂', unit: 'reps', icon: '💪', expPerUnit: 1.0 },
  { name: '腿推', category: 'strength', muscleGroup: '腿', unit: 'reps', icon: '🦵', expPerUnit: 1.1 },
  { name: '腿彎舉', category: 'strength', muscleGroup: '腿', unit: 'reps', icon: '🦵', expPerUnit: 1.0 },
  { name: '小腿提踵', category: 'strength', muscleGroup: '腿', unit: 'reps', icon: '🦵', expPerUnit: 0.8 },
  { name: '飛鳥', category: 'strength', muscleGroup: '胸', unit: 'reps', icon: '💪', expPerUnit: 1.0 },
  { name: '俯身側平舉', category: 'strength', muscleGroup: '肩', unit: 'reps', icon: '🤸', expPerUnit: 1.0 },
  { name: '側平舉', category: 'strength', muscleGroup: '肩', unit: 'reps', icon: '🤸', expPerUnit: 1.0 },
  { name: '伏地挺身', category: 'strength', muscleGroup: '胸', unit: 'reps', icon: '💪', expPerUnit: 0.8 },
  { name: '仰臥起坐', category: 'strength', muscleGroup: '核心', unit: 'reps', icon: '🎯', expPerUnit: 0.7 },
  { name: '平板支撐', category: 'strength', muscleGroup: '核心', unit: 'seconds', icon: '🎯', expPerUnit: 0.3 },
  { name: '俄羅斯轉體', category: 'strength', muscleGroup: '核心', unit: 'reps', icon: '🎯', expPerUnit: 0.6 },
  { name: '懸垂舉腿', category: 'strength', muscleGroup: '核心', unit: 'reps', icon: '🎯', expPerUnit: 1.1 },
  { name: '登山者', category: 'strength', muscleGroup: '核心', unit: 'reps', icon: '🎯', expPerUnit: 0.6 },
  { name: '跑步', category: 'cardio', muscleGroup: '全身', unit: 'minutes', icon: '🏃', expPerUnit: 5 },
  { name: '快走', category: 'cardio', muscleGroup: '全身', unit: 'minutes', icon: '🚶', expPerUnit: 2 },
  { name: '腳踏車', category: 'cardio', muscleGroup: '腿', unit: 'minutes', icon: '🚴', expPerUnit: 4 },
  { name: '游泳', category: 'cardio', muscleGroup: '全身', unit: 'minutes', icon: '🏊', expPerUnit: 6 },
  { name: '跳繩', category: 'cardio', muscleGroup: '全身', unit: 'minutes', icon: '🪢', expPerUnit: 7 },
  { name: '划船機', category: 'cardio', muscleGroup: '全身', unit: 'minutes', icon: '🚣', expPerUnit: 5 },
  { name: '飛輪', category: 'cardio', muscleGroup: '腿', unit: 'minutes', icon: '🚴', expPerUnit: 6 },
  { name: '橢圓機', category: 'cardio', muscleGroup: '全身', unit: 'minutes', icon: '🏃', expPerUnit: 4 },
  { name: '登階', category: 'cardio', muscleGroup: '腿', unit: 'minutes', icon: '🪜', expPerUnit: 4 },
  { name: 'HIIT', category: 'cardio', muscleGroup: '全身', unit: 'minutes', icon: '🔥', expPerUnit: 8 },
  { name: '瑜伽', category: 'flexibility', muscleGroup: '全身', unit: 'minutes', icon: '🧘', expPerUnit: 3 },
  { name: '伸展', category: 'flexibility', muscleGroup: '全身', unit: 'minutes', icon: '🤸', expPerUnit: 2 },
  { name: '泡沫軸放鬆', category: 'flexibility', muscleGroup: '全身', unit: 'minutes', icon: '🎢', expPerUnit: 2 },
  { name: '靜態伸展', category: 'flexibility', muscleGroup: '全身', unit: 'minutes', icon: '🧘', expPerUnit: 2 },
  { name: '動態伸展', category: 'flexibility', muscleGroup: '全身', unit: 'minutes', icon: '🤸', expPerUnit: 3 },
  { name: '太極', category: 'flexibility', muscleGroup: '全身', unit: 'minutes', icon: '☯️', expPerUnit: 3 },
  { name: '皮拉提斯', category: 'flexibility', muscleGroup: '核心', unit: 'minutes', icon: '🧘', expPerUnit: 4 },
  { name: '深蹲伸展', category: 'flexibility', muscleGroup: '腿', unit: 'minutes', icon: '🦵', expPerUnit: 2 },
  { name: '頸部伸展', category: 'flexibility', muscleGroup: '上身', unit: 'minutes', icon: '🤸', expPerUnit: 1 },
  { name: '肩部環繞', category: 'flexibility', muscleGroup: '肩', unit: 'minutes', icon: '🤸', expPerUnit: 1 },
];

export const PET_SPECIES = {
  strength: [
    { name: '力鬥獸', emoji: '🦾', stageEmojis: ['🥚', '🐣', '🦾', '💪'] },
    { name: '金剛猿', emoji: '🦍', stageEmojis: ['🥚', '🐣', '🦍', '🦾'] },
    { name: '熔岩龍', emoji: '🐉', stageEmojis: ['🥚', '🐣', '🐲', '🐉'] },
  ],
  cardio: [
    { name: '疾風鳥', emoji: '🦅', stageEmojis: ['🥚', '🐣', '🐦', '🦅'] },
    { name: '閃電豹', emoji: '🐆', stageEmojis: ['🥚', '🐣', '🐈', '🐆'] },
    { name: '浪花魚', emoji: '🐬', stageEmojis: ['🥚', '🐣', '🐟', '🐬'] },
  ],
  flex: [
    { name: '柔雲貓', emoji: '🐈', stageEmojis: ['🥚', '🐣', '🐱', '🐈'] },
    { name: '祥雲鶴', emoji: '🦢', stageEmojis: ['🥚', '🐣', '🐤', '🦢'] },
    { name: '禪定龜', emoji: '🐢', stageEmojis: ['🥚', '🐣', '🐢', '🐉'] },
  ],
} as const;

export const EGG_CONFIG = {
  strength: { emoji: '🥚', color: '#F97316', name: '力量蛋', required: 500 },
  cardio: { emoji: '🥚', color: '#06B6D4', name: '耐力蛋', required: 500 },
  flex: { emoji: '🥚', color: '#A855F7', name: '柔韌蛋', required: 500 },
} as const;
