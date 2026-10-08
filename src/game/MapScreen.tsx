import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { palette } from "../constants/theme";
import { C } from "../spike/effects";
import { getAllRegions, ProgressSnapshot } from "./db";
import { ICON_MAP } from "./sprites";

const PORTLAND_BG = require("../../assets/background/portland.png");

/* Map as a card modal over HomeScreen — city cards with stars, locks, endless. */

export function MapScreen({
  progress,
  onSelectCity,
  onEndless,
  onClose,
}: {
  progress: ProgressSnapshot;
  onSelectCity: (cityId: string) => void;
  onEndless: () => void;
  onClose: () => void;
}) {
  const regions = getAllRegions();
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
          {regions.map((r) => {
            const p = progress.cities.find((c) => c.id === r.id)!;
            const locked = !p.unlocked;
            return (
              <Pressable
                key={r.id}
                onPress={() => !locked && onSelectCity(r.id)}
                style={[styles.cityCard, locked && styles.cardLocked]}
              >
                {r.id === "portland" && (
                  <Image
                    source={PORTLAND_BG}
                    style={styles.regionArt}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.cityCardBody}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cityName}>{r.name}</Text>
                    <Text style={styles.stars}>
                      {locked ? "🔒" : `${p.stars} ★`}
                    </Text>
                  </View>
                  <Text style={styles.blurb}>
                    {locked ? `Unlocks at ${r.unlockStars} ★` : r.blurb}
                  </Text>
                </View>
              </Pressable>
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
    backgroundColor: "rgba(46,36,28,0.55)",
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
    backgroundColor: "#FFFDF8",
    borderRadius: 20,
    borderWidth: 3,
    borderColor: C.ink,
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
  title: { fontSize: 24, fontWeight: "900", letterSpacing: 2, color: C.ink },
  close: { fontSize: 20, fontWeight: "800", color: C.sub, padding: 4 },
  scroll: { flex: 1 },
  cityCard: {
    backgroundColor: "#FFFDF8",
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: palette.clay,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  cityCardBody: {
    padding: 18,
  },
  regionArt: {
    width: "100%",
    height: 140,
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
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 3,
    color: "#A89878",
  },
  cardLocked: { opacity: 0.55 },
  endlessCard: { borderWidth: 2, borderColor: C.gold, borderStyle: "dashed" },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cityName: { fontSize: 20, fontWeight: "800", color: C.ink },
  stars: { fontSize: 16, fontWeight: "800", color: C.gold },
  blurb: {
    fontSize: 13,
    color: C.sub,
    marginTop: 4,
    fontStyle: "italic",
  },
});
