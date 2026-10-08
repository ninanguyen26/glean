/* Item field-guide modal: tap an album tile to open its rulebook page.
   Discovered items show the sprite, bin, and rule lines; undiscovered
   items show a locked "???" page that reveals nothing. */
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { playCoin } from "../audio/sounds";
import { palette } from "../constants/theme";
import {
  addCash,
  claimMilestoneTier,
  getClaimedTiers,
  getSortCount,
  MILESTONE_TIERS,
  milestoneAmounts,
} from "./db";
import { tapFeedback } from "./feel";
import { ItemGlyph } from "./ItemGlyph";
import { BINS, GameItem } from "./items";
import { ICON_COIN, ICON_FUNFACT } from "./sprites";

const PREP_LINES: Record<string, string> = {
  "twist-peel":
    "PREP first: twist the cap off, peel the label off, then sort the parts.",
  "lid-sleeve":
    "PREP first: pop the lid, slide the sleeve off, then sort the parts.",
  capsule:
    "PREP first: pull the capsule off, rinse the bottle, then sort the parts.",
  twist:
    "PREP first: twist the cap off, rinse the bottle, then sort the parts.",
};

function RuleRow({ text }: { text: string }) {
  return (
    <View style={styles.ruleRow}>
      <Text style={styles.ruleDot}>•</Text>
      <Text style={styles.ruleText}>{text}</Text>
    </View>
  );
}

