/**
 * 照片永久化儲存：把拍出來的 file:// (cache) 路徑複製到 documentDirectory，
 * DB 存 relative path（"photos/meals/123_xxx.jpg"），讓 sandbox 路徑變動時仍能 resolve。
 *
 * v1.0.2：純 docs path（不上雲端），跨裝置仍會壞，留待 v1.0.3 加 Supabase Storage。
 */
import * as FileSystem from 'expo-file-system/legacy';

const DOC_DIR = FileSystem.documentDirectory ?? '';
const PHOTOS_ROOT = `${DOC_DIR}photos/`;

export type PhotoTable = 'meals' | 'body' | 'food_library';

async function ensureDir(dir: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch {
    // ignore
  }
}

/**
 * 把 srcUri（拍照/選圖回傳的 file://cache/... 路徑）複製到 documentDirectory，
 * 回傳要寫入 DB 的相對路徑 "photos/{table}/{filename}.jpg"。
 *
 * 失敗時直接回傳原 srcUri（讓資料還是能存進 DB，只是後續可能讀不到）。
 */
export async function savePhotoToDocs(
  srcUri: string | null | undefined,
  table: PhotoTable,
): Promise<string | null> {
  if (!srcUri) return null;
  if (srcUri.startsWith('photos/')) return srcUri; // 已經是 relative path

  try {
    const tableDir = `${PHOTOS_ROOT}${table}/`;
    await ensureDir(PHOTOS_ROOT);
    await ensureDir(tableDir);

    const ts = Date.now();
    const rand = Math.floor(Math.random() * 1e6).toString(36);
    const ext = srcUri.split('.').pop()?.toLowerCase().split('?')[0] || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) ? ext : 'jpg';
    const filename = `${ts}_${rand}.${safeExt}`;
    const destAbs = `${tableDir}${filename}`;

    await FileSystem.copyAsync({ from: srcUri, to: destAbs });

    return `photos/${table}/${filename}`;
  } catch (e) {
    console.warn('[photo_storage] savePhotoToDocs failed', e);
    return srcUri; // fallback：保留原 URI
  }
}

/**
 * 把 DB 存的 photoUri 解析成可顯示的 file:// 路徑。
 *
 * - "photos/..." → 動態組成 documentDirectory + relative
 * - "file://..." → 直接回傳（舊版本資料）
 * - 其他 → 直接回傳當 URI 用
 *
 * 注意：此函式不檢查檔案是否真的存在（要做 fallback 顯示用 fileExists）
 */
export function resolvePhotoUri(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (stored.startsWith('photos/')) return `${DOC_DIR}${stored}`;
  return stored;
}

/**
 * 檢查照片在不在（用於決定是否顯示 placeholder）。
 */
export async function photoExists(stored: string | null | undefined): Promise<boolean> {
  const uri = resolvePhotoUri(stored);
  if (!uri) return false;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

/**
 * 刪除照片檔（用於 deleteMeal / deleteBody 時清理）。
 */
export async function deletePhotoFile(stored: string | null | undefined): Promise<void> {
  if (!stored || !stored.startsWith('photos/')) return;
  try {
    const abs = `${DOC_DIR}${stored}`;
    await FileSystem.deleteAsync(abs, { idempotent: true });
  } catch {
    // ignore
  }
}
