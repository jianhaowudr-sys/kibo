import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import * as healthRepo from '@/db/health_repo';
import * as haptic from '@/lib/haptic';
import { format } from 'date-fns';

const CATEGORY_ICON: Record<string, string> = {
  greeting: '👋',
  concern: '🥺',
  celebration: '🎉',
  reminder: '💡',
};

export function PetMessageCard() {
  const palette = useThemePalette();
  const messages = useAppStore((s) => s.petMessages);
  const refreshHealth = useAppStore((s) => s.refreshHealth);
  const pets = useAppStore((s) => s.pets);
  const user = useAppStore((s) => s.user);

  const latest = messages[0];
  const unreadCount = useMemo(() => messages.filter((m) => !m.read).length, [messages]);
  const petName = pets[0]?.name ?? '小傢伙';

  const markRead = async () => {
    if (!user) return;
    haptic.tapLight();
    await healthRepo.markAllPetMessagesRead(user.id);
    await refreshHealth();
  };

  if (!latest) {
    return (
      <View style={{
        backgroundColor: palette.surface, padding: 14, borderRadius: 16,
        borderWidth: 1, borderColor: palette.card, marginBottom: 12,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 28, marginRight: 12 }}>🐣</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.text, fontWeight: '700' }}>{petName}</Text>
            <Text style={{ color: palette.mute, fontSize: 12 }}>還沒收到訊息，再活動一下吧</Text>
          </View>
        </View>
      </View>
    );
  }

  const ts = latest.generatedAt instanceof Date ? latest.generatedAt : new Date(latest.generatedAt);
  return (
    <Pressable
      onPress={markRead}
      style={{
        backgroundColor: palette.surface, padding: 14, borderRadius: 16,
        borderWidth: 1, borderColor: palette.card, marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Text style={{ fontSize: 28, marginRight: 12 }}>🐣</Text>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ color: palette.text, fontWeight: '700' }}>{petName}</Text>
            <Text style={{ color: palette.mute, fontSize: 11, marginLeft: 8 }}>
              {format(ts, 'M/d HH:mm')}
            </Text>
            {unreadCount > 0 && (
              <View style={{
                marginLeft: 'auto',
                backgroundColor: palette.danger,
                paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
              }}>
                <Text style={{ color: palette.bg, fontSize: 11, fontWeight: '700' }}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <Text style={{ color: palette.text, fontSize: 13, lineHeight: 19 }}>
            {CATEGORY_ICON[latest.category] ?? ''} {latest.text}
          </Text>
          <Text style={{ color: palette.mute, fontSize: 10, marginTop: 6 }}>點一下標為已讀</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default PetMessageCard;
