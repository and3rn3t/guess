export type MobileRuntimeErrorSource = "global" | "network" | "app";
export type MobileRuntimeErrorSeverity = "error" | "fatal";

export interface MobileRuntimeErrorEvent {
  id: string;
  occurredAtMs: number;
  source: MobileRuntimeErrorSource;
  severity: MobileRuntimeErrorSeverity;
  message: string;
  detail?: string;
  stack?: string;
}

interface MobileRuntimeErrorInput {
  source: MobileRuntimeErrorSource;
  severity?: MobileRuntimeErrorSeverity;
  message: string;
  detail?: string;
  stack?: string;
}

interface MobileRuntimeTelemetrySummary {
  totalCount: number;
  fatalCount: number;
  networkCount: number;
  globalCount: number;
  appCount: number;
  lastOccurredAtMs: number | null;
}

const MAX_RUNTIME_ERROR_EVENTS = 50;
const runtimeErrorEvents: MobileRuntimeErrorEvent[] = [];

function normalizeMessage(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return "Unknown runtime error";
  }

  return trimmed.length > 280 ? `${trimmed.slice(0, 277)}...` : trimmed;
}

export function recordMobileRuntimeError(input: MobileRuntimeErrorInput): void {
  const event: MobileRuntimeErrorEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    occurredAtMs: Date.now(),
    source: input.source,
    severity: input.severity ?? "error",
    message: normalizeMessage(input.message),
    detail: input.detail,
    stack: input.stack,
  };

  runtimeErrorEvents.push(event);
  if (runtimeErrorEvents.length > MAX_RUNTIME_ERROR_EVENTS) {
    runtimeErrorEvents.splice(0, runtimeErrorEvents.length - MAX_RUNTIME_ERROR_EVENTS);
  }
}

export function getRecentMobileRuntimeErrors(limit = 5): MobileRuntimeErrorEvent[] {
  const safeLimit = Math.max(1, Math.min(limit, 20));
  return runtimeErrorEvents.slice(-safeLimit).reverse();
}

export function getMobileRuntimeTelemetrySummary(): MobileRuntimeTelemetrySummary {
  let fatalCount = 0;
  let networkCount = 0;
  let globalCount = 0;
  let appCount = 0;

  for (const event of runtimeErrorEvents) {
    if (event.severity === "fatal") {
      fatalCount += 1;
    }

    if (event.source === "network") {
      networkCount += 1;
    } else if (event.source === "global") {
      globalCount += 1;
    } else {
      appCount += 1;
    }
  }

  const lastEvent = runtimeErrorEvents.length > 0
    ? runtimeErrorEvents[runtimeErrorEvents.length - 1]
    : null;

  return {
    totalCount: runtimeErrorEvents.length,
    fatalCount,
    networkCount,
    globalCount,
    appCount,
    lastOccurredAtMs: lastEvent?.occurredAtMs ?? null,
  };
}

export function clearMobileRuntimeTelemetry(): void {
  runtimeErrorEvents.length = 0;
}
