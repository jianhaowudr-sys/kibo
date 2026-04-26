import { useAppStore } from '@/stores/useAppStore';

/**
 * 低負擔模式（plan v3 §14）。
 *
 * 開啟後元件應改變行為以節省效能：
 *  - WheelPicker → 退化成 ±step 三段按鈕
 *  - 像素 sprite 動畫 → 停在 frame 1
 *  - PetScene 雲動畫 → 靜態
 *  - UndoToast 倒數更新間隔 → 拉長
 *  - 多照片 OCR → 序列而非並行
 *  - 拖曳 isActive 視覺特效 → 簡化
 */
export function useLowPower(): boolean {
  return useAppStore((s) => s.lowPowerMode);
}
