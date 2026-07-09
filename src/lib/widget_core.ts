// Widget 顯示 payload 純函數（零 import）。見 scripts/verify_health_widget.ts。

export type WidgetPayload = {
  dateKey: string;
  caloriesEaten: number;
  caloriesTarget: number;
  workouts: number;
  waterMl: number;
  waterTargetMl: number;
};

export type WidgetInput = {
  dateKey: string;
  caloriesEaten?: number;
  caloriesTarget?: number;
  workouts?: number;
  waterMl?: number;
  waterTargetMl?: number;
};

function nn(n: number | undefined | null): number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

/** 今日摘要 → widget 扁平 payload；缺值/非有限/負 → 0；dateKey 非字串 → ''。 */
export function buildWidgetPayload(input: WidgetInput): WidgetPayload {
  return {
    dateKey: typeof input.dateKey === 'string' ? input.dateKey : '',
    caloriesEaten: nn(input.caloriesEaten),
    caloriesTarget: nn(input.caloriesTarget),
    workouts: nn(input.workouts),
    waterMl: nn(input.waterMl),
    waterTargetMl: nn(input.waterTargetMl),
  };
}
