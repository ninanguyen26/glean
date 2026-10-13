import { useEffect, useState } from "react";
import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { playTap } from "../audio/sounds";
import { palette } from "../constants/theme";
import { tapFeedback } from "./feel";
import { HOME_BG, SUPERVISOR_AVATAR } from "./sprites";

const STEPS = [
  {
    title: "Welcome to the floor.",
    body:
      "I’m your shift supervisor. This place moves fast, but don’t worry. You’ll learn the line one item at a time.",
    button: "I’m ready",
  },
  {
    title: "Every city has its own rules.",
    body:
      "What works in Portland might not fly in Chicago. Before each shift, I’ll show you the local rules for that facility.",
    button: "Got it",
  },
  {
    title: "Do good work, build your album.",
    body:
      "Sort cleanly, earn stars, collect finds, and unlock more places on the map.",
    button: "Start first shift",
  },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const idle = useSharedValue(0);
  const stepNudge = useSharedValue(0);
  const contentIn = useSharedValue(1);
  const buttonPulse = useSharedValue(0);

  useEffect(() => {
    idle.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400 }),
        withTiming(0, { duration: 1400 }),
      ),
      -1,
      false,
    );
  }, []);

  useEffect(() => {
    stepNudge.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 220 }),
    );
    contentIn.value = 0;
    contentIn.value = withTiming(1, { duration: 220 });
  }, [stepIndex]);

  useEffect(() => {
    buttonPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0, { duration: 800 }),
      ),
      -1,
      false,
    );
  }, []);

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -idle.value * 4 - stepNudge.value * 5 },
      { scale: 1 + idle.value * 0.012 + stepNudge.value * 0.008 },
    ],
  }));
  const dialogueStyle = useAnimatedStyle(() => ({
    opacity: contentIn.value,
    transform: [{ translateY: (1 - contentIn.value) * 8 }],
  }));
  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + buttonPulse.value * 0.025 }],
  }));

  const advance = () => {
    tapFeedback();
    playTap();
    if (isLast) {
      onDone();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  return (
    <ImageBackground source={HOME_BG} style={styles.root} resizeMode="cover">
      <View style={styles.scrim} />
      <View style={styles.content}>
        <Animated.View style={[styles.avatarWrap, avatarStyle]}>
          <Image
            source={SUPERVISOR_AVATAR}
            style={styles.avatar}
            resizeMode="contain"
          />
        </Animated.View>
        <View style={styles.card}>
          <View style={styles.stepRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === stepIndex && styles.dotActive]}
              />
            ))}
          </View>
          <Animated.View style={dialogueStyle}>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>
          </Animated.View>
          <Animated.View style={buttonStyle}>
            <Pressable style={styles.button} onPress={advance}>
              <Text style={styles.buttonText}>{step.button}</Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(46,36,28,0.28)",
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 28,
    paddingBottom: 54,
  },
  avatarWrap: {
    alignItems: "center",
    marginBottom: -86,
    zIndex: 0,
  },
  avatar: {
    width: 292,
    height: 292,
  },
  card: {
    zIndex: 2,
    backgroundColor: palette.parchment,
    borderColor: palette.cocoa,
    borderWidth: 3,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  stepRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 18,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: palette.faint,
  },
  dotActive: {
    backgroundColor: palette.clay,
  },
  title: {
    fontFamily: "BalsamiqSans_700Bold",
    fontSize: 25,
    fontWeight: "800",
    lineHeight: 30,
    color: palette.bark,
    textAlign: "center",
  },
  body: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 23,
    color: palette.bark,
    textAlign: "center",
  },
  button: {
    marginTop: 24,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: palette.outline,
    backgroundColor: palette.sage,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  buttonText: {
    fontFamily: "BalsamiqSans_700Bold",
    color: palette.cream,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
    textAlign: "center",
  },
});
