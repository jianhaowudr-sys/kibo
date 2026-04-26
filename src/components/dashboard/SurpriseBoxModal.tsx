import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, Animated, Easing } from 'react-native';
import { useThemePalette } from '@/lib/useThemePalette';
import * as haptic from '@/lib/haptic';

type Reward = { id: string; label: string; rarity: string };

type Props = {
  visible: boolean;
  reward: Reward | null;
  onClose: () => void;
};

const RARITY_COLOR: Record<string, string> = {
  common: '#94a3b8',
  rare: '#29adff',
  epic: '#ff77a8',
};

const RARITY_LABEL: Record<string, string> = {
  common: '一般',
  rare: '稀有',
  epic: '史詩',
};

/**
 * Surprise Box 抽獎彈窗（plan v2 §4.2 Hook 2）。
 * 動畫：盒子搖晃 → 爆開 → 顯示獎品名 + 稀有度。
 */
export function SurpriseBoxModal({ visible, reward, onClose }: Props) {
  const palette = useThemePalette();
  const [stage, setStage] = useState<'shake' | 'open'>('shake');
  const shakeAnim = React.useRef(new Animated.Value(0)).current;
  const openAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !reward) return;
    setStage('shake');
    shakeAnim.setValue(0);
    openAnim.setValue(0);

    haptic.success();

    // 搖晃 1.5 秒，然後爆開
    Animated.sequence([
      Animated.loop(
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 1, duration: 80, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -1, duration: 80, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 80, easing: Easing.linear, useNativeDriver: true }),
        ]),
        { iterations: 6 },
      ),
      Animated.timing(openAnim, { toValue: 1, duration: 250, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
    ]).start(() => {
      setStage('open');
      haptic.tapMedium();
    });
  }, [visible, reward]);

  if (!visible || !reward) return null;

  const rotate = shakeAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-8deg', '0deg', '8deg'],
  });
  const scale = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.4],
  });

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Animated.View
          style={{
            transform: [{ rotate }, { scale }],
            marginBottom: 24,
          }}
        >
          <Text style={{ fontSize: 80 }}>🎁</Text>
        </Animated.View>

        {stage === 'open' && (
          <View style={{
            backgroundColor: palette.surface,
            padding: 24, borderRadius: 16,
            borderWidth: 3, borderColor: RARITY_COLOR[reward.rarity] ?? palette.text,
            alignItems: 'center', minWidth: 240,
          }}>
            <Text style={{ color: RARITY_COLOR[reward.rarity], fontWeight: '700', fontSize: 12, marginBottom: 4 }}>
              {RARITY_LABEL[reward.rarity] ?? reward.rarity.toUpperCase()}
            </Text>
            <Text style={{ color: palette.text, fontSize: 22, fontWeight: '800', marginBottom: 16, textAlign: 'center' }}>
              {reward.label}
            </Text>
            <Pressable
              onPress={() => {
                haptic.tapLight();
                onClose();
              }}
              style={{
                backgroundColor: palette.primary,
                paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12,
              }}
            >
              <Text style={{ color: palette.bg, fontWeight: '700' }}>收下</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

export default SurpriseBoxModal;
