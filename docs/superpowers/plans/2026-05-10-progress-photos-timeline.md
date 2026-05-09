# Kibo v1.0.3 進度照時間軸 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Kibo v1.0.3 single differentiation feature — three-angle (front/side/back) progress photo timeline with onion-skin capture guide, auto center-crop framing, and in-app stop-motion playback. Local-only storage.

**Architecture:** New independent module under `app/progress/*` with its own SQLite table `progress_photos`, Zustand slice, and 4 routes. Uses `expo-camera` (overlay capable) for capture and `expo-image-manipulator` for 3:4 center crop to 1080×1440 jpg. Body measurement weight/bodyfat snapshot is captured at save-time so the timeline can render delta without joins.

**Tech Stack:** Expo SDK 54, expo-router 6, expo-sqlite + Drizzle ORM 0.45, Zustand 5, NativeWind 4, **new deps:** `expo-camera`, `expo-image-manipulator`.

**Spec:** `docs/superpowers/specs/2026-05-10-progress-photos-timeline-design.md`

**Testing model:** Kibo has no unit-test framework. Each task ends with a manual smoke test on an Expo Go device (iPhone) and a commit. Final task triggers iOS GitHub Actions + EAS Android build per the project's dual-build rule.

**Branch:** Continue on `feature/v1.0.2-libpct-eggs` (current). Final commit retitles version 1.0.3.

---

## File Map (locked decomposition)

```
NEW   src/lib/progress_photo.ts                center crop + snapshot helpers
NEW   app/progress/index.tsx                   timeline (angle tabs + FlatList + play)
NEW   app/progress/angle-picker.tsx            modal: pick front/side/back
NEW   app/progress/capture.tsx                 expo-camera + onion skin overlay
NEW   app/progress/confirm.tsx                 cropped preview + save

MOD   src/db/schema.ts                         +progressPhotos table + Angle/ProgressPhoto types
MOD   src/db/migrate.ts                        +SCHEMA_SQL CREATE TABLE + 2 indexes
MOD   src/db/repo.ts                           +4 repo functions
MOD   src/lib/photo_storage.ts                 PhotoTable += 'progress'
MOD   src/stores/useAppStore.ts                +progressPhotos slice + 3 actions
MOD   app/_layout.tsx                          +4 Stack.Screen entries
MOD   app/(tabs)/me.tsx                        +「📊 體態量測」「📸 進度照」row
MOD   src/lib/tutorials.ts                     +2 tutorial tips
MOD   app.json                                 version 1.0.2→1.0.3, ios.buildNumber 2→9, android.versionCode 1→29
MOD   package.json                             expo install adds 2 deps (auto)
```

---

## Task 1: Schema — Drizzle table + types

**Files:**
- Modify: `src/db/schema.ts` (add table after `bodyMeasurements`, add types at bottom of types section)

- [ ] **Step 1: Add `progressPhotos` Drizzle table**

Insert immediately after the `bodyMeasurements` table block (around line 79):

```ts
export const progressPhotos = sqliteTable('progress_photos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  capturedAt: integer('captured_at', { mode: 'timestamp_ms' }).notNull(),
  angle: text('angle').notNull(),                  // 'front' | 'side' | 'back'
  photoUri: text('photo_uri').notNull(),           // relative "photos/progress/xxx.jpg"
  weightKg: real('weight_kg'),                     // snapshot from latest body_measurements at save time
  bodyFatPct: real('body_fat_pct'),                // snapshot
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});
```

- [ ] **Step 2: Add type exports**

Append to the type-exports block at bottom (after line ~344, near `DailyScore`):

```ts
export type ProgressPhoto = typeof progressPhotos.$inferSelect;
export type NewProgressPhoto = typeof progressPhotos.$inferInsert;
export type ProgressAngle = 'front' | 'side' | 'back';
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```powershell
cd D:\kibo; npx tsc --noEmit
```
Expected: no new errors introduced (pre-existing errors in unrelated files are fine; just confirm `schema.ts` is clean).

- [ ] **Step 4: Commit**

```powershell
cd D:\kibo; git add src/db/schema.ts; git commit -m "v1.0.3 schema: progressPhotos Drizzle table + types"
```

---

## Task 2: SQL migration — CREATE TABLE + indexes

**Files:**
- Modify: `src/db/migrate.ts` (extend `SCHEMA_SQL`, add index creation in `runAdditions`)

- [ ] **Step 1: Add CREATE TABLE to SCHEMA_SQL**

Locate the closing backtick of `SCHEMA_SQL` near line 275 (right after `pending_deletions`, before the trailing backtick `` ` ``). Insert before the closing backtick:

```sql
CREATE TABLE IF NOT EXISTS progress_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  captured_at INTEGER NOT NULL,
  angle TEXT NOT NULL,
  photo_uri TEXT NOT NULL,
  weight_kg REAL,
  body_fat_pct REAL,
  note TEXT,
  created_at INTEGER NOT NULL
);
```

- [ ] **Step 2: Add indexes in `runAdditions`**

Locate `runAdditions` function. After the existing `idx_daily_scores_user_day` `CREATE INDEX` call (around line 393-395), append:

```ts
  await sqliteDb.runAsync(
    'CREATE INDEX IF NOT EXISTS idx_progress_user_at ON progress_photos(user_id, captured_at DESC)',
  );
  await sqliteDb.runAsync(
    'CREATE INDEX IF NOT EXISTS idx_progress_user_angle_at ON progress_photos(user_id, angle, captured_at DESC)',
  );
```

- [ ] **Step 3: Smoke test on device**

Stop any running dev server. Run:
```powershell
cd D:\kibo; $env:EXPO_OFFLINE='1'; npx expo start --lan --clear
```
Open Kibo on iPhone via Expo Go. App should boot to home without errors. The `ensureSchema()` call in `app/_layout.tsx` runs on every boot, so the new table is now created in the device SQLite.

