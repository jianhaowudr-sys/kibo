# 進度照時間軸（v1.0.3 主功能）— Design Spec

- **Date**: 2026-05-10
- **Owner**: Ollie
- **Target version**: Kibo v1.0.3
- **Status**: Spec drafted, awaiting implementation plan

---

## 1. 目標與差異化

讓使用者長期追蹤體態變化的視覺證據。三個視角（正面 / 側面 / 背面）+ 時間軸 swipe 切換 + 一鍵 in-app 播放動畫，看到「自己變壯/變瘦」的累積過程。

差異化要點：
- 多數 fitness app 只記體脂數字，沒有視覺化體態時間軸
- 時間軸+播放動畫產出的視覺體驗本身可作為 App Store 截圖素材
- 純本機儲存（隱私優先），不上雲端，避免裸體照雲審核風險

不做的事：
- 不做 GIF/MP4 匯出（v1.0.4+ 再評估）
- 不做 AI pose detection 對齊（v1.0.4+ 再評估）
- 不疊寵物 sprite（捨棄路線 H）
- 不整合 body_measurements（捨棄路線 G，獨立模組）

## 2. 範圍框定（v1.0.3 含 / 不含）

| 包含 | 不包含 |
|---|---|
| 三視角（正/側/背）拍攝、儲存、瀏覽 | MP4 匯出 |
| Onion skin 拍攝引導（疊上一張同視角 30%） | 真 GIF 匯出 |
| 自動 center crop 3:4（1080×1440 jpg） | 手動 crop/旋轉微調 UI |
| 拍照時錄下 weight/bodyFat snapshot | 雲端同步 |
| Timeline 主頁：角度 tab + horizontal FlatList swipe + 播放鈕 | AI pose detection / 自動對齊 |
| In-app 播放動畫（每張 600ms cut，無 cross-fade — stop-motion 風格） | 寵物 sprite 疊圖 |
| 刪除單張照片 | 連續多選刪除 |
| 拍攝前提示「對齊上次」 1.5s | 拍攝後對齊微調 |

## 3. 對齊策略：A onion skin + C center crop

採用「拍攝時引導」+「拍攝後自動框定」雙管，**不做技術對齊**：

- **A · Onion skin**：拍攝 preview 上疊一層 30% opacity 的「上一張同視角照」，使用者用視覺對齊。同時疊垂直中線 + 三條水平引導線（自畫面頂端往下 18% 為頭頂線、28% 為肩線、92% 為腳踝線）。
- **C · Center crop**：拍完後不向使用者詢問裁切參數，後台自動 center crop 到 portrait 3:4，resize 到 1080×1440 jpg quality 0.85。Confirm 頁仍會顯示裁切結果讓使用者按「重拍／儲存」做最後決定。即使站位差 5cm，因畫框統一，視覺上不跳動。

**為什麼夠用**：在 timeline 切換 / 播放時，使用者主要看「身體輪廓的變化」，框體一致 + onion skin 引導下站位即可達 80 分。AI 對齊（路線 D）留給 v1.0.4 看實際抱怨再做。

## 4. 動畫策略：In-app stop-motion

- 不做 cross-fade（會模糊掉「拍了多少張」的累積感）
- 用 `FlatList ref.scrollToIndex({ animated: true })` 每 600ms 推進一張，到尾自動停
- 視覺風格類似復古 flip-book / stop-motion，反而比 fade 更能傳達「進步軌跡」

## 5. 架構（檔案地圖）

