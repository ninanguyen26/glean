/* Shared tap haptic for primary buttons. Fire-and-forget. */
import * as Haptics from "expo-haptics";

let hapticsMuted = false;

export function setHapticsMuted(m: boolean) {
  hapticsMuted = m;
}
export function isHapticsMuted() {
  return hapticsMuted;
}

export function tapFeedback() {
  if (hapticsMuted) return;
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // haptics unavailable — stay silent
  }
}
