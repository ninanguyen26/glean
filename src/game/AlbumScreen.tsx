import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { palette } from "../constants/theme";
import {
  getActiveSeason,
  getAllRegions,
  getAllSeasons,
  getCityItems,
  getSeenItemIds,
  getUniversalItems,
  SeasonDef,
} from "./db";
import { ItemGlyph } from "./ItemGlyph";
import { GameItem } from "./items";

/* Album as a modal card: dimmed backdrop, cream card, COMMON/SEASONAL/CITIES
   tabs, 3-column tile grid. COMMON = universal items; SEASONAL = seasonal
   items (active season first); CITIES = city items. Filter chips in the
   SEASONAL/CITIES tabs jump to one group. Unseen items render as silhouettes.
   Rendered as an overlay by GameRoot. */

const TABS = [
  { id: "common", label: "COMMON", color: palette.leaf },
  { id: "seasonal", label: "SEASONAL", color: palette.leaf },
  { id: "cities", label: "CITIES", color: palette.leaf },
] as const;

const RARITY_COLOR: Record<string, string> = {
  common: palette.fog,
  uncommon: palette.river,
  rare: palette.gold,
};

interface Section {
  title: string;
  kind: "common" | "seasonal" | "city";
  group: string;
  items: GameItem[];
}

function tileLabel(
  it: GameItem,
  kind: Section["kind"],
): { text: string; color: string } | null {
  if (kind === "seasonal" && it.rarity) {
    return {
      text: it.rarity.toUpperCase(),
      color: RARITY_COLOR[it.rarity] ?? palette.fog,
    };
  }
  if (kind === "city" && it.signature) {
    return { text: "SIGNATURE", color: palette.clay };
  }
  return null;
}

function Tile({
  it,
  kind,
  seen,
}: {
  it: GameItem;
  kind: Section["kind"];
  seen: Set<string>;
}) {
  const isSeen = seen.has(it.id);
  const label = tileLabel(it, kind);
  return (
    <View style={styles.tile}>
      <Text style={[styles.rarity, { color: label?.color ?? palette.fog }]}>
        {label?.text ?? " "}
      </Text>
      <ItemGlyph def={it} size={48} silhouette={!isSeen} />
      <Text style={styles.name} numberOfLines={2}>
        {isSeen ? it.name : "???"}
      </Text>
    </View>
  );
}