```
src/db/migrate.ts                  改  +SCHEMA_SQL progress_photos + 2 indexes
src/db/schema.ts                   改  +progressPhotos Drizzle table + ProgressPhoto type
src/db/repo.ts                     改  +addProgressPhoto / listProgressPhotos / deleteProgressPhoto / getLatestPhotoByAngle
src/lib/photo_storage.ts           改  PhotoTable += 'progress'
src/lib/progress_photo.ts          新  centerCrop 3:4 (ImageManipulator wrap) + 取最近 body_measurement snapshot
src/stores/useAppStore.ts          改  progressPhotos slice + refreshProgressPhotos / addProgressPhoto / deleteProgressPhoto
app/progress/index.tsx             新  Timeline 主頁（角度 tab + horizontal FlatList + 播放）
app/progress/angle-picker.tsx      新  modal：選正/側/背 → push capture
app/progress/capture.tsx           新  expo-camera 拍攝頁（onion skin overlay + 引導線）
app/progress/confirm.tsx           新  拍完確認頁（cropped preview + 備註 + 儲存）
app/_layout.tsx                    改  +4 個 Stack.Screen
app/(tabs)/me.tsx                  改  「📊 體態量測」卡旁加「📸 進度照」卡
src/lib/tutorials.ts               改  +progress-capture-onion-skin / progress-timeline-play 兩條 tip
package.json                       改  +expo-camera +expo-image-manipulator
```

## 6. Data model

### Schema (`progress_photos`)

```sql
CREATE TABLE IF NOT EXISTS progress_photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  captured_at INTEGER NOT NULL,
  angle       TEXT NOT NULL,
  photo_uri   TEXT NOT NULL,
  weight_kg        REAL,
  body_fat_pct     REAL,
  note        TEXT,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_progress_user_at
  ON progress_photos(user_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_progress_user_angle_at
  ON progress_photos(user_id, angle, captured_at DESC);
```

### TypeScript shape

```ts
type Angle = 'front' | 'side' | 'back';

type ProgressPhoto = {
  id: number;
  userId: number;
  capturedAt: number;          // unix ms
  angle: Angle;
  photoUri: string;            // relative "photos/progress/xxx.jpg"
  weightKg: number | null;     // snapshot 拍攝當下最近一筆 body_measurement
  bodyFatPct: number | null;   // 同上
  note: string | null;
  createdAt: number;
};
```

### Snapshot 規則

`addProgressPhoto` 內部呼叫 `getLatestBodyMeasurement(userId)`，把 `weightKg` / `bodyFatPct` 寫入新照片紀錄。**未來變化追蹤的 delta 計算依靠此 snapshot**，避免 timeline 大量 join。

如果該 user 一筆 body_measurement 都沒有 → snapshot 兩個欄位皆 null，timeline 顯示日期但隱藏「-X kg」變化標。

## 7. Capture flow（含 onion skin 對齊細節）

```
me.tsx 「📸 進度照」
   ↓
/progress (timeline 主頁)
   ↓ tap 「+ 新增」
/progress/angle-picker (modal)
   ↓ 選擇 front/side/back
/progress/capture?angle=front
   - 撈 getLatestPhotoByAngle('front', userId)
   - 進 expo-camera CameraView，aspect 3:4 (portrait)
   - 若有 latest：疊 absolute Image opacity 0.3 在 preview 上
   - 永遠疊：垂直中線 + 三條水平引導線 (顏色 kibo-primary 30%)
   - 1.5s 後 toast「對齊上次」自動消失
   - 快門 onPress → takePictureAsync({ quality: 0.85 })
   ↓
/progress/confirm (modal, 帶拍攝結果 uri 與 angle)
   - centerCropTo3x4(uri) → 1080x1440 jpg
   - 顯示 cropped preview + (若有上一張) 並排對照
   - 備註輸入框 (optional)
   - 「重拍」按鈕 → router.back()
   - 「儲存」按鈕：
        savePhotoToDocs(croppedUri, 'progress')
        getLatestBodyMeasurement(userId) → snapshot
        repo.addProgressPhoto({...})
        store.refreshProgressPhotos()
        router.replace('/progress')
```

### Onion skin 顯示規則

- 角度第一張 → 不顯示 onion skin（無前一張）
- 第二張起 → 顯示該角度最近一張，opacity 0.3，居中對齊 camera preview
- 引導線**永遠**顯示（中線 + 頭/肩/腳踝水平線）

## 8. Timeline UI（`/progress` 主頁）