Verify (optional but encouraged) — open the app's developer menu and run a one-shot probe via the diet `/me` settings or via a temporary `console.log`. Skip if app booted cleanly.

Expected: app launches normally. No "no such table" errors.

- [ ] **Step 4: Commit**

```powershell
cd D:\kibo; git add src/db/migrate.ts; git commit -m "v1.0.3 migrate: CREATE TABLE progress_photos + 2 indexes"
```

---

## Task 3: Photo storage — extend PhotoTable union

**Files:**
- Modify: `src/lib/photo_storage.ts:12`

- [ ] **Step 1: Add `'progress'` to PhotoTable**

Change line 12 from:
```ts
export type PhotoTable = 'meals' | 'body' | 'food_library';
```
to:
```ts
export type PhotoTable = 'meals' | 'body' | 'food_library' | 'progress';
```

- [ ] **Step 2: Verify TypeScript still compiles**

Run:
```powershell
cd D:\kibo; npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```powershell
cd D:\kibo; git add src/lib/photo_storage.ts; git commit -m "v1.0.3 storage: extend PhotoTable with 'progress'"
```

---

## Task 4: Repo functions — CRUD + queries

**Files:**
- Modify: `src/db/repo.ts` (append at end of body_measurements section, around line 941, before custom-foods section)

- [ ] **Step 1: Update top-of-file imports**

Find the type import block at line 2-6 and add `ProgressPhoto, NewProgressPhoto, ProgressAngle`:

```ts
import type {
  User, Exercise, Workout, WorkoutSet, Egg, Pet, EggType,
  Routine, RoutineExercise, BodyMeasurement, NewBodyMeasurement,
  Meal, NewMeal, MealType,
  ProgressPhoto, NewProgressPhoto, ProgressAngle,
} from './schema';
```

- [ ] **Step 2: Add `rowToProgressPhoto` and 4 repo functions**

Locate the spot right after `recentWorkoutDates` function and right before `// ===== Custom Foods（plan v5）=====` comment (around line 941). Insert:

```ts
// ===== Progress Photos（v1.0.3）=====

const rowToProgressPhoto = (r: Row): ProgressPhoto => ({
  id: r.id,
  userId: r.user_id,
  capturedAt: new Date(r.captured_at),
  angle: r.angle,
  photoUri: r.photo_uri,
  weightKg: r.weight_kg,
  bodyFatPct: r.body_fat_pct,
  note: r.note,
  createdAt: new Date(r.created_at),
});

export async function listProgressPhotos(userId: number): Promise<ProgressPhoto[]> {
  const rs = await sqliteDb.getAllAsync<Row>(
    'SELECT * FROM progress_photos WHERE user_id = ? ORDER BY captured_at ASC',
    [userId],
  );
  return rs.map(rowToProgressPhoto);
}

export async function getLatestProgressPhotoByAngle(
  userId: number,
  angle: ProgressAngle,
): Promise<ProgressPhoto | null> {
  const r = await sqliteDb.getFirstAsync<Row>(
    'SELECT * FROM progress_photos WHERE user_id = ? AND angle = ? ORDER BY captured_at DESC LIMIT 1',
    [userId, angle],
  );
  return r ? rowToProgressPhoto(r) : null;
}

export async function createProgressPhoto(data: {
  userId: number;
  capturedAt: Date | number;
  angle: ProgressAngle;
  photoUri: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  note: string | null;
}): Promise<number> {
  const persisted = await savePhotoToDocs(data.photoUri, 'progress');
  const result = await sqliteDb.runAsync(
    `INSERT INTO progress_photos
       (user_id, captured_at, angle, photo_uri, weight_kg, body_fat_pct, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.userId,
      typeof data.capturedAt === 'number' ? data.capturedAt : data.capturedAt.getTime(),
      data.angle,
      persisted ?? data.photoUri,
      data.weightKg,
      data.bodyFatPct,
      data.note,
      Date.now(),
    ],
  );
  return result.lastInsertRowId as number;
}

export async function deleteProgressPhoto(id: number): Promise<void> {
  const r = await sqliteDb.getFirstAsync<Row>('SELECT photo_uri FROM progress_photos WHERE id = ?', [id]);
  if (r?.photo_uri) await deletePhotoFile(r.photo_uri);
  await enqueueRemoteDelete('progress_photos', id);
  await sqliteDb.runAsync('DELETE FROM progress_photos WHERE id = ?', [id]);
}

export async function getLatestBodyMeasurementForSnapshot(userId: number): Promise<{
  weightKg: number | null;
  bodyFatPct: number | null;
} | null> {
  const r = await sqliteDb.getFirstAsync<Row>(
    'SELECT weight_kg, body_fat_pct FROM body_measurements WHERE user_id = ? ORDER BY measured_at DESC LIMIT 1',
    [userId],
  );
  if (!r) return null;
  return { weightKg: r.weight_kg, bodyFatPct: r.body_fat_pct };
}
```

- [ ] **Step 3: Verify TypeScript**

Run:
```powershell
cd D:\kibo; npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 4: Commit**

```powershell
cd D:\kibo; git add src/db/repo.ts; git commit -m "v1.0.3 repo: progress_photos CRUD + body snapshot helper"
```

---

## Task 5: Center crop helper + snapshot wiring

**Files:**
- Create: `src/lib/progress_photo.ts`

- [ ] **Step 1: Install `expo-image-manipulator`**

This is a new dependency. Run:
```powershell
cd D:\kibo; npx expo install expo-image-manipulator
```
Expected: package.json updated with the SDK 54-pinned version.

- [ ] **Step 2: Create the helper file**

Create `src/lib/progress_photo.ts`:

