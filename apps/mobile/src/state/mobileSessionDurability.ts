import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_STORAGE_KEY = '@guess/mobile/session/v1';

/**
 * Persists the active session ID to AsyncStorage so it survives
 * app termination and can be restored on cold-start.
 * Pass null to clear the stored session.
 */
export async function saveActiveSessionId(id: string | null): Promise<void> {
  if (id === null) {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  await AsyncStorage.setItem(SESSION_STORAGE_KEY, id);
}

/**
 * Reads the persisted session ID from AsyncStorage.
 * Returns null if no session is stored or if storage is unavailable.
 */
export async function loadActiveSessionId(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null;
    }

    return value;
  } catch {
    return null;
  }
}
