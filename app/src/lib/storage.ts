// Token storage: SecureStore on phones, localStorage on web (SecureStore has no web support).
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'sai.token';

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}

export async function setToken(token: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (token) globalThis.localStorage?.setItem(KEY, token);
    else globalThis.localStorage?.removeItem(KEY);
    return;
  }
  if (token) await SecureStore.setItemAsync(KEY, token);
  else await SecureStore.deleteItemAsync(KEY);
}