export function AlbumScreen({ onBack }: { onBack: () => void }) {
  const { width: dw, height: dh } = useWindowDimensions();
  const [tabId, setTabId] = useState<"common" | "seasonal" | "cities">(
    "seasonal",
  );
  const [chip, setChip] = useState<string>("all");
  const [seen, setSeen] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      setSeen(new Set(getSeenItemIds()));
    } catch {
      // unseen until the DB is reachable
    }
  }, []);

  const activeSeason = getActiveSeason();
  const seasons = getAllSeasons();
  const seasonItems = (s: SeasonDef): GameItem[] =>
    s.items.map(
      (it) => ({ ...it, region: "seasonal", season: s.id }) as GameItem,
    );

  let sections: Section[];
  let chips: { id: string; label: string }[];
  if (tabId === "common") {
    sections = [
      {
        title: "",
        kind: "common",
        group: "common",
        items: getUniversalItems(),
      },
    ];
    chips = [];
  } else if (tabId === "seasonal") {
    const ordered = [
      ...(activeSeason ? [activeSeason] : []),
      ...seasons.filter((s) => s.id !== activeSeason?.id),
    ];
    sections = ordered.map((s) => ({
      title: `${s.name.toUpperCase()}`,
      kind: "seasonal" as const,
      group: s.id,
      items: seasonItems(s),
    }));
    chips = [
      { id: "all", label: "ALL" },
      ...ordered.map((s) => ({ id: s.id, label: s.name.toUpperCase() })),
    ];
  } else {
    const regions = getAllRegions();
    sections = regions.map((r) => ({
      title: r.name.toUpperCase(),
      kind: "city" as const,
      group: r.id,
      items: getCityItems(r.id),
    }));
    chips = [
      { id: "all", label: "ALL" },
      ...regions.map((r) => ({ id: r.id, label: r.name.toUpperCase() })),
    ];
  }
  const visible =
    chip === "all" ? sections : sections.filter((s) => s.group === chip);
  const total = visible.reduce((a, s) => a + s.items.length, 0);
  const found = visible.reduce(
    (a, s) => a + s.items.filter((i) => seen.has(i.id)).length,
    0,
  );
  const cardWidth = Math.min(dw - 40, 430);

  return (
    <View style={styles.overlay}>
      <View style={[styles.topRow, { width: cardWidth }]}>
        <View style={styles.tabs}>
          {TABS.map((t, i) => {
            const active = t.id === tabId;
            return (
              <Pressable
                key={t.id}
                onPress={() => {
                  setTabId(t.id);
                  setChip("all");
                }}
                style={[
                  styles.tab,
                  {
                    marginLeft: i > 0 ? -3 : 0,
                    borderTopLeftRadius: 14,
                    borderTopRightRadius: 14,
                    borderBottomWidth: active ? 0 : 3,
                    backgroundColor: active ? t.color : palette.milk,
                    zIndex: active ? 1 : 0,
                  },
                ]}
              >
                <Text style={styles.tabText}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={[
            styles.tab,
            {
              flex: 0,
              width: 52,
              marginLeft: -3,
              borderTopLeftRadius: 14,
              borderTopRightRadius: 14,
              backgroundColor: palette.clay,
              paddingVertical: 6,
            },
          ]}
        >
          <Text
            style={[styles.tabText, { fontSize: 20, color: palette.cream }]}
          >
            ✕
          </Text>
        </Pressable>
      </View>
      <View style={[styles.card, { width: cardWidth, height: dh * 0.58 }]}>
        {chips.length > 0 && (
          <View style={styles.chips}>
            {chips.map((c) => {
              const selected = c.id === chip;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setChip(c.id)}
                  style={[
                    styles.chip,
                    selected ? styles.chipActive : styles.chipInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: selected ? palette.milk : palette.bark },
                    ]}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <ScrollView
          style={styles.gridScroll}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        >
          {visible.map((sec) => (
            <React.Fragment key={sec.group}>
              {chip === "all" && sec.title ? (
                <Text style={styles.sectionHeader}>{sec.title}</Text>
              ) : null}
              {sec.items.map((it) => (
                <Tile key={it.id} it={it} kind={sec.kind} seen={seen} />
              ))}
            </React.Fragment>
          ))}
        </ScrollView>
        <Text style={styles.count}>
          {found}/{total} found
        </Text>
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
    backgroundColor: palette.scrim,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: palette.parchment,
    borderWidth: 3,
    borderTopWidth: 0,
    borderColor: palette.cocoa,
    borderRadius: 22,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titlePill: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  title: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 24,
    color: palette.outline,
    textShadowColor: palette.milk,
    textShadowOffset: { width: 1.5, height: 1.5 },
    textShadowRadius: 0,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 0,
    zIndex: 1,
  },
  tabs: {
    flex: 1,
    flexDirection: "row",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 3,
    borderColor: palette.cocoa,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 13,
    letterSpacing: 0.5,
    color: palette.bark,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: palette.bark,
    borderColor: palette.bark,
  },
  chipInactive: {
    backgroundColor: "transparent",
    borderColor: palette.faint,
  },
  chipText: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  count: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: palette.fog,
    marginTop: 10,
  },
  gridScroll: { flex: 1 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  sectionHeader: {
    width: "100%",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    color: palette.fog,
    marginTop: 6,
    marginBottom: 8,
  },
  tile: {
    width: "31%",
    aspectRatio: 1,
    marginBottom: 12,
    backgroundColor: palette.oat,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  rarity: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  name: {
    fontSize: 10,
    fontWeight: "600",
    color: palette.bark,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 14,
  },
});
