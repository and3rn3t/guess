export interface MobileActionGuard {
  tryEnter: () => boolean;
  leave: () => void;
  isLocked: () => boolean;
}

export function createMobileActionGuard(initiallyLocked = false): MobileActionGuard {
  let locked = initiallyLocked;

  return {
    tryEnter: () => {
      if (locked) {
        return false;
      }

      locked = true;
      return true;
    },
    leave: () => {
      locked = false;
    },
    isLocked: () => locked,
  };
}