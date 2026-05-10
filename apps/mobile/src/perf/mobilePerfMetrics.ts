export type MobilePerfMetricName = 'tap_to_feedback' | 'transition_start';

interface MobilePerfTarget {
  readonly thresholdMs: number;
}

interface MobilePerfSummary {
  readonly count: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly thresholdMs: number;
  readonly meetsTarget: boolean;
}

const METRIC_TARGETS: Readonly<Record<MobilePerfMetricName, MobilePerfTarget>> = {
  tap_to_feedback: { thresholdMs: 100 },
  transition_start: { thresholdMs: 150 }
};

const metricSamples: Record<MobilePerfMetricName, number[]> = {
  tap_to_feedback: [],
  transition_start: []
};

function getNowMs(): number {
  if (typeof globalThis.performance?.now === 'function') {
    return globalThis.performance.now();
  }

  return Date.now();
}

function toPercentile(samples: readonly number[], percentile: number): number {
  if (samples.length === 0) {
    return 0;
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(percentile * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function sanitizeDuration(durationMs: number): number | null {
  if (!Number.isFinite(durationMs)) {
    return null;
  }

  if (durationMs < 0) {
    return null;
  }

  return durationMs;
}

export function startMobilePerfTimer(): number {
  return getNowMs();
}

export function recordMobilePerfMetric(metricName: MobilePerfMetricName, durationMs: number): void {
  const sample = sanitizeDuration(durationMs);
  if (sample === null) {
    return;
  }

  metricSamples[metricName].push(sample);
}

export function finishMobilePerfTimer(metricName: MobilePerfMetricName, startMs: number): number {
  const elapsedMs = getNowMs() - startMs;
  recordMobilePerfMetric(metricName, elapsedMs);
  return elapsedMs;
}

export function getMobilePerfSummary(): Readonly<Record<MobilePerfMetricName, MobilePerfSummary>> {
  return {
    tap_to_feedback: summarizeMetric('tap_to_feedback'),
    transition_start: summarizeMetric('transition_start')
  };
}

function summarizeMetric(metricName: MobilePerfMetricName): MobilePerfSummary {
  const samples = metricSamples[metricName];
  const target = METRIC_TARGETS[metricName];
  const p50Ms = toPercentile(samples, 0.5);
  const p95Ms = toPercentile(samples, 0.95);
  const minMs = samples.length === 0 ? 0 : Math.min(...samples);
  const maxMs = samples.length === 0 ? 0 : Math.max(...samples);

  return {
    count: samples.length,
    minMs,
    maxMs,
    p50Ms,
    p95Ms,
    thresholdMs: target.thresholdMs,
    meetsTarget: samples.length === 0 ? true : p95Ms <= target.thresholdMs
  };
}

export function clearMobilePerfMetrics(): void {
  metricSamples.tap_to_feedback.length = 0;
  metricSamples.transition_start.length = 0;
}
