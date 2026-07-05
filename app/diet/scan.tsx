import { View, Text, Pressable, Alert, Linking } from 'react-native';
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as haptic from '@/lib/haptic';
import { useAppStore } from '@/stores/useAppStore';
import { lookupBarcode } from '@/lib/food_lookup';
import { isValidBarcode } from '@/lib/food_lookup_core';

const NOTICE_KEY = '@kibo/barcode_notice_seen';

export default function BarcodeScan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const setPendingBarcodeResult = useAppStore((s) => s.setPendingBarcodeResult);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const handledRef = useRef(false);

  const onScanned = async (res: BarcodeScanningResult) => {
    if (handledRef.current) return;
    const code = (res?.data || '').trim();
    if (!isValidBarcode(code)) return; // 非有效條碼，繼續掃
    handledRef.current = true;
    setBusy(true);
    haptic.tapMedium();
    try {
      const seen = await AsyncStorage.getItem(NOTICE_KEY);
      if (seen !== '1') {
        await new Promise<void>((resolve) => {
          Alert.alert(
            '關於條碼查詢',
            '查不到時會把「條碼數字」傳到 Open Food Facts 開放資料庫（不含照片、不含帳號）。可在「我 → 健康設定」關閉聯網查詢。',
            [{ text: '知道了', onPress: () => resolve() }],
          );
        });
        await AsyncStorage.setItem(NOTICE_KEY, '1');
      }
      if (!user) { router.back(); return; }
      const result = await lookupBarcode(user.id, code);
      setPendingBarcodeResult(result);
      haptic.success();
      router.back();
    } catch (e: any) {
      haptic.error();
      Alert.alert('查詢失敗', e?.message ?? String(e));
      handledRef.current = false;
      setBusy(false);
    }
  };

  if (!permission) return <View className="flex-1 bg-black" />;
  if (!permission.granted) {
    return (
      <View className="flex-1 bg-kibo-bg items-center justify-center p-6">
        <Text className="text-kibo-text text-base font-bold mb-2">需要相機權限</Text>
        <Text className="text-kibo-mute text-xs text-center mb-6">
          掃描條碼需要使用相機。授權後即可掃描，不會上傳照片。
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

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={busy ? undefined : onScanned}
      >
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 260, height: 150, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', borderRadius: 12 }} />
        </View>

        <View style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0 }} className="px-4">
          <View className="flex-row items-center justify-between">
            <Pressable onPress={() => { haptic.tapLight(); router.back(); }} className="bg-black/50 rounded-full px-4 py-2">
              <Text className="text-white text-base">✕</Text>
            </Pressable>
            <View className="bg-black/50 rounded-full px-4 py-2">
              <Text className="text-white font-bold text-sm">掃描條碼</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>
        </View>

        <View style={{ position: 'absolute', bottom: insets.bottom + 32, left: 0, right: 0, alignItems: 'center' }}>
          <View className="bg-black/60 rounded-2xl px-4 py-2">
            <Text className="text-white text-xs">{busy ? '查詢中…' : '把條碼對準框內'}</Text>
          </View>
        </View>
      </CameraView>
    </View>
  );
}
