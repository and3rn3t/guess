import { afterEach, describe, expect, it } from 'vitest';
import {
  clearMobilePerfMetrics,
  finishMobilePerfTimer,
  getMobileReliabilitySummary,
  getMobilePerfSummary,
  incrementMobileReliabilityCounter,
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
      recordMobilePerfMetric('feedback_to_next_question', index * 10);
    }

    for (let index = 1; index <= 20; index += 1) {
      recordMobilePerfMetric('transition_start', index * 5);
    }

    for (let index = 1; index <= 20; index += 1) {
      recordMobilePerfMetric('transition_complete', index * 12);
    }

    const summary = getMobilePerfSummary();

    expect(summary.tap_to_feedback.count).toBe(20);
    expect(summary.tap_to_feedback.p95Ms).toBe(38);
    expect(summary.tap_to_feedback.meetsTarget).toBe(true);

    expect(summary.feedback_to_next_question.count).toBe(20);
    expect(summary.feedback_to_next_question.p95Ms).toBe(190);
    expect(summary.feedback_to_next_question.meetsTarget).toBe(true);

    expect(summary.transition_start.count).toBe(20);
    expect(summary.transition_start.p95Ms).toBe(95);
    expect(summary.transition_start.meetsTarget).toBe(true);

    expect(summary.transition_complete.count).toBe(20);
    expect(summary.transition_complete.p95Ms).toBe(228);
    expect(summary.transition_complete.meetsTarget).toBe(true);
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

  it('tracks reliability counters', () => {
    incrementMobileReliabilityCounter('transport_retry');
    incrementMobileReliabilityCounter('transport_retry');
    incrementMobileReliabilityCounter('transport_failure');
    incrementMobileReliabilityCounter('server_failure');
    incrementMobileReliabilityCounter('validation_failure');

    expect(getMobileReliabilitySummary()).toEqual({
      transportRetryCount: 2,
      transportFailureCount: 1,
      serverFailureCount: 1,
      validationFailureCount: 1
    });
  });
});
