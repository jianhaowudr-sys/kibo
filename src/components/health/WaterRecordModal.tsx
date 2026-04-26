import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import { WheelPicker } from '@/components/common/WheelPicker';
import * as haptic from '@/lib/haptic';

const WHEEL_VALUES = Array.from({ length: 20 }, (_, i) => (i + 1) * 50);

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * 喝水記錄 modal — 從首頁喝水卡的「📝 記錄」點擊開啟。
 * Wheel 選量 + 杯/瓶捷徑 + 記錄鍵。
 */
export function WaterRecordModal({ visible, onClose }: Props) {
  const palette = useThemePalette();
  const settings = useAppStore((s) => s.healthSettings);
  const addWater = useAppStore((s) => s.addWater);

  const initial = WHEEL_VALUES.includes(settings.water.favoriteCupMl as any)
    ? settings.water.favoriteCupMl
    : 250;
  const [picked, setPicked] = useState<number>(initial);

  const onRecord = async () => {
    haptic.success();
    await addWater(picked, { batch: false });
    onClose();
  };

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: palette.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700', flex: 1 }}>記錄水量</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={{ color: palette.mute, fontSize: 22 }}>✕</Text>
            </Pressable>
          </View>

          {/* Wheel + 杯/瓶 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Pressable
              onPress={() => { haptic.tapLight(); setPicked(settings.water.favoriteCupMl); }}
              style={{ backgroundColor: palette.card, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center' }}
            >
              <Text style={{ color: palette.mute, fontSize: 10 }}>設為</Text>
              <Text style={{ color: palette.text, fontWeight: '700', fontSize: 14 }}>杯 {settings.water.favoriteCupMl} →</Text>
            </Pressable>

            <View style={{ alignItems: 'center' }}>
              <WheelPicker
                values={WHEEL_VALUES}
                value={picked}
                onChange={setPicked}
                formatLabel={(v) => `${v}`}
                width={150}
                itemHeight={48}
                visibleCount={3}
                activeFontSize={36}
              />
              <Text style={{ color: palette.mute, fontSize: 11, marginTop: -4 }}>ml</Text>
            </View>

            <Pressable
              onPress={() => { haptic.tapLight(); setPicked(settings.water.bottleMl); }}
              style={{ backgroundColor: palette.card, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center' }}
            >
              <Text style={{ color: palette.mute, fontSize: 10 }}>設為</Text>
              <Text style={{ color: palette.text, fontWeight: '700', fontSize: 14 }}>瓶 {settings.water.bottleMl} →</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={onRecord}
            style={{
              backgroundColor: palette.primary,
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: 'center',
              shadowColor: palette.primary,
              shadowOpacity: 0.3,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 4,
            }}
          >
            <Text style={{ color: palette.bg, fontWeight: '700', fontSize: 16 }}>📝 記錄這 {picked}ml</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default WaterRecordModal;
