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
