import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export async function lightTap(): Promise<void> {
  if (!isNative) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // non-critical
  }
}

export async function mediumTap(): Promise<void> {
  if (!isNative) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // non-critical
  }
}

export async function heavyTap(): Promise<void> {
  if (!isNative) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    // non-critical
  }
}

export async function successNotification(): Promise<void> {
  if (!isNative) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // non-critical
  }
}
