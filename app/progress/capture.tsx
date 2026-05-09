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
          <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
          <View style={{ position: 'absolute', top: '18%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
          <View style={{ position: 'absolute', top: '28%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
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
