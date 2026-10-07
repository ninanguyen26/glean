import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { playCorrect, playWrong } from "../audio/sounds";

/*
 * Shared part-sorting logic for the disassembly modals (bottle + coffee cup).
 * Tracks sorted part ids; when all 3 are in, plays the "done" beat then
 * calls onClose. The close trigger lives in an effect (not inside the
 * state updater) so a dropped update can't swallow the close.
 */
export function usePartSort(onClose: (allCorrect: boolean) => void) {
  const [sortedIds, setSortedIds] = useState<string[]>([]);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const burstId = useRef(0);
  const wrongRef = useRef(0);

  const chipSorted = (id: string, x: number, y: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playCorrect();
    const bid = ++burstId.current;
    setBursts((b) => [...b, { id: bid, x, y }]);
    setTimeout(() => setBursts((b) => b.filter((bb) => bb.id !== bid)), 750);
    setHint(null);
    setSortedIds((s) => (s.includes(id) ? s : [...s, id]));
  };

  const chipWrong = (id: string, onShake: () => void) => {
    wrongRef.current += 1;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    playWrong();
    onShake();
  };

  useEffect(() => {
    if (sortedIds.length !== 3) return;
    const t1 = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const t2 = setTimeout(() => onClose(wrongRef.current === 0), 650);
    }, 450);
    return () => clearTimeout(t1);
  }, [sortedIds]);

  return {
    sortedIds,
    bursts,
    hint,
    setHint,
    wrongRef,
    chipSorted,
    chipWrong,
  };
}
