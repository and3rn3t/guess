import { afterEach, describe, expect, it } from 'vitest';
import {
  clearMobilePerfMetrics,
  finishMobilePerfTimer,
  getMobilePerfSummary,
  recordMobilePerfMetric,
  startMobilePerfTimer
} from './mobilePerfMetrics';

describe('mobilePerfMetrics', () => {
  afterEach(() => {
    clearMobilePerfMetrics();
  });

  it('computes p95 and evaluates targets per metric', () => {
    for (let index = 1; index <= 20; index += 1) {
      recordMobilePerfMetric('tap_to_feedback', index * 2);
    }

    for (let index = 1; index <= 20; index += 1) {
      recordMobilePerfMetric('transition_start', index * 5);
    }

    const summary = getMobilePerfSummary();

    expect(summary.tap_to_feedback.count).toBe(20);
    expect(summary.tap_to_feedback.p95Ms).toBe(38);
    expect(summary.tap_to_feedback.meetsTarget).toBe(true);

    expect(summary.transition_start.count).toBe(20);
    expect(summary.transition_start.p95Ms).toBe(95);
    expect(summary.transition_start.meetsTarget).toBe(true);
  });

  it('ignores invalid samples', () => {
    recordMobilePerfMetric('tap_to_feedback', Number.NaN);
    recordMobilePerfMetric('tap_to_feedback', -10);

    const summary = getMobilePerfSummary();
    expect(summary.tap_to_feedback.count).toBe(0);
  });

  it('records elapsed time with timer helpers', async () => {
    const start = startMobilePerfTimer();
    await new Promise((resolve) => setTimeout(resolve, 2));
    const elapsed = finishMobilePerfTimer('tap_to_feedback', start);

    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(getMobilePerfSummary().tap_to_feedback.count).toBe(1);
  });
});
