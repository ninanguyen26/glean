import { FontAwesome } from "@expo/vector-icons";
import { useEffect, type ReactNode } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { palette } from "../constants/theme";
import { getAllRegions, getAllTiers, ProgressSnapshot } from "./db";
import { TierDef } from "./items";
import { CITY_ART, ICON_MAP } from "./sprites";

/* Map as a card modal over HomeScreen — tier sections, city cards with art, endless. */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* City card with a subtle one-shot pulse on the selected card each time the
   map opens (the modal remounts fresh on every open). */
function CityCard({
  selected,
  locked,
  onPress,
  children,
}: {
  selected: boolean;
  locked: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const glow = useSharedValue(0);
  useEffect(() => {
    if (selected) {
      glow.value = withSequence(
        withTiming(1, { duration: 450 }),
        withTiming(0, { duration: 700 }),
      );
    }
  }, []);
  const pulse = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + glow.value * 0.02 }],
  }));
  return (
    <AnimatedPressable
      onPress={onPress}
      style={[styles.cityCard, selected && styles.cardSelected, pulse]}
    >
      {children}
    </AnimatedPressable>
  );
}

/* Tier section header — chapter-style: small caps kicker, tier name, stitched divider. */
function TierHeader({ tier }: { tier: TierDef }) {
  const num = tier.id.replace("tier", "");
  return (
    <View style={styles.tierHeader}>
      <Text style={styles.tierKicker}>TIER {num}</Text>
      <Text style={styles.tierName}>{tier.name}</Text>
      {/* <View style={styles.tierDivider} /> */}
    </View>
  );
}

