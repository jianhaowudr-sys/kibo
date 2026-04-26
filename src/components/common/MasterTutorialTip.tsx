import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useTutorialStore } from '@/stores/useTutorialStore';
import { useThemePalette } from '@/lib/useThemePalette';
import * as haptic from '@/lib/haptic';

/**
 * 第一次打開 App 才跳的「總覽」教學。
 * 取代原本每張卡都自動跳 tip 的轟炸式教學。
 */
export function MasterTutorialTip({ delay = 1500 }: { delay?: number }) {
  const palette = useThemePalette();
  const seenMaster = useTutorialStore((s) => s.seenMaster);
  const loaded = useTutorialStore((s) => s.loaded);
  const markMasterSeen = useTutorialStore((s) => s.markMasterSeen);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!loaded || seenMaster) return;
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [loaded, seenMaster, delay]);

  const close = async () => {
    setVisible(false);
    await markMasterSeen();
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={close}>
      <Pressable
        onPress={close}
        style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
          alignItems: 'center', justifyContent: 'center', padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: palette.surface, borderRadius: 16, padding: 24,
            maxWidth: 360, borderWidth: 1, borderColor: palette.card,
          }}
        >
          <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}>👋</Text>
          <Text style={{ color: palette.text, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>
            歡迎來到 Kibo
          </Text>
          <Text style={{ color: palette.text, fontSize: 14, lineHeight: 22, marginBottom: 8 }}>
            <Text style={{ fontWeight: '700' }}>⚙️ 自訂</Text>{'  '}各畫面右上角，可開關 / 拖曳排序顯示項目
          </Text>
          <Text style={{ color: palette.text, fontSize: 14, lineHeight: 22, marginBottom: 8 }}>
            <Text style={{ fontWeight: '700' }}>❓</Text>{'  '}各畫面右上角，看該畫面所有小技巧
          </Text>
          <Text style={{ color: palette.text, fontSize: 14, lineHeight: 22, marginBottom: 8 }}>
            <Text style={{ fontWeight: '700' }}>長按卡片</Text>{'  '}進該模組歷史
          </Text>
          <Text style={{ color: palette.text, fontSize: 14, lineHeight: 22, marginBottom: 16 }}>
            <Text style={{ fontWeight: '700' }}>右上 ⋯</Text>{'  '}該卡的詳細編輯
          </Text>
          <Pressable
            onPress={() => { haptic.tapLight(); close(); }}
            style={{ backgroundColor: palette.primary, borderRadius: 12, paddingVertical: 12 }}
          >
            <Text style={{ color: palette.bg, fontWeight: '700', textAlign: 'center' }}>開始使用 →</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

export default MasterTutorialTip;
