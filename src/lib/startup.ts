import { ensureSchema } from '@/db/migrate';
import { useAppStore } from '@/stores/useAppStore';
import { useTutorialStore } from '@/stores/useTutorialStore';
import { perfStart } from '@/lib/perf';

/**
 * 關鍵路徑：首屏渲染前必須完成的初始化。
 * - DB 鏈：ensureSchema → bootstrap（bootstrap 依賴 schema，必須依序）
 * - 偏好鏈：主題/低耗/檢視模式等 AsyncStorage 讀取 + 教學 hydrate（與 DB 鏈並行；
 *   主題必須在首繪前就緒，避免主題閃爍）
 * 任一失敗 throw，由呼叫端顯示「初始化錯誤」畫面。
 */
export async function runCriticalStartup(): Promise<void> {
  const endTotal = perfStart('startup:critical');
  const app = useAppStore.getState();
  const tutorial = useTutorialStore.getState();

  const dbChain = (async () => {
    const endSchema = perfStart('startup:schema');
    await ensureSchema();
    endSchema();
    const endBoot = perfStart('startup:bootstrap');
    await app.bootstrap();
    endBoot();
  })();

  const endPrefs = perfStart('startup:prefs');
  const prefsChain = Promise.all([
    app.loadThemeMode(),
    app.loadThemeStyle(),
    app.loadLowPowerMode(),
    app.loadCalendarViewMode(),
    app.loadStatsLayoutJson(),
    app.loadOnboardingPetName(),
    tutorial.hydrate(),
  ]).then(() => endPrefs());

  await Promise.all([dbChain, prefsChain]);
  endTotal();
}

/**
 * 背景階段：setReady 之後執行，失敗只 warn 不擋使用。
 * - loadAuthSession：打 Supabase（網路），登入態晚到由 state 更新自然反映
 * - generateDailyMessages：每日寵物訊息；完成後 refreshHealth 重載 petMessages
 */
export function runBackgroundStartup(): void {
  void (async () => {
    const end = perfStart('startup:background');
    const app = useAppStore.getState();
    try {
      await app.loadAuthSession();
    } catch (e) {
      console.warn('[startup] 登入態載入失敗', e);
    }
    // 每次啟動重排通知：讓喝水 interval→固定每日時間的遷移實際生效（migration 只改記憶體，
    // 需 rescheduleAll 才會把新 DAILY 觸發排進系統；否則舊 DATE 觸發過期後就再也不響）。
    try {
      // 必須先確認 user 已載入：bootstrap 在 !user 時會提早返回而不碰 healthSettings，
      // 此時拿到的是「全部關閉」的預設值 → rescheduleAll 會先 cancelAll 再什麼都不排，
      // 等於把使用者所有提醒清光。
      if (useAppStore.getState().user) {
        const { rescheduleAll } = await import('@/lib/reminders');
        await rescheduleAll(useAppStore.getState().healthSettings);
      }
    } catch (e) {
      console.warn('[startup] 通知重排失敗', e);
    }
    // per-step try/catch：任一步失敗不吞掉後續（原本共用一個 try，訊息失敗會連帶跳過週回顧/refreshHealth）
    const { user, pets } = useAppStore.getState();
    if (user) {
      try {
        const { generateDailyMessages } = await import('@/lib/pet_messages');
        await generateDailyMessages(user.id, pets[0] ?? null, user.streak);
      } catch (e) {
        console.warn('[startup] 寵物訊息生成失敗', e);
      }
      try {
        const { maybeGenerateWeeklyReview } = await import('@/lib/weekly_review');
        await maybeGenerateWeeklyReview(user.id, pets[0] ?? null);
      } catch (e) {
        console.warn('[startup] 週回顧生成失敗', e);
      }
      try {
        await useAppStore.getState().refreshHealth();
      } catch (e) {
        console.warn('[startup] refreshHealth 失敗', e);
      }
    }
    end();
  })();
}
