import React, { useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';
import { useThemePalette } from '@/lib/useThemePalette';
import * as healthRepo from '@/db/health_repo';
import { format } from 'date-fns';

const CATEGORY_ICON: Record<string, string> = {
  greeting: '👋',
  concern: '🥺',
  celebration: '🎉',
  reminder: '💡',
};

const CATEGORY_LABEL: Record<string, string> = {
  greeting: '問候',
  concern: '關心',
  celebration: '慶祝',
  reminder: '提醒',
};

export default function PetMessagesHistory() {
  const palette = useThemePalette();
  const router = useRouter();
  const messages = useAppStore((s) => s.petMessages);
  const refreshHealth = useAppStore((s) => s.refreshHealth);
  const user = useAppStore((s) => s.user);

  useEffect(() => {
    if (user) healthRepo.markAllPetMessagesRead(user.id).then(() => refreshHealth());
  }, [user]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: palette.mute, fontSize: 12, marginBottom: 12 }}>
        共 {messages.length} 則訊息
      </Text>
      {messages.map((m) => {
        const ts = m.generatedAt instanceof Date ? m.generatedAt : new Date(m.generatedAt);
        return (
          <View
            key={m.id}
            style={{
              flexDirection: 'row', alignItems: 'flex-start',
              backgroundColor: palette.surface, padding: 12,
              borderRadius: 12, marginBottom: 8,
              borderWidth: 1, borderColor: palette.card,
            }}
          >
            <Text style={{ fontSize: 24, marginRight: 12 }}>{CATEGORY_ICON[m.category] ?? '🐣'}</Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ color: palette.mute, fontSize: 11 }}>
                  {format(ts, 'M/d HH:mm')} · {CATEGORY_LABEL[m.category] ?? m.category}
                </Text>
              </View>
              <Text style={{ color: palette.text, fontSize: 14, lineHeight: 20 }}>
                {m.text}
              </Text>
            </View>
          </View>
        );
      })}
      {messages.length === 0 && (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>🐣</Text>
          <Text style={{ color: palette.text, fontWeight: '700' }}>還沒有訊息</Text>
          <Text style={{ color: palette.mute, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
            繼續記錄，寵物會根據你的活動每天送訊息
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
