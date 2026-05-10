import * as Haptics from 'expo-haptics';

export type MobileImpactTone = 'light' | 'medium' | 'heavy';
export type MobileNotificationTone = 'success' | 'warning' | 'error';

export function triggerImpactHaptic(tone: MobileImpactTone): void {
  const style =
    tone === 'light'
      ? Haptics.ImpactFeedbackStyle.Light
      : tone === 'heavy'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Medium;

  void Haptics.impactAsync(style).catch(() => {
    // Ignore haptics failures on unsupported devices/simulators.
  });
}

export function triggerNotificationHaptic(tone: MobileNotificationTone): void {
  const type =
    tone === 'success'
      ? Haptics.NotificationFeedbackType.Success
      : tone === 'warning'
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Error;

  void Haptics.notificationAsync(type).catch(() => {
    // Ignore haptics failures on unsupported devices/simulators.
  });
}