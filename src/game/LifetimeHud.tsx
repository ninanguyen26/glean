import { Image, StyleSheet, Text, View } from "react-native";
import { palette } from "../constants/theme";
import { getCash, getLevel, getTotalStars } from "./db";
import { ICON_COIN, ICON_STAR } from "./sprites";

/* Top row: lifetime numbers (Lv / cash / total stars). Paper-tag pills,
 * identical on Home, Rules, and Belt. Values shrink to fit when long. */
export function LifetimeHud() {
  return (
    <View style={styles.row}>
      <View style={[styles.levelPill, styles.pillCenter]}>
        <Text style={[styles.levelText]} numberOfLines={1} adjustsFontSizeToFit>
          Lv {getLevel()}
        </Text>
      </View>
      <View style={styles.pill}>
        <Image source={ICON_COIN} style={styles.icon} resizeMode="contain" />
        <Text style={styles.text} numberOfLines={1} adjustsFontSizeToFit>
          {getCash()}
        </Text>
      </View>
      <View style={styles.pill}>
        <Image source={ICON_STAR} style={styles.icon} resizeMode="contain" />
        <Text style={styles.text} numberOfLines={1} adjustsFontSizeToFit>
          {getTotalStars()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  levelPill: {
    flexDirection: "column",
    alignItems: "center",
    width: 70,
    backgroundColor: palette.oat,
    borderWidth: 2,
    borderColor: palette.bark,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  levelText: {
    color: palette.bark,
    fontWeight: "700",
    fontSize: 12,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    width: 115,
    backgroundColor: palette.oat,
    borderWidth: 2,
    borderColor: palette.bark,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  pillCenter: {
    justifyContent: "center",
  },
  icon: { width: 22, height: 22 },
  text: {
    flex: 1,
    marginLeft: 6,
    textAlign: "right",
    color: palette.bark,
    fontWeight: "800",
    fontSize: 13,
  },
  textCenter: {
    flex: 0,
    marginLeft: 0,
    textAlign: "center",
  },
});
