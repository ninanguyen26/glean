/* Shared tap haptic for primary buttons. Fire-and-forget. */
import * as Haptics from "expo-haptics";

export function tapFeedback() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // haptics unavailable — stay silent
  }
}