```ts
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const TARGET_W = 1080;
const TARGET_H = 1440; // 3:4 portrait

/**
 * Center-crop the source image to portrait 3:4, then resize to 1080x1440 jpg quality 0.85.
 *
 * `srcUri` is the file:// URI returned by expo-camera takePictureAsync.
 * Returns a fresh file:// URI under cache directory.
 */
export async function centerCropTo3x4(srcUri: string, srcWidth: number, srcHeight: number): Promise<string> {
  const targetRatio = TARGET_W / TARGET_H; // 0.75
  const srcRatio = srcWidth / srcHeight;

  let cropW: number;
  let cropH: number;
  if (srcRatio > targetRatio) {
    // source is wider — crop width
    cropH = srcHeight;
    cropW = Math.round(srcHeight * targetRatio);
  } else {
    // source is taller — crop height
    cropW = srcWidth;
    cropH = Math.round(srcWidth / targetRatio);
  }
  const originX = Math.round((srcWidth - cropW) / 2);
  const originY = Math.round((srcHeight - cropH) / 2);

  const out = await manipulateAsync(
    srcUri,
    [
      { crop: { originX, originY, width: cropW, height: cropH } },
      { resize: { width: TARGET_W, height: TARGET_H } },
    ],
    { compress: 0.85, format: SaveFormat.JPEG },
  );
  return out.uri;
}

export const ANGLE_LABELS: Record<'front' | 'side' | 'back', string> = {
  front: '正面',
  side: '側面',
  back: '背面',
};

export const ANGLE_ORDER: ('front' | 'side' | 'back')[] = ['front', 'side', 'back'];
```

- [ ] **Step 3: Verify TypeScript**

Run:
```powershell
cd D:\kibo; npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 4: Commit**

```powershell
cd D:\kibo; git add src/lib/progress_photo.ts package.json package-lock.json; git commit -m "v1.0.3 lib: centerCropTo3x4 helper + ANGLE constants"
```

---

## Task 6: Install expo-camera + version bump

**Files:**
- Modify: `package.json` (auto-modified by expo install)
- Modify: `app.json` (version bump only — keep existing camera permission strings)

- [ ] **Step 1: Install `expo-camera`**

```powershell
cd D:\kibo; npx expo install expo-camera
```
Expected: package.json updated.

- [ ] **Step 2: Bump version + native build numbers in app.json**

In `app.json`:

- Change `"version": "1.0.2"` → `"version": "1.0.3"`
- Change `"buildNumber": "2"` (under `ios`) → `"buildNumber": "9"`
- Change `"versionCode": 1` (under `android`) → `"versionCode": 29`

The existing `NSCameraUsageDescription` and Android `CAMERA` permission already cover progress-photo capture; no changes needed.

- [ ] **Step 3: Verify Expo doctor**

```powershell
cd D:\kibo; npx expo-doctor
```
Expected: All checks pass (or only pre-existing warnings — no new errors).

- [ ] **Step 4: Commit**

```powershell
cd D:\kibo; git add package.json package-lock.json app.json; git commit -m "v1.0.3: bump version, install expo-camera"
```

---

## Task 7: Zustand slice — progressPhotos state + 3 actions

**Files:**
- Modify: `src/stores/useAppStore.ts` (state shape, initial value, action types, action implementations)

- [ ] **Step 1: Extend State type**

Find the `State = {` block (around line 51). Add inside the type, near `bodyMeasurements: BodyMeasurement[];` (around line 61):

```ts
  progressPhotos: ProgressPhoto[];
```

Update the imports at the top of the file. Find the line:
```ts
import type { User, Exercise, Workout, Egg, Pet, EggType, Routine, RoutineExercise, WorkoutSet, BodyMeasurement, Meal, MealType } from '@/db/schema';
```
Append `ProgressPhoto`:
```ts
import type { User, Exercise, Workout, Egg, Pet, EggType, Routine, RoutineExercise, WorkoutSet, BodyMeasurement, Meal, MealType, ProgressPhoto } from '@/db/schema';
```

- [ ] **Step 2: Add action signatures**

Find action signatures around line 148-150 (the `refreshBodyMeasurements`/`addBodyMeasurement`/`deleteBodyMeasurement` cluster) and add immediately after them:

```ts
  refreshProgressPhotos: () => Promise<void>;
  addProgressPhoto: (data: { angle: 'front' | 'side' | 'back'; photoUri: string; note: string | null }) => Promise<number>;
  deleteProgressPhoto: (id: number) => Promise<void>;
```

- [ ] **Step 3: Add initial state**

Find the initial state block around line 240-260 with `bodyMeasurements: [],`. Right after that line, add:

```ts
  progressPhotos: [],
```

- [ ] **Step 4: Add action implementations**

Locate `deleteBodyMeasurement` implementation (around line 687-691). Insert immediately after that closing `},`:

```ts
  refreshProgressPhotos: async () => {
    const { user } = get();
    if (!user) return;
    const progressPhotos = await repo.listProgressPhotos(user.id);
    set({ progressPhotos });
  },

  addProgressPhoto: async (data) => {
    const { user } = get();
    if (!user) throw new Error('no user');
    const snapshot = await repo.getLatestBodyMeasurementForSnapshot(user.id);
    const id = await repo.createProgressPhoto({
      userId: user.id,
      capturedAt: Date.now(),
      angle: data.angle,
      photoUri: data.photoUri,
      weightKg: snapshot?.weightKg ?? null,
      bodyFatPct: snapshot?.bodyFatPct ?? null,
      note: data.note,
    });
    await get().refreshProgressPhotos();
    return id;
  },

  deleteProgressPhoto: async (id) => {
    await repo.deleteProgressPhoto(id);
    await get().refreshProgressPhotos();
  },
```

- [ ] **Step 5: Verify TypeScript**

Run:
```powershell
cd D:\kibo; npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 6: Commit**

