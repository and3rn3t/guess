import { describe, expect, it } from "vitest";
import { createMobileActionGuard } from "./mobileActionGuard";

describe("mobileActionGuard", () => {
  it("allows only one active entry until leave", () => {
    const guard = createMobileActionGuard();

    expect(guard.isLocked()).toBe(false);
    expect(guard.tryEnter()).toBe(true);
    expect(guard.isLocked()).toBe(true);
    expect(guard.tryEnter()).toBe(false);

    guard.leave();
    expect(guard.isLocked()).toBe(false);
    expect(guard.tryEnter()).toBe(true);
  });

  it("can start in a locked state", () => {
    const guard = createMobileActionGuard(true);

    expect(guard.isLocked()).toBe(true);
    expect(guard.tryEnter()).toBe(false);

    guard.leave();
    expect(guard.tryEnter()).toBe(true);
  });
});