import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = '@kibo/seen_tutorials';

type State = {
  seen: Set<string>;
  seenMaster: boolean;
  loaded: boolean;
  hydrate: () => Promise<void>;
  isSeen: (id: string) => boolean;
  markSeen: (id: string) => Promise<void>;
  markMasterSeen: () => Promise<void>;
  reset: (id?: string) => Promise<void>;
};

const MASTER_KEY = '@kibo/seen_master';

export const useTutorialStore = create<State>((set, get) => ({
  seen: new Set(),
  seenMaster: false,
  loaded: false,
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      const m = await AsyncStorage.getItem(MASTER_KEY);
      set({ seen: new Set(arr), seenMaster: m === '1', loaded: true });
    } catch {
      set({ seen: new Set(), seenMaster: false, loaded: true });
    }
  },
  markMasterSeen: async () => {
    set({ seenMaster: true });
    try { await AsyncStorage.setItem(MASTER_KEY, '1'); } catch {}
  },
  isSeen: (id) => get().seen.has(id),
  markSeen: async (id) => {
    const next = new Set(get().seen);
    next.add(id);
    set({ seen: next });
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify([...next]));
    } catch {}
  },
  reset: async (id) => {
    if (id) {
      const next = new Set(get().seen);
      next.delete(id);
      set({ seen: next });
      try {
        await AsyncStorage.setItem(KEY, JSON.stringify([...next]));
      } catch {}
    } else {
      set({ seen: new Set() });
      try {
        await AsyncStorage.removeItem(KEY);
      } catch {}
    }
  },
}));