```
┌─────────────────────────────┐
│ ← 進度照            [⋯]      │
├─────────────────────────────┤
│ [正面]  側面   背面          │   ← angle tabs (active 標 underline)
├─────────────────────────────┤
│                              │
│       [大圖]                 │   ← FlatList horizontal pagingEnabled
│                              │   ← 一頁一張照片
│   2026-05-08 · 73.1 kg       │
│              · 體脂 16.2%    │
│   ↓ -2.1 kg vs 第一張        │
├─────────────────────────────┤
│ ●━━━━━●━━━━━━━━●━━━━●     │   ← 進度指示 dot row：每張一個 dot
│ 4/01  4/15   5/01  5/08     │     active dot 高亮，tap dot 可跳該張
├─────────────────────────────┤
│  [+ 新增]  [▶ 播放]  [刪除]  │
└─────────────────────────────┘
```

### 互動

- 角度 tab 切換 → 篩選對應 angle 的 photos asc by capturedAt → reset FlatList index = 0
- 大圖 FlatList swipe → 切換當前顯示張
- Dot row 中 tap 任一 dot → `flatListRef.scrollToIndex({ index, animated: true })` 跳該張
- 播放鈕：`flatListRef.scrollToIndex({ index: i+1, animated: true })` 每 600ms 推進一張，到尾自動停（再按重來）
- 第一張時，「↓ 變化」顯示為 0 / 隱藏；之後每張 = current.weightKg − first.weightKg
- 「+ 新增」 → push angle-picker
- 「刪除」 → Alert confirm → repo.deleteProgressPhoto + deletePhotoFile

### 空狀態

```
正面 [側面] [背面]

      📸
   還沒拍進度照
追蹤體態變化從第一張開始

   [ 拍第一張 ]
```

## 9. Entry point change（`(tabs)/me.tsx`）

目前在 `me.tsx` 第 950 行附近有「💌 意見回饋」+「☕ 贊助作者」並排區塊。

新增：「📊 體態量測」+「📸 進度照」也並排，放在「個人」section header 上方（與既有體態分頁同層級）。

```tsx
<View className="flex-row gap-3 mb-2">
  <Pressable onPress={() => router.push('/body')} className="flex-1 bg-kibo-surface ...">
    <Text className="text-2xl mb-1">📊</Text>
    <Text className="text-kibo-text font-semibold text-xs">體態量測</Text>
  </Pressable>
  <Pressable onPress={() => router.push('/progress')} className="flex-1 bg-kibo-surface ...">
    <Text className="text-2xl mb-1">📸</Text>
    <Text className="text-kibo-text font-semibold text-xs">進度照</Text>
  </Pressable>
</View>
```

如果原本「體態量測」入口在他處（如 sub-tab），保留原入口，僅新增進度照卡。

## 10. Routes（`app/_layout.tsx`）

```tsx
<Stack.Screen
  name="progress/index"
  options={{ title: '進度照', headerShown: true }}
/>
<Stack.Screen
  name="progress/angle-picker"
  options={{ title: '選角度', presentation: 'modal', headerShown: true }}
/>
<Stack.Screen
  name="progress/capture"
  options={{ headerShown: false, animation: 'fade' }}
/>
<Stack.Screen
  name="progress/confirm"
  options={{ title: '確認', presentation: 'modal', headerShown: true }}
/>
```

## 11. Dependencies 新增

| 套件 | 用途 | Expo SDK 54 相容性 |
|---|---|---|
| `expo-camera` | 拍攝頁的 CameraView，可疊 overlay（ImagePicker 不行）| 已是 Expo official，SDK 54 相容 |
| `expo-image-manipulator` | center crop 3:4 + resize 1080×1440 | 已是 Expo official，SDK 54 相容 |

實作前先 `npx expo install expo-camera expo-image-manipulator` 確保版本鎖到 SDK 54。

## 12. Error handling