export function ItemDetailModal({
  item,
  seen,
  onClose,
  onClaimed,
}: {
  item: GameItem;
  seen: boolean;
  onClose: () => void;
  onClaimed?: () => void;
}) {
  const bin = BINS.find((b) => b.id === item.bin) ?? BINS[2];
  const rules: string[] = [];
  if (seen) {
    const prep = item.mechanic ? PREP_LINES[item.mechanic] : undefined;
    if (prep) {
      // complex item: the PREP line is the single instruction
      rules.push(prep);
    } else {
      if (item.needsRinse) rules.push("Rinse at the sink before sorting.");
      if (item.teaching) rules.push(item.teaching);
    }
  }
  const sorts = seen ? getSortCount(item.id) : 0;
  // milestone tracker: pins full at the first reached-but-unclaimed tier
  // until it is claimed, then falls back to live progress (or MAX).
  const [claimed, setClaimed] = useState<number[]>(() =>
    seen ? getClaimedTiers(item.id) : [],
  );
  const amounts = milestoneAmounts(item.rarity);
  const waiting = MILESTONE_TIERS.filter(
    (t) => sorts >= t && !claimed.includes(t),
  );
  const nextIdx = MILESTONE_TIERS.findIndex((t) => !claimed.includes(t));
  let trackFill = 0;
  let trackLabel = "";
  let claimAmount: number | null = null;
  if (waiting.length > 0) {
    trackFill = 1;
    trackLabel = `${waiting[0]}/${waiting[0]}`;
    claimAmount = amounts[MILESTONE_TIERS.indexOf(waiting[0])];
  } else if (nextIdx >= 0) {
    const next = MILESTONE_TIERS[nextIdx];
    trackFill = Math.min(sorts / next, 1);
    trackLabel = `${sorts}/${next}`;
  } else {
    trackFill = 1;
    trackLabel = "MAX";
  }
  // ref mirror guards against double-tap double-payouts between renders
  const claimedRef = useRef<number[]>(claimed);
  const burst = useSharedValue(0);
  const [burstKey, setBurstKey] = useState(0);
  const burstStyle = useAnimatedStyle(() => ({
    opacity: 1 - burst.value,
    transform: [
      { translateY: -60 * burst.value },
      { scale: 1 - 0.3 * burst.value },
    ],
  }));
  // fire the burst after the coin mounts (same pattern as the home badge pulse)
  useEffect(() => {
    if (burstKey === 0) return;
    burst.value = 0;
    burst.value = withTiming(1, {
      duration: 450,
      easing: Easing.out(Easing.cubic),
    });
  }, [burstKey]);
  const claim = () => {
    const waitingNow = MILESTONE_TIERS.filter(
      (t) => sorts >= t && !claimedRef.current.includes(t),
    );
    if (waitingNow.length === 0) return;
    const tier = waitingNow[0];
    const amt = amounts[MILESTONE_TIERS.indexOf(tier)];
    claimMilestoneTier(item.id, tier);
    addCash(amt);
    claimedRef.current = [...claimedRef.current, tier];
    setClaimed(claimedRef.current);
    onClaimed?.();
    try {
      tapFeedback();
      playCoin();
      setBurstKey((k) => k + 1);
    } catch {
      // cosmetic only — claim already persisted
    }
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.card}>
        <Pressable
          style={styles.close}
          hitSlop={8}
          onPress={() => {
            tapFeedback();
            onClose();
          }}
        >
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
        <View style={styles.headerRow}>
          <ItemGlyph def={item} size={96} silhouette={!seen} />
          <View style={styles.headerText}>
            <Text style={styles.name}>{seen ? item.name : "???"}</Text>
            {seen && (
              <View style={[styles.binChip, { backgroundColor: bin.color }]}>
                <Text style={styles.binChipText}>
                  → {bin.label.toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>
        {seen ? (
          <>
            {rules.map((r) => (
              <RuleRow key={r} text={r} />
            ))}
            {item.funFact && (
              <View style={styles.factBox}>
                <View style={styles.factHeader}>
                  <Image
                    source={ICON_FUNFACT}
                    style={styles.factIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.factKicker}>FUN FACT</Text>
                </View>
                <Text style={styles.factText}>{item.funFact}</Text>
              </View>
            )}
            <View style={styles.tracker}>
              <View style={styles.trackRow}>
                <View style={styles.track}>
                  <View style={[styles.trackFill, { flex: trackFill }]} />
                  <View style={{ flex: Math.max(1 - trackFill, 0) }} />
                </View>
                <Text style={styles.trackLabel}>{trackLabel}</Text>
              </View>
              {claimAmount != null && (
                <View style={styles.claimWrap}>
                  <Pressable style={styles.claim} onPress={claim}>
                    <Image
                      source={ICON_COIN}
                      style={styles.claimCoin}
                      resizeMode="contain"
                    />
                    <Text style={styles.claimLabel}>CLAIM +${claimAmount}</Text>
                  </Pressable>
                  {burstKey > 0 && (
                    <Animated.Image
                      key={burstKey}
                      source={ICON_COIN}
                      resizeMode="contain"
                      style={[styles.burstCoin, burstStyle]}
                    />
                  )}
                </View>
              )}
            </View>
          </>
        ) : (
          <Text style={styles.locked}>Keep sorting to discover this item.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.scrim,
  },
  card: {
    width: 350,
    backgroundColor: palette.parchment,
    borderColor: palette.cocoa,
    borderWidth: 3,
    borderRadius: 22,
    padding: 20,
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "95%",
    marginHorizontal: "2.5%",
    gap: 25,
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
    justifyContent: "center",
  },
  name: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 19,
    color: palette.bark,
    textAlign: "left",
    marginBottom: 8,
  },
  binChip: {
    alignSelf: "flex-start",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  binChipText: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 13,
    letterSpacing: 1.5,
    color: palette.cream,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
    marginBottom: 8,
  },
  ruleDot: {
    fontSize: 14,
    color: palette.bark,
    marginRight: 8,
    lineHeight: 20,
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    color: palette.bark,
    lineHeight: 18,
  },
  count: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.fog,
    marginTop: 8,
  },
  tracker: {
    width: "100%",
    marginTop: 10,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  track: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.faint,
    overflow: "hidden",
    flexDirection: "row",
  },
  trackFill: {
    backgroundColor: palette.sage,
  },
  trackLabel: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 12,
    color: palette.bark,
  },
  claimWrap: {
    width: "100%",
    marginTop: 10,
    alignItems: "center",
  },
  claim: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: palette.sage,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: palette.outline,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  claimCoin: {
    width: 24,
    height: 24,
  },
  burstCoin: {
    position: "absolute",
    bottom: 18,
    width: 30,
    height: 30,
  },
  claimLabel: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 14,
    letterSpacing: 1.5,
    color: palette.bark,
  },
  factBox: {
    width: "100%",
    backgroundColor: palette.butter,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  factHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  factIcon: { width: 18, height: 18 },
  factKicker: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 10,
    letterSpacing: 2,
    color: palette.fog,
  },
  factText: {
    fontSize: 13,
    lineHeight: 16,
    color: palette.bark,
  },
  locked: {
    fontSize: 14,
    color: palette.fog,
    textAlign: "center",
    marginBottom: 4,
  },
  close: {
    position: "absolute",
    top: 10,
    right: 12,
    padding: 4,
  },
  closeGlyph: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.fog,
  },
});
