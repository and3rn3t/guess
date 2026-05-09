import AsyncStorage from '@react-native-async-storage/async-storage';

export type MobileQueuedActionKind = 'result' | 'feedback';

export interface MobileQueuedResultAction {
  id: string;
  kind: 'result';
  sessionId: string;
  correct: boolean;
  queuedAt: number;
  attempts: number;
}

export interface MobileQueuedFeedbackAction {
  id: string;
  kind: 'feedback';
  sessionId: string;
  rating: number;
  feedbackText: string;
  queuedAt: number;
  attempts: number;
}

export type MobileQueuedAction = MobileQueuedResultAction | MobileQueuedFeedbackAction;

const STORAGE_KEY = '@guess/mobile-offline-actions-v1';

let cachedActions: MobileQueuedAction[] | null = null;
let loadPromise: Promise<void> | null = null;
const countListeners = new Set<(count: number) => void>();

function createActionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function emitCount(): void {
  const count = cachedActions?.length ?? 0;
  for (const listener of countListeners) {
    listener(count);
  }
}

async function readStoredActions(): Promise<MobileQueuedAction[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is MobileQueuedAction => {
      return (
        typeof entry === 'object' &&
        entry !== null &&
        'id' in entry &&
        'kind' in entry &&
        typeof (entry as { id?: unknown }).id === 'string' &&
        ((entry as { kind?: unknown }).kind === 'result' || (entry as { kind?: unknown }).kind === 'feedback')
      );
    });
  } catch {
    return [];
  }
}

async function ensureLoaded(): Promise<void> {
  if (cachedActions !== null) {
    return;
  }

  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = (async () => {
    cachedActions = await readStoredActions();
    emitCount();
  })();

  try {
    await loadPromise;
  } finally {
    loadPromise = null;
  }
}

async function persistActions(actions: MobileQueuedAction[]): Promise<void> {
  cachedActions = actions;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  emitCount();
}

export function getMobileQueuedActionCountSync(): number {
  return cachedActions?.length ?? 0;
}

export async function getMobileQueuedActionCount(): Promise<number> {
  await ensureLoaded();
  return cachedActions?.length ?? 0;
}

export function onMobileQueuedActionCountChange(listener: (count: number) => void): () => void {
  countListeners.add(listener);
  return () => {
    countListeners.delete(listener);
  };
}

export async function enqueueMobileQueuedResultAction(input: {
  sessionId: string;
  correct: boolean;
}): Promise<number> {
  await ensureLoaded();
  const nextAction: MobileQueuedResultAction = {
    id: createActionId(),
    kind: 'result',
    sessionId: input.sessionId,
    correct: input.correct,
    queuedAt: Date.now(),
    attempts: 0
  };

  const nextActions = [...(cachedActions ?? []), nextAction];
  await persistActions(nextActions);
  return nextActions.length;
}

export async function enqueueMobileQueuedFeedbackAction(input: {
  sessionId: string;
  rating: number;
  feedbackText: string;
}): Promise<number> {
  await ensureLoaded();
  const nextAction: MobileQueuedFeedbackAction = {
    id: createActionId(),
    kind: 'feedback',
    sessionId: input.sessionId,
    rating: input.rating,
    feedbackText: input.feedbackText,
    queuedAt: Date.now(),
    attempts: 0
  };

  const nextActions = [...(cachedActions ?? []), nextAction];
  await persistActions(nextActions);
  return nextActions.length;
}

export async function replaceMobileQueuedActions(actions: MobileQueuedAction[]): Promise<void> {
  await ensureLoaded();
  await persistActions(actions);
}

export async function drainMobileQueuedActions(): Promise<MobileQueuedAction[]> {
  await ensureLoaded();
  const currentActions = [...(cachedActions ?? [])];
  await persistActions([]);
  return currentActions;
}