| 情境 | 處理 |
|---|---|
| Camera 權限拒絕 | Alert「需要相機權限」+「打開設定」按鈕（`Linking.openSettings()`），返回 timeline |
| ImagePicker 改用 Camera 後仍要相簿 | 不需要相簿（純拍照） |
| 儲存失敗（磁碟滿、permission） | Alert「儲存失敗：<msg>」，cache 路徑保留供 retry |
| `photoExists()` 為 false 的舊紀錄 | timeline 顯 placeholder「⚠ 照片已遺失」+ 仍可刪除 |
| 同 angle 第一次拍 | onion skin 不顯示，只顯引導線 |
| 沒任何照片進 `/progress` | 空狀態 + 「拍第一張」CTA |
| FlatList scrollToIndex out of range | 自動 clamp 到 `[0, photos.length-1]` |
| 刪除照片 | Alert confirm → repo.deleteProgressPhoto + deletePhotoFile，refresh |
| 拍攝中途 background → 回 app | router.back() 回 timeline，棄拍攝 state |

## 13. Testing plan

純手動 device test（Kibo 沒 unit test 框架）。Tester：Ollie 自身 + Firebase distribution 3 人。

| # | 場景 | 預期結果 |
|---|---|---|
| 1 | 第一次進 `/progress` | 空狀態 + 「拍第一張」CTA |
| 2 | 拍第一張正面 | 不見 onion skin / 引導線顯示 / 儲存後 timeline 1 張 |
| 3 | 拍第二張正面（同日）| onion skin 顯示前一張 / 同日多張不去重 |
| 4 | 切到側面 angle | 看到空狀態（側面還沒拍）|
| 5 | 拍側面第一張 | onion skin 不顯，因為側面是新角度 |
| 6 | 兩張正面後按「▶ 播放」 | 自動切換、約 600ms 一張、到尾停 |
| 7 | 拍照後立即量體脂 | snapshot 是「拍照時的舊體脂」（不會回填）|
| 8 | 沒任何 body_measurement 拍進度照 | snapshot 兩欄為 null，timeline 不顯 delta |
| 9 | 刪除中間一張 | timeline 重新對齊、播放序列正常 |
| 10 | Camera 權限拒絕 → 點「打開設定」 | 正確跳到系統設定頁 |
| 11 | 換手機（已知純本機）| 進度照消失（預期）|
| 12 | iOS 直式 / 橫式 | 強制 portrait（與整 app 一致）|

## 14. Out of scope（預先記錄為 v1.0.4+ 候選）

- ffmpeg-kit-react-native 整合，匯出 MP4 分享到 IG/FB
- AI pose detection（MediaPipe / TFLite）做精準對齊
- 寵物 sprite 疊在進度照上（路線 H）
- 進度照與 body_measurements 整合（拍量測連帶拍 3 視角，路線 G）
- Tilt / focal length 記憶提醒（路線 F）
- 連續多選刪除 / 批次匯出
- Supabase Storage 雲端同步

## 15. Migration / 版號

- 不破壞既有 schema，僅新增 `progress_photos` table
- 走 Kibo `migrate.ts` 既有 `runAdditions()` pattern：`CREATE TABLE IF NOT EXISTS`，重啟 app 即套用
- 不需要 user 介入

## 16. 完工定義（DoD）

- [ ] 8 個新檔案 + 4 個改檔到位
- [ ] `expo-camera` + `expo-image-manipulator` 加入 deps、`npx expo prebuild` 通過
- [ ] DB migration 套用、`progress_photos` 表存在
- [ ] Testing plan 12 項在實機 Expo Go（iPhone）+ EAS preview build（Android APK）兩端驗過
- [ ] `tutorials.ts` 新增「進度照」教學 tip（拍攝引導 / 對齊提示）
- [ ] iOS Info.plist 補 `NSCameraUsageDescription` 中文描述（若已存在則確認）
- [ ] Android `<uses-permission android:name="android.permission.CAMERA"/>` 在 manifest（若已存在則確認）
- [ ] EAS 雙平台 build 觸發（依 `feedback_kibo_dual_build.md` 規則）
- [ ] `MEMORY.md` 對應條目更新進度