```powershell
cd D:\kibo; git add src/stores/useAppStore.ts; git commit -m "v1.0.3 store: progressPhotos slice + 3 actions"
```

---

## Task 8: Routes — register 4 Stack.Screen entries

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add Stack.Screen entries**

Find the `<Stack>` block (line 124). Insert these 4 entries between the existing `body/[id]` (line 141) and `diet/new` (line 142):

```tsx
          <Stack.Screen name="progress/index" options={{ title: '進度照' }} />
          <Stack.Screen name="progress/angle-picker" options={{ title: '選擇角度', presentation: 'modal' }} />
          <Stack.Screen name="progress/capture" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="progress/confirm" options={{ title: '確認', presentation: 'modal' }} />
```

- [ ] **Step 2: Smoke test**

App should still boot. Routes are not yet reachable — that's fine (entry button comes in Task 13).

```powershell
cd D:\kibo; $env:EXPO_OFFLINE='1'; npx expo start --lan
```
Expected: app boots; no router warnings about missing screens.

- [ ] **Step 3: Commit**

```powershell
cd D:\kibo; git add app/_layout.tsx; git commit -m "v1.0.3 routes: register 4 progress/* screens"
```

---

## Task 9: Angle picker modal

**Files:**
- Create: `app/progress/angle-picker.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as haptic from '@/lib/haptic';
import { ANGLE_LABELS, ANGLE_ORDER } from '@/lib/progress_photo';

export default function AnglePicker() {
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-kibo-bg" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text className="text-kibo-text text-base font-bold mb-2">這次拍哪個角度？</Text>
      <Text className="text-kibo-mute text-xs mb-6">
        三個角度都記比較好對比；同一角度站位、距離盡量一致，動畫播放時才不會跳。
      </Text>

      {ANGLE_ORDER.map((angle) => (
        <Pressable
          key={angle}
          onPress={() => {
            haptic.tapMedium();
            router.replace({ pathname: '/progress/capture', params: { angle } } as any);
          }}
          className="bg-kibo-surface rounded-2xl p-5 mb-3 border border-kibo-card flex-row items-center"
        >
          <Text className="text-3xl mr-4">
            {angle === 'front' ? '🧍' : angle === 'side' ? '🚶' : '🔙'}
          </Text>
          <View className="flex-1">
            <Text className="text-kibo-text font-bold text-base">{ANGLE_LABELS[angle]}</Text>
            <Text className="text-kibo-mute text-xs mt-1">
              {angle === 'front' ? '看肩寬／腰腰差' : angle === 'side' ? '看腹／臀曲線' : '看背肌／斜方'}
            </Text>
          </View>
          <Text className="text-kibo-mute text-2xl ml-2">›</Text>
        </Pressable>
      ))}

      <Pressable
        onPress={() => { haptic.tapLight(); router.back(); }}
        className="mt-3 py-3"
      >
        <Text className="text-kibo-mute text-center text-sm">取消</Text>
      </Pressable>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Smoke test (will fail at capture push for now)**

Open Expo Go. Cannot reach this screen yet (no entry button). Skip live test for now; Task 13 adds the entry path.

Verify TypeScript only:
```powershell
cd D:\kibo; npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```powershell
cd D:\kibo; git add app/progress/angle-picker.tsx; git commit -m "v1.0.3 ui: angle-picker modal"
```

---

## Task 10: Capture screen with onion skin overlay

**Files:**
- Create: `app/progress/capture.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { View, Text, Pressable, Image, Alert, Platform, Linking } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as haptic from '@/lib/haptic';
import { useAppStore } from '@/stores/useAppStore';
import { resolvePhotoUri } from '@/lib/photo_storage';
import { ANGLE_LABELS } from '@/lib/progress_photo';
import * as repo from '@/db/repo';

type Angle = 'front' | 'side' | 'back';

export default function ProgressCapture() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { angle = 'front' } = useLocalSearchParams<{ angle: Angle }>();
  const user = useAppStore((s) => s.user);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [latestUri, setLatestUri] = useState<string | null>(null);
  const [shooting, setShooting] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const latest = await repo.getLatestProgressPhotoByAngle(user.id, angle as Angle);
      if (latest) setLatestUri(resolvePhotoUri(latest.photoUri));
    })();
    const t = setTimeout(() => setHintVisible(false), 1500);
    return () => clearTimeout(t);
  }, [user, angle]);

  if (!permission) {
    return <View className="flex-1 bg-black" />;
  }
  if (!permission.granted) {
    return (
      <View className="flex-1 bg-kibo-bg items-center justify-center p-6">
        <Text className="text-kibo-text text-base font-bold mb-2">需要相機權限</Text>
        <Text className="text-kibo-mute text-xs text-center mb-6">
          進度照需要使用相機拍攝。授權後即可拍照，相片只存在這支手機。
        </Text>
        <Pressable
          onPress={async () => {
            const r = await requestPermission();
            if (!r.granted) {
              Alert.alert('還是被拒絕', '請到系統設定打開相機權限。', [
                { text: '取消', style: 'cancel' },
                { text: '打開設定', onPress: () => Linking.openSettings() },
              ]);
            }
          }}
          className="bg-kibo-primary rounded-2xl px-8 py-4 mb-3"
        >
          <Text className="text-kibo-bg font-bold">授權相機</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} className="py-3">
          <Text className="text-kibo-mute text-sm">取消</Text>
        </Pressable>
      </View>
    );
  }

  const onShutter = async () => {
    if (shooting || !cameraRef.current) return;
    setShooting(true);
    try {
      haptic.tapHeavy();
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, exif: false });
      if (!photo) throw new Error('拍照失敗');
      router.replace({
        pathname: '/progress/confirm',
        params: {
          angle: angle as string,
          uri: photo.uri,
          width: String(photo.width),
          height: String(photo.height),
          prevUri: latestUri ?? '',
        },
      } as any);
    } catch (e: any) {
      haptic.error();
      Alert.alert('拍照失敗', e?.message ?? String(e));
    } finally {
      setShooting(false);
    }
  };

  return (
    <View className="flex-1 bg-black">
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="back"
        ratio="4:3"
      >
        {/* onion skin (only if previous photo exists) */}
        {latestUri && (
          <Image
            source={{ uri: latestUri }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3 }}
            resizeMode="cover"
          />
        )}

        {/* alignment guides — always shown */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          {/* vertical center line */}
          <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
          {/* head 18% */}
          <View style={{ position: 'absolute', top: '18%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
          {/* shoulder 28% */}
          <View style={{ position: 'absolute', top: '28%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
          {/* ankle 92% */}
          <View style={{ position: 'absolute', top: '92%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
        </View>

        {/* top header */}
        <View style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0 }} className="px-4">
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => { haptic.tapLight(); router.back(); }}
              className="bg-black/50 rounded-full px-4 py-2"
            >
              <Text className="text-white text-base">✕</Text>
            </Pressable>
            <View className="bg-black/50 rounded-full px-4 py-2">
              <Text className="text-white font-bold text-sm">{ANGLE_LABELS[angle as Angle]}</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>
          {hintVisible && latestUri && (
            <View className="mt-3 self-center bg-black/60 rounded-2xl px-4 py-2">
              <Text className="text-white text-xs">疊影是上一張，對齊它再拍</Text>
            </View>
          )}
          {hintVisible && !latestUri && (
            <View className="mt-3 self-center bg-black/60 rounded-2xl px-4 py-2">
              <Text className="text-white text-xs">第一張正面照：站中線、頭頂貼上線</Text>
            </View>
          )}
        </View>

        {/* shutter */}
        <View style={{ position: 'absolute', bottom: insets.bottom + 24, left: 0, right: 0, alignItems: 'center' }}>
          <Pressable
            onPress={onShutter}
            disabled={shooting}
            style={{
              width: 78, height: 78, borderRadius: 39,
              borderWidth: 4, borderColor: 'white',
              backgroundColor: shooting ? 'rgba(255,255,255,0.4)' : 'white',
            }}
          />
          <Text className="text-white/80 text-xs mt-3">{shooting ? '處理中...' : '按下拍攝'}</Text>
        </View>
      </CameraView>
    </View>
  );
}
```

