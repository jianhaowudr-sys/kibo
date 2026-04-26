/**
 * 全 App 共用手勢常數。任何 swipe / long-press / tap 元件都要從這裡引用，
 * 確保操作邏輯統一（plan v2 §3.2）。
 *
 * 改動這裡會全 App 同步調整，請慎重。
 */

/** 啟動長按所需毫秒數（例如進入拖曳排序模式、開啟 Bristol modal）。預設 500ms。 */
export const LONG_PRESS_MS = 500;

/** Swipeable 右滑啟動門檻（左滑刪除）。沿用既有 60。 */
export const SWIPE_RIGHT_THRESHOLD = 60;

/** Swipeable 是否允許 overshoot。沿用既有 false（避免回彈過頭）。 */
export const SWIPE_OVERSHOOT = false;

/** Quick-add 連點合併視窗（毫秒），喝水卡 +100 連點 2 秒內合併。 */
export const QUICK_ADD_BATCH_MS = 2000;

/** 按住累積（hold-to-fill）的 tick 間隔（毫秒）— 喝水卡按住 +100。 */
export const HOLD_TICK_MS = 200;

/** Undo toast 倒數秒數。 */
export const UNDO_TOAST_SECONDS = 5;
