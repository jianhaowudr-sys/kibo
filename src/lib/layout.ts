/**
 * 共用版面常數。任何浮動底 bar / safe area padding 都要從這裡引用，
 * 避免每個畫面硬編不同數字導致內容被擋。
 */

/**
 * 浮動底 bar（「完成」「儲存」「開始訓練」等）的最小 padding。
 * ScrollView contentContainerStyle.paddingBottom 至少要這個值，
 * 不然清單最後一項會被擋。
 */
export const BOTTOM_BAR_PADDING = 120;

/** 純 ScrollView（無浮動底 bar）內容底部留白。 */
export const SCROLL_BOTTOM_PADDING = 40;