- [ ] **Step 2: Smoke test on device**

Cannot test live yet (no entry button). Verify TypeScript:
```powershell
cd D:\kibo; npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```powershell
cd D:\kibo; git add app/progress/capture.tsx; git commit -m "v1.0.3 ui: capture screen with onion skin + alignment guides"
```

---

## Task 11: Confirm screen — center crop preview + save

**Files:**
- Create: `app/progress/confirm.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { View, Text, Pressable, Image, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as haptic from '@/lib/haptic';
import { useAppStore } from '@/stores/useAppStore';
import { centerCropTo3x4, ANGLE_LABELS } from '@/lib/progress_photo';
import { useThemePalette } from '@/lib/useThemePalette';

type Angle = 'front' | 'side' | 'back';

export default function ProgressConfirm() {
  const router = useRouter();
  const palette = useThemePalette();
  const params = useLocalSearchParams<{
    angle: Angle;
    uri: string;
    width: string;
    height: string;
    prevUri: string;
  }>();
  const angle = (params.angle ?? 'front') as Angle;
  const srcUri = params.uri ?? '';
  const srcW = Number(params.width ?? '0');
  const srcH = Number(params.height ?? '0');
  const prevUri = params.prevUri || null;

  const addProgressPhoto = useAppStore((s) => s.addProgressPhoto);

  const [croppedUri, setCroppedUri] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!srcUri || !srcW || !srcH) throw new Error('缺少拍攝參數');
        const out = await centerCropTo3x4(srcUri, srcW, srcH);
        setCroppedUri(out);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      }
    })();
  }, [srcUri, srcW, srcH]);

  const onSave = async () => {
    if (!croppedUri) return;
    setBusy(true);
    try {
      haptic.tapMedium();
      await addProgressPhoto({ angle, photoUri: croppedUri, note: note.trim() || null });
      haptic.success();
      router.replace('/progress' as any);
    } catch (e: any) {
      haptic.error();
      Alert.alert('儲存失敗', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-kibo-bg" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text className="text-kibo-text text-base font-bold mb-2">確認 {ANGLE_LABELS[angle]}照片</Text>
      <Text className="text-kibo-mute text-xs mb-4">
        系統會自動裁切成統一比例（1080×1440），讓時間軸動畫不跳框。
      </Text>

      {err && (
        <View className="bg-kibo-danger/20 rounded-xl p-4 mb-4">
          <Text className="text-kibo-danger text-sm">處理失敗：{err}</Text>
        </View>
      )}

      <View className="flex-row gap-3 mb-4">
        <View className="flex-1">
          <Text className="text-kibo-mute text-xs mb-1">這張</Text>
          {croppedUri ? (
            <Image source={{ uri: croppedUri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12 }} />
          ) : (
            <View style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12 }} className="bg-kibo-card items-center justify-center">
              <ActivityIndicator color={palette.primary} />
            </View>
          )}
        </View>
        {prevUri && (
          <View className="flex-1">
            <Text className="text-kibo-mute text-xs mb-1">上一張</Text>
            <Image source={{ uri: prevUri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12 }} />
          </View>
        )}
      </View>

      <Text className="text-kibo-mute text-xs mb-2">備註（選填）</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="例：減脂第 3 週 / 賽前 14 天"
        placeholderTextColor={palette.placeholder}
        maxLength={200}
        className="bg-kibo-surface text-kibo-text rounded-xl px-4 py-3 mb-6 border border-kibo-card"
      />

      <Pressable
        onPress={onSave}
        disabled={busy || !croppedUri}
        className={`${busy || !croppedUri ? 'bg-kibo-card' : 'bg-kibo-primary'} rounded-2xl py-4 mb-3`}
      >
        <Text className="text-kibo-bg text-center font-bold">{busy ? '儲存中...' : '儲存'}</Text>
      </Pressable>

      <Pressable
        onPress={() => { haptic.tapLight(); router.back(); }}
        disabled={busy}
        className="py-3"
      >
        <Text className="text-kibo-mute text-center text-sm">重拍</Text>
      </Pressable>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```powershell
cd D:\kibo; npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```powershell
cd D:\kibo; git add app/progress/confirm.tsx; git commit -m "v1.0.3 ui: confirm screen — center crop preview + save"
```

---

## Task 12: Timeline main page — angle tabs + FlatList swipe + play

**Files:**
- Create: `app/progress/index.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { View, Text, Pressable, FlatList, Image, Alert, Dimensions, ScrollView } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import * as haptic from '@/lib/haptic';
import { useAppStore } from '@/stores/useAppStore';
import { resolvePhotoUri } from '@/lib/photo_storage';
import { ANGLE_LABELS, ANGLE_ORDER } from '@/lib/progress_photo';
import type { ProgressPhoto } from '@/db/schema';
import { displayDate } from '@/lib/date';

type Angle = 'front' | 'side' | 'back';

const SCREEN_W = Dimensions.get('window').width;
const PLAY_INTERVAL_MS = 600;

export default function ProgressTimeline() {
  const router = useRouter();
  const refresh = useAppStore((s) => s.refreshProgressPhotos);
  const all = useAppStore((s) => s.progressPhotos);
  const remove = useAppStore((s) => s.deleteProgressPhoto);

  const [angle, setAngle] = useState<Angle>('front');
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const flatRef = useRef<FlatList<ProgressPhoto>>(null);
  const playTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  // ⚠ Zustand selector 不能回傳衍生 array — 在元件內 useMemo 篩選
  const photos = useMemo(
    () => all.filter((p) => p.angle === angle).sort((a, b) => +a.capturedAt - +b.capturedAt),
    [all, angle],
  );

  // angle 切換時重置 index
  useEffect(() => {
    setIndex(0);
    if (flatRef.current && photos.length > 0) {
      try { flatRef.current.scrollToIndex({ index: 0, animated: false }); } catch {}
    }
  }, [angle, photos.length]);

  // 播放邏輯
  useEffect(() => {
    if (!playing) return;
    if (index >= photos.length - 1) {
      setPlaying(false);
      return;
    }
    playTimer.current = setTimeout(() => {
      const next = Math.min(index + 1, photos.length - 1);
      try { flatRef.current?.scrollToIndex({ index: next, animated: true }); } catch {}
      setIndex(next);
    }, PLAY_INTERVAL_MS);
    return () => {
      if (playTimer.current) clearTimeout(playTimer.current);
    };
  }, [playing, index, photos.length]);

  const startPlay = () => {
    if (photos.length < 2) return;
    haptic.tapMedium();
    if (index >= photos.length - 1) {
      setIndex(0);
      try { flatRef.current?.scrollToIndex({ index: 0, animated: false }); } catch {}
    }
    setPlaying(true);
  };

  const stopPlay = () => {
    if (playTimer.current) clearTimeout(playTimer.current);
    setPlaying(false);
  };

  const onAdd = () => {
    haptic.tapLight();
    router.push('/progress/angle-picker' as any);
  };

  const current = photos[index] ?? null;
  const first = photos[0] ?? null;
  const weightDelta = current && first && current.weightKg != null && first.weightKg != null
    ? current.weightKg - first.weightKg
    : null;
  const bodyFatDelta = current && first && current.bodyFatPct != null && first.bodyFatPct != null
    ? current.bodyFatPct - first.bodyFatPct
    : null;

  const onDeleteCurrent = () => {
    if (!current) return;
    Alert.alert('刪除這張？', '無法復原。', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          haptic.warning();
          stopPlay();
          await remove(current.id);
          setIndex(0);
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-kibo-bg">
      {/* angle tabs */}
      <View className="flex-row gap-2 px-4 pt-3 pb-2">
        {ANGLE_ORDER.map((a) => {
          const active = angle === a;
          return (
            <Pressable
              key={a}
              onPress={() => { haptic.tapLight(); stopPlay(); setAngle(a); }}
              className={`px-4 py-2 rounded-xl ${active ? 'bg-kibo-primary' : 'bg-kibo-card'}`}
            >
              <Text className={`text-sm font-bold ${active ? 'text-kibo-bg' : 'text-kibo-text'}`}>
                {ANGLE_LABELS[a]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {photos.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-7xl mb-4">📸</Text>
          <Text className="text-kibo-text font-bold text-base mb-2">還沒拍 {ANGLE_LABELS[angle]}進度照</Text>
          <Text className="text-kibo-mute text-xs text-center mb-8">
            拍第一張開始追蹤，之後每張都會疊上一張當對齊參考。
          </Text>
          <Pressable
            onPress={() => {
              haptic.tapMedium();
              router.push({ pathname: '/progress/capture', params: { angle } } as any);
            }}
            className="bg-kibo-primary rounded-2xl px-8 py-4"
          >
            <Text className="text-kibo-bg font-bold">拍第一張</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FlatList
            ref={flatRef}
            data={photos}
            keyExtractor={(p) => String(p.id)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
              if (i !== index) setIndex(i);
            }}
            getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
            renderItem={({ item }) => {
              const uri = resolvePhotoUri(item.photoUri);
              return (
                <View style={{ width: SCREEN_W, aspectRatio: 3 / 4, backgroundColor: '#000' }}>
                  {uri ? (
                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <Text className="text-kibo-mute text-xs">⚠ 照片已遺失</Text>
                    </View>
                  )}
                </View>
              );
            }}
          />

          {/* meta row */}
          <View className="px-4 pt-3">
            {current && (
              <>
                <Text className="text-kibo-text text-base font-bold">
                  {displayDate(current.capturedAt)}
                </Text>
                <View className="flex-row gap-3 mt-1">
                  {current.weightKg != null && (
                    <Text className="text-kibo-mute text-xs">{current.weightKg.toFixed(1)} kg</Text>
                  )}
                  {current.bodyFatPct != null && (
                    <Text className="text-kibo-mute text-xs">體脂 {current.bodyFatPct.toFixed(1)}%</Text>
                  )}
                </View>
                {(weightDelta != null || bodyFatDelta != null) && index > 0 && (
                  <View className="flex-row gap-3 mt-1">
                    {weightDelta != null && (
                      <Text className={`text-xs ${weightDelta < 0 ? 'text-kibo-success' : 'text-kibo-danger'}`}>
                        {weightDelta > 0 ? '↑' : '↓'} {Math.abs(weightDelta).toFixed(1)} kg vs 第一張
                      </Text>
                    )}
                    {bodyFatDelta != null && (
                      <Text className={`text-xs ${bodyFatDelta < 0 ? 'text-kibo-success' : 'text-kibo-danger'}`}>
                        體脂 {bodyFatDelta > 0 ? '↑' : '↓'} {Math.abs(bodyFatDelta).toFixed(1)}%
                      </Text>
                    )}
                  </View>
                )}
                {current.note && (
                  <Text className="text-kibo-mute text-xs mt-2 italic">{current.note}</Text>
                )}
              </>
            )}
          </View>

          {/* dot row — tap to jump */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 px-4" contentContainerStyle={{ alignItems: 'center', gap: 8 }}>
            {photos.map((p, i) => (
              <Pressable
                key={p.id}
                onPress={() => {
                  haptic.tapLight();
                  stopPlay();
                  try { flatRef.current?.scrollToIndex({ index: i, animated: true }); } catch {}
                  setIndex(i);
                }}
                style={{
                  width: i === index ? 14 : 8,
                  height: i === index ? 14 : 8,
                  borderRadius: 7,
                  backgroundColor: i === index ? '#fff' : 'rgba(255,255,255,0.4)',
                }}
              />
            ))}
          </ScrollView>

          {/* action bar */}
          <View className="flex-row gap-3 px-4 pt-4 pb-6">
            <Pressable
              onPress={onAdd}
              className="flex-1 bg-kibo-surface rounded-2xl p-3 border border-kibo-card items-center"
            >
              <Text className="text-kibo-text font-semibold text-xs">＋ 新增</Text>
            </Pressable>
            <Pressable
              onPress={playing ? stopPlay : startPlay}
              disabled={photos.length < 2}
              className={`flex-1 rounded-2xl p-3 border items-center ${
                photos.length < 2
                  ? 'bg-kibo-card border-kibo-card'
                  : playing
                    ? 'bg-kibo-danger border-kibo-danger'
                    : 'bg-kibo-primary border-kibo-primary'
              }`}
            >
              <Text className={`font-semibold text-xs ${
                photos.length < 2 ? 'text-kibo-mute' : playing ? 'text-white' : 'text-kibo-bg'
              }`}>
                {playing ? '■ 停止' : '▶ 播放'}
              </Text>
            </Pressable>
            <Pressable
              onPress={onDeleteCurrent}
              className="flex-1 bg-kibo-surface rounded-2xl p-3 border border-kibo-card items-center"
            >
              <Text className="text-kibo-danger font-semibold text-xs">🗑 刪除</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```powershell
cd D:\kibo; npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```powershell
cd D:\kibo; git add app/progress/index.tsx; git commit -m "v1.0.3 ui: timeline (FlatList swipe + dot row + play)"
```

---

## Task 13: Entry point — me.tsx 「📊 體態量測」+「📸 進度照」row

**Files:**
- Modify: `app/(tabs)/me.tsx` around line 947 (right after the auth section closes, just before the existing 「💌 意見回饋」/「☕ 贊助作者」row)

- [ ] **Step 1: Insert new row above the feedback/sponsor row**

Find:
```tsx
            {/* ── 第二列：💌 意見回饋 + ☕ 贊助作者 並排 ── */}
            <View className="flex-row gap-3 mb-2">
```

Insert immediately above this `{/* ── 第二列 */}` comment:

```tsx
            {/* ── 第一列：📊 體態量測 + 📸 進度照 並排 ── */}
            <View className="flex-row gap-3 mb-2">
              <Pressable
                onPress={() => { haptic.tapLight(); router.push('/body' as any); }}
                className="flex-1 bg-kibo-surface rounded-2xl p-4 border border-kibo-card items-center"
              >
                <Text className="text-2xl mb-1">📊</Text>
                <Text className="text-kibo-text font-semibold text-xs">體態量測</Text>
              </Pressable>
              <Pressable
                onPress={() => { haptic.tapLight(); router.push('/progress' as any); }}
                className="flex-1 bg-kibo-surface rounded-2xl p-4 border border-kibo-card items-center"
              >
                <Text className="text-2xl mb-1">📸</Text>
                <Text className="text-kibo-text font-semibold text-xs">進度照</Text>
              </Pressable>
            </View>
```

If `me.tsx` already has a different button leading to `/body`, leave it as is and only add the「📸 進度照」alongside (the row should still produce two cards). Do not remove existing entry points.

- [ ] **Step 2: Smoke test on device — full first-run flow**

Restart Metro:
```powershell
cd D:\kibo; $env:EXPO_OFFLINE='1'; npx expo start --lan --clear
```

On iPhone Expo Go:
1. Tap 「我」 tab
2. See new 「📊 體態量測」+「📸 進度照」row
3. Tap 「📸 進度照」 → `/progress` empty state shows
4. Tap 「拍第一張」 → camera permission prompt → grant → camera with overlay (no onion skin yet, only guide lines)
5. Take a photo → confirm screen → tap 「儲存」
6. Returns to timeline showing 1 photo
7. Tap 「+ 新增」 → angle picker → 正面 → camera now shows the previous shot at 30% opacity
8. Take another photo → save → timeline shows 2 photos
9. Tap 「▶ 播放」 → see auto cut-transition between the 2 photos

Expected: all 9 steps work; no crashes; onion skin visible from photo 2 onwards.

If iOS camera doesn't open: confirm Expo Go has camera permission in iOS Settings → Expo Go.

- [ ] **Step 3: Commit**

```powershell
cd D:\kibo; git add "app/(tabs)/me.tsx"; git commit -m "v1.0.3 ui: 我 tab — 進度照 entry alongside 體態量測"
```

---

## Task 14: Tutorials — 2 tip entries

**Files:**
- Modify: `src/lib/tutorials.ts`

- [ ] **Step 1: Add 2 entries to `TUTORIALS` record**

Append to `TUTORIALS` (before the closing `}`):

```ts
  'progress-capture-onion-skin': {
    id: 'progress-capture-onion-skin',
    title: '對齊上一張',
    body: '同角度的上一張會 30% 透明疊上，站位對齊它再按拍攝。系統會自動裁切成 3:4，動畫播放才不會跳。',
    scope: 'progress-capture',
    icon: '👻',
  },
  'progress-timeline-play': {
    id: 'progress-timeline-play',
    title: '播放體態變化',
    body: '至少 2 張同角度照片才能播放。每張顯示 0.6 秒切換，看自己累積多久變了多少。',
    scope: 'progress',
    icon: '▶',
  },
```

- [ ] **Step 2: Verify TypeScript**

```powershell
cd D:\kibo; npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```powershell
cd D:\kibo; git add src/lib/tutorials.ts; git commit -m "v1.0.3 tutorials: progress-capture-onion-skin + progress-timeline-play"
```

---

## Task 15: Final E2E manual smoke + dual-build

**Files:** none (verification + build trigger only)

- [ ] **Step 1: Run the spec's 12-case manual test plan**

On iPhone Expo Go (LAN), execute each case from `docs/superpowers/specs/2026-05-10-progress-photos-timeline-design.md` §13. Note any failures and fix before moving on.

- [ ] **Step 2: Confirm no Zustand re-render bugs**

Open progress timeline, swipe between photos, switch angles, play, delete. No "Maximum update depth exceeded" error in the Metro console. (The timeline uses `useMemo` for the filtered/sorted list per `feedback_zustand_selector.md`.)

- [ ] **Step 3: Push to origin**

```powershell
cd D:\kibo; git push origin feature/v1.0.2-libpct-eggs
```
Expected: push succeeds. iOS GitHub Actions auto-trigger.

- [ ] **Step 4: Trigger Android EAS preview build**

```powershell
cd D:\kibo; npx eas-cli build --platform android --profile preview --non-interactive --no-wait
```
Expected: build queued; URL printed.

- [ ] **Step 5: Wait for both builds + sanity test on physical Android**

When EAS Android APK is ready, install on Android device. Repeat the spec's 12-case test plan.

When iOS GH Action artifact is ready, install via SideStore or wait for next TestFlight push.

If both pass — feature is shippable to v1.0.3.

- [ ] **Step 6: Update memory MEMORY.md**

After confirming both platforms green, update `C:\Users\Administrator\.claude\projects\C--Users-Administrator\memory\project_kibo.md` with:
- Wave 3+ 候選清單去掉「進度照功能」
- 加 `progress_photos` table 到 DB tables 清單（11 → 12 張表）

---

## Self-Review

Spec coverage check (against `docs/superpowers/specs/2026-05-10-progress-photos-timeline-design.md`):

| Spec section | Implemented in task |
|---|---|
| §1 目標與差異化 | overall scope (Tasks 9-13) |
| §2 範圍框定 — 包含項 | Tasks 1-13 |
| §2 範圍框定 — 不包含項 | enforced by absence; not built |
| §3 對齊策略 A onion skin + C center crop | Task 5 (centerCrop) + Task 10 (onion skin) |
| §4 In-app stop-motion 播放 | Task 12 (FlatList scrollToIndex 600ms) |
| §5 檔案地圖 | matches Task 1-14 file list exactly |
| §6 Data model | Task 1 (Drizzle) + Task 2 (raw SQL) |
| §7 Capture flow | Tasks 9-11 (angle-picker → capture → confirm) |
| §8 Timeline UI Option 3 slider | Task 12 |
| §9 Entry point me.tsx | Task 13 |
| §10 Routes | Task 8 |
| §11 Dependencies | Task 5 (image-manipulator) + Task 6 (camera) |
| §12 Error handling | distributed across Task 10 (camera permission), Task 11 (save fail), Task 12 (delete confirm + missing photo placeholder) |
| §13 Testing plan 12 cases | Task 15 step 1 |
| §14 Out of scope | not implemented (correct) |
| §15 Migration | Task 2 (CREATE TABLE IF NOT EXISTS via SCHEMA_SQL) |
| §16 DoD | covered by Tasks 1-15 |

Placeholder scan: no TBD/TODO/"similar to" references found.

Type consistency: `ProgressAngle = 'front' \| 'side' \| 'back'` is the canonical type, used in Tasks 1, 4, 5, 7, 9, 10, 11, 12 consistently. `ProgressPhoto` referenced in Tasks 1, 4, 7, 12 with same shape.

---

**Plan complete.** Total 15 tasks, ~14 commits, estimated 1.5–2 days work depending on E2E debugging.
