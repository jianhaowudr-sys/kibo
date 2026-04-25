import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_OPENAI = '@kibo/openai_api_key';

export async function getOpenAIKey(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY_OPENAI);
  } catch {
    return null;
  }
}

export async function setOpenAIKey(key: string): Promise<void> {
  if (!key) {
    await AsyncStorage.removeItem(KEY_OPENAI);
  } else {
    await AsyncStorage.setItem(KEY_OPENAI, key);
  }
}

export async function hasOpenAIKey(): Promise<boolean> {
  const k = await getOpenAIKey();
  return !!(k && k.trim().length > 10);
}