export function MapScreen({
  progress,
  selectedCityId,
  onSelectCity,
  onEndless,
  onClose,
}: {
  progress: ProgressSnapshot;
  selectedCityId: string;
  onSelectCity: (cityId: string) => void;
  onEndless: () => void;
  onClose: () => void;
}) {
  const regions = getAllRegions();
  const tiers = getAllTiers();
  const { width: dw, height: dh } = useWindowDimensions();
  const cardWidth = Math.min(dw - 40, 430);
  const cardHeight = Math.min(dh * 0.65, 550);
  return (
    <View style={[styles.overlay, { height: dh }]}>
      <Pressable style={styles.scrimTap} onPress={onClose} />
      <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Image
              source={ICON_MAP}
              style={styles.titleIcon}
              resizeMode="contain"
            />
            <Text style={styles.title}>Modes</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
          {tiers.map((tier) => {
            const tierRegions = regions.filter((r) => r.tier === tier.id);
            if (tierRegions.length === 0) return null;
            return (
              <View key={tier.id}>
                <TierHeader tier={tier} />
                {tierRegions.map((r) => {
                  const p = progress.cities.find((c) => c.id === r.id)!;
                  const locked = !p.unlocked;
                  const selected = r.id === selectedCityId;
                  return (
                    <CityCard
                      key={r.id}
                      selected={selected}
                      locked={locked}
                      onPress={() => !locked && onSelectCity(r.id)}
                    >
                      <View style={styles.artFrame}>
                        <Image
                          source={CITY_ART[r.id]}
                          style={styles.artImage}
                          resizeMode="cover"
                        />
                        {locked ? (
                          <>
                            <View style={styles.lockTint} />
                            <View style={styles.lockBadge}>
                              <Text style={styles.lockBadgeGlyph}>🔒</Text>
                            </View>
                          </>
                        ) : (
                          selected && (
                            <View style={[styles.lockBadge, styles.checkBadge]}>
                              <FontAwesome
                                name="check"
                                size={14}
                                color={palette.bark}
                              />
                            </View>
                          )
                        )}
                      </View>
                      <View style={styles.cityCardBody}>
                        <View style={styles.cardTop}>
                          <Text
                            style={[
                              styles.cityName,
                              selected && styles.cityNameSelected,
                            ]}
                          >
                            {r.name}
                          </Text>
                          {!locked && (
                            <View style={styles.starsRow}>
                              <Text style={styles.stars}>{p.stars}</Text>
                              <FontAwesome
                                name="star"
                                size={14}
                                color={palette.gold}
                              />
                            </View>
                          )}
                        </View>
                        {locked ? (
                          <View style={styles.unlockRow}>
                            <Text style={styles.unlockText}>
                              Unlocks at {r.unlockStars}
                            </Text>
                            <FontAwesome
                              name="star"
                              size={12}
                              color={palette.gold}
                            />
                          </View>
                        ) : (
                          <Text style={styles.blurb}>{r.blurb}</Text>
                        )}
                      </View>
                    </CityCard>
                  );
                })}
              </View>
            );
          })}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>ENDLESS</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            onPress={() => progress.endlessUnlocked && onEndless()}
            style={[
              styles.cityCard,
              styles.endlessCard,
              !progress.endlessUnlocked && styles.cardLocked,
            ]}
          >
            <View style={styles.cityCardBody}>
              <View style={styles.cardTop}>
                <Text style={styles.cityName}>Endless</Text>
                <Text style={styles.stars}>
                  {progress.endlessUnlocked
                    ? `best ${progress.endlessBest}`
                    : "🔒"}
                </Text>
              </View>
              <Text style={styles.blurb}>
                {progress.endlessUnlocked
                  ? "Score attack — 3 misses and the run is over"
                  : "Finish Portland's week to unlock"}
              </Text>
            </View>
          </Pressable>
        </ScrollView>
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
    backgroundColor: palette.scrim,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
  scrimTap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    backgroundColor: palette.milk,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: palette.bark,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  titleIcon: {
    width: 28,
    height: 28,
  },
  title: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 2,
    color: palette.bark,
  },
  close: { fontSize: 20, fontWeight: "800", color: palette.fog, padding: 4 },
  scroll: { flex: 1 },
  tierHeader: {
    marginTop: 10,
    marginBottom: 12,
  },
  tierKicker: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 11,
    letterSpacing: 3,
    color: palette.fog,
  },
  tierName: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 20,
    color: palette.bark,
    marginTop: 2,
  },
  tierDivider: {
    borderBottomWidth: 2,
    borderStyle: "dashed",
    borderColor: "#E8DCC8",
    marginTop: 8,
  },
  cityCard: {
    backgroundColor: palette.milk,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: palette.oat,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  cityCardBody: {
    flex: 1,
    padding: 14,
    paddingLeft: 12,
    justifyContent: "center",
  },
  artFrame: {
    width: 76,
    height: 76,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: palette.bark,
    overflow: "hidden",
    margin: 12,
    marginRight: 0,
  },
  artImage: {
    width: "100%",
    height: "100%",
  },
  lockBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.bark,
    justifyContent: "center",
    alignItems: "center",
  },
  lockBadgeGlyph: { fontSize: 14 },
  lockTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(20,16,12,0.65)",
  },
  checkBadge: {
    backgroundColor: palette.gold,
  },
  unlockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  unlockText: {
    fontSize: 12,
    color: palette.fog,
    fontStyle: "italic",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 8,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#E8DCC8",
    borderRadius: 1,
  },
  dividerLabel: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 3,
    color: "#A89878",
  },
  cardLocked: { opacity: 0.55 },
  cardSelected: {
    borderColor: palette.gold,
    borderWidth: 3,
    shadowColor: palette.gold,
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  cityNameSelected: { color: palette.gold },
  endlessCard: {
    borderWidth: 2,
    borderColor: palette.gold,
    borderStyle: "dashed",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cityName: {
    fontFamily: "BalsamiqSans_400Regular",
    fontSize: 20,
    color: palette.bark,
  },
  stars: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 16,
    fontWeight: "800",
    color: palette.gold,
  },
  starsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  blurb: {
    fontSize: 12,
    color: palette.fog,
    marginTop: 4,
    fontStyle: "italic",
  },
});
