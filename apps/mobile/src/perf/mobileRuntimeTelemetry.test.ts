import {
  clearMobileRuntimeTelemetry,
  getMobileRuntimeTelemetrySummary,
  getRecentMobileRuntimeErrors,
  recordMobileRuntimeError,
} from "./mobileRuntimeTelemetry";
import { beforeEach, describe, expect, it } from "vitest";

describe("mobileRuntimeTelemetry", () => {
  beforeEach(() => {
    clearMobileRuntimeTelemetry();
  });

  it("records events and computes source/severity summary", () => {
    recordMobileRuntimeError({ source: "network", message: "timeout" });
    recordMobileRuntimeError({ source: "global", message: "fatal crash", severity: "fatal" });
    recordMobileRuntimeError({ source: "app", message: "state mismatch" });

    const summary = getMobileRuntimeTelemetrySummary();
    expect(summary.totalCount).toBe(3);
    expect(summary.fatalCount).toBe(1);
    expect(summary.networkCount).toBe(1);
    expect(summary.globalCount).toBe(1);
    expect(summary.appCount).toBe(1);
    expect(summary.lastOccurredAtMs).not.toBeNull();
  });

  it("returns most recent events first", () => {
    recordMobileRuntimeError({ source: "app", message: "first" });
    recordMobileRuntimeError({ source: "app", message: "second" });

    const recent = getRecentMobileRuntimeErrors(2);
    expect(recent).toHaveLength(2);
    expect(recent[0]?.message).toBe("second");
    expect(recent[1]?.message).toBe("first");
  });

  it("caps storage to the latest 50 events", () => {
    for (let index = 0; index < 55; index += 1) {
      recordMobileRuntimeError({
        source: "network",
        message: `error-${index}`,
      });
    }

    const summary = getMobileRuntimeTelemetrySummary();
    expect(summary.totalCount).toBe(50);

    const recent = getRecentMobileRuntimeErrors(20);
    expect(recent[0]?.message).toBe("error-54");
  });
});
