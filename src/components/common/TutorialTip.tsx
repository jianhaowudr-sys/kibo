import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useTutorialStore } from '@/stores/useTutorialStore';
import { TUTORIALS, tutorialsForScope, type Tutorial } from '@/lib/tutorials';
import { useThemePalette } from '@/lib/useThemePalette';
import * as haptic from '@/lib/haptic';

type Props = {
  /** 教學 ID（對應 TUTORIALS 的 key） */
  id: string;
  /** 出現延遲（毫秒），預設 1000ms 避免畫面剛 mount 就跳 */
  delay?: number;
  /** 強制顯示（即使已 seen），用於 ❓ 重看 */
  force?: boolean;
  /** 關閉回呼 */
  onClose?: () => void;
};

/**
 * 教學提示。第一次符合條件就跳，之後不再跳。
 * 通常掛在含特殊操作的畫面，靠 useEffect 自動觸發。
 */
export function TutorialTip({ id, delay = 1000, force = false, onClose }: Props) {
  const palette = useThemePalette();
  const isSeen = useTutorialStore((s) => s.isSeen);
  const markSeen = useTutorialStore((s) => s.markSeen);
  const loaded = useTutorialStore((s) => s.loaded);
  const [visible, setVisible] = useState(false);

  const t = TUTORIALS[id];

  useEffect(() => {
    if (!loaded) return;
    if (!t) return;
    if (!force && isSeen(id)) return;
    const tm = setTimeout(() => {
      setVisible(true);
      // 5 秒無互動自動關 + 標記 seen
    }, delay);
    return () => clearTimeout(tm);
  }, [id, delay, force, loaded, t, isSeen]);

  // 5 秒倒數自動關閉
  useEffect(() => {
    if (!visible) return;
    const tm = setTimeout(() => {
      handleClose();
    }, 5000);
    return () => clearTimeout(tm);
  }, [visible]);

  const handleClose = async () => {
    setVisible(false);
    if (!force) await markSeen(id);
    onClose?.();
  };

  if (!t || !visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={handleClose}>
      <Pressable
        onPress={handleClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: palette.surface,
            borderRadius: 16,
            padding: 20,
            maxWidth: 320,
            borderWidth: 1,
            borderColor: palette.card,
          }}
        >
          {t.icon && <Text style={{ fontSize: 36, textAlign: 'center', marginBottom: 8 }}>{t.icon}</Text>}
          <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
            {t.title}
          </Text>
          <Text style={{ color: palette.mute, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>{t.body}</Text>
          <Pressable
            onPress={() => {
              haptic.tapLight();
              handleClose();
            }}
            style={{
              backgroundColor: palette.primary,
              borderRadius: 12,
              paddingVertical: 10,
              marginTop: 16,
            }}
          >
            <Text style={{ color: palette.bg, fontWeight: '600', textAlign: 'center' }}>我知道了</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

export default TutorialTip;

/** 取某 scope 下所有 tip 用於 ❓ icon 重看 */
type HelpIconProps = {
  scope: string;
};

export function HelpIcon({ scope }: HelpIconProps) {
  const palette = useThemePalette();
  const reset = useTutorialStore((s) => s.reset);
  const [showList, setShowList] = useState(false);
  const [forceShow, setForceShow] = useState<string | null>(null);
  const tips = tutorialsForScope(scope);

  if (tips.length === 0) return null;

  return (
    <>
      <Pressable
        onPress={() => {
          haptic.tapLight();
          setShowList(true);
        }}
        hitSlop={8}
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.card,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: '700', fontSize: 14 }}>?</Text>
      </Pressable>

      <Modal transparent animationType="fade" visible={showList} onRequestClose={() => setShowList(false)}>
        <Pressable
          onPress={() => setShowList(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: palette.surface,
              borderRadius: 16,
              padding: 16,
              maxWidth: 360,
              width: '100%',
              borderWidth: 1,
              borderColor: palette.card,
            }}
          >
            <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
              這個畫面的小技巧
            </Text>
            {tips.map((t) => (
              <Pressable
                key={t.id}
                onPress={async () => {
                  haptic.tapLight();
                  await reset(t.id);
                  setShowList(false);
                  setTimeout(() => setForceShow(t.id), 200);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: palette.card,
                }}
              >
                {t.icon && <Text style={{ fontSize: 24, marginRight: 12 }}>{t.icon}</Text>}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontWeight: '600', fontSize: 14 }}>{t.title}</Text>
                  <Text style={{ color: palette.mute, fontSize: 12, marginTop: 2 }}>{t.body}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {forceShow && <TutorialTip id={forceShow} delay={0} force onClose={() => setForceShow(null)} />}
    </>
  );
}
