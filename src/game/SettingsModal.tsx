/* Settings modal: music / sound / haptics toggles, persisted in db meta. */
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import {
  isMusicMuted,
  isSoundMuted,
  setMusicMuted,
  setSoundMuted,
} from "../audio/sounds";
import { palette } from "../constants/theme";
import { setSetting } from "./db";
import { isHapticsMuted, setHapticsMuted, tapFeedback } from "./feel";
import { ICON_HAPTICS, ICON_MUSIC, ICON_SOUND } from "./sprites";

function ToggleRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: any;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Image source={icon} style={styles.rowIcon} resizeMode="contain" />
      <Text style={styles.rowLabel}>{label}</Text>
      <Pressable
        onPress={() => {
          tapFeedback();
          onChange(!value);
        }}
        style={[styles.toggle, value ? styles.toggleOn : styles.toggleOff]}
        hitSlop={6}
      >
        <View style={styles.knob} />
      </Pressable>
    </View>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [musicOn, setMusicOn] = useState(!isMusicMuted());
  const [soundOn, setSoundOn] = useState(!isSoundMuted());
  const [hapticsOn, setHapticsOn] = useState(!isHapticsMuted());

  const flipMusic = (v: boolean) => {
    setMusicOn(v);
    setMusicMuted(!v);
    setSetting("music_muted", v ? "0" : "1");
  };
  const flipSound = (v: boolean) => {
    setSoundOn(v);
    setSoundMuted(!v);
    setSetting("sound_muted", v ? "0" : "1");
  };
  const flipHaptics = (v: boolean) => {
    setHapticsOn(v);
    setHapticsMuted(!v);
    setSetting("haptics_muted", v ? "0" : "1");
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.card}>
        <Text style={styles.title}>SETTINGS</Text>
        <ToggleRow
          icon={ICON_MUSIC}
          label="Music"
          value={musicOn}
          onChange={flipMusic}
        />
        <ToggleRow
          icon={ICON_SOUND}
          label="Sound"
          value={soundOn}
          onChange={flipSound}
        />
        <ToggleRow
          icon={ICON_HAPTICS}
          label="Haptics"
          value={hapticsOn}
          onChange={flipHaptics}
        />
        <Pressable
          style={styles.done}
          onPress={() => {
            tapFeedback();
            onClose();
          }}
        >
          <Text style={styles.doneLabel}>DONE</Text>
        </Pressable>
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
    zIndex: 50,
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
    width: 300,
    backgroundColor: palette.parchment,
    borderColor: palette.cocoa,
    borderWidth: 3,
    borderRadius: 22,
    padding: 20,
  },
  title: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 17,
    letterSpacing: 3,
    color: palette.bark,
    textAlign: "center",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  rowIcon: { width: 44, height: 44, marginRight: 12 },
  rowLabel: {
    flex: 1,
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 15,
    color: palette.bark,
  },
  toggle: {
    width: 58,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: palette.outline,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleOn: { backgroundColor: palette.leaf, alignItems: "flex-end" },
  toggleOff: { backgroundColor: palette.fog, alignItems: "flex-start" },
  knob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.cream,
    borderWidth: 2,
    borderColor: palette.outline,
  },
  done: {
    marginTop: 14,
    backgroundColor: palette.sage,
    borderColor: palette.outline,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  doneLabel: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 14,
    letterSpacing: 2,
    color: palette.cream,
  },
});
