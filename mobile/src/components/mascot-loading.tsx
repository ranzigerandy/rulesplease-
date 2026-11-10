import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Easing, StyleSheet, Text, View } from "react-native";
import { loadingPercent, type LoadingPose } from "@rulesplease/shared";
import { colors, radius } from "@/constants/design";

const art = {
  waiting: [require("../../assets/images/mascot-loading/waiting.png"), require("../../assets/images/mascot-loading/waiting.webp")],
  searching: [require("../../assets/images/mascot-loading/searching.png"), require("../../assets/images/mascot-loading/searching.webp")],
  reading: [require("../../assets/images/mascot-loading/reading.png"), require("../../assets/images/mascot-loading/reading.webp")],
  thinking: [require("../../assets/images/mascot-loading/thinking.png"), require("../../assets/images/mascot-loading/thinking.webp")],
};

export function MascotLoading({
  label,
  detail,
  pose = "waiting",
  progress,
  progressText,
  compact = false,
}: {
  label: string;
  detail?: string;
  pose?: LoadingPose;
  progress?: number;
  progressText?: string;
  compact?: boolean;
}) {
  const [reduced, setReduced] = useState(true);
  const [active, setActive] = useState(AppState.currentState === "active" || AppState.currentState == null);
  const [trackWidth, setTrackWidth] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;
  const value = loadingPercent(progress);
  const moving = active && !reduced;
  const indeterminate = value === undefined;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => { if (mounted) setReduced(enabled); })
      .catch(() => {});
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    const foreground = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => {
      mounted = false;
      motion.remove();
      foreground.remove();
    };
  }, []);

  useEffect(() => {
    if (!moving || !indeterminate) return;
    sweep.setValue(0);
    const loop = Animated.loop(Animated.timing(sweep, {
      toValue: 1,
      duration: 1900,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
      isInteraction: false,
    }));
    loop.start();
    return () => loop.stop();
  }, [indeterminate, moving, sweep]);

  const text = progressText ?? (value === undefined ? undefined : `${value}% complete`);
  return (
    <View style={[styles.panel, compact && styles.compact]}>
      <Image
        accessible={false}
        source={art[pose][moving ? 1 : 0]}
        autoplay={moving}
        contentFit="contain"
        style={compact ? styles.smallMascot : styles.mascot}
      />
      <Text style={styles.label} accessibilityLiveRegion="polite">{label}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={value === undefined ? (text ? { text } : undefined) : { min: 0, max: 100, now: value, text }}
        style={styles.track}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      >
        {indeterminate ? (
          <Animated.View style={[
            styles.fill,
            { width: "35%", alignSelf: moving ? "flex-start" : "center" },
            moving && {
              transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-trackWidth * 0.35, trackWidth] }) }],
            },
          ]} />
        ) : <View style={[styles.fill, { width: `${value}%` }]} />}
      </View>
      {text ? <Text accessible={false} style={styles.detail}>{text}</Text> : null}
    </View>
  );
}

export function LoadingScreen({ label }: { label: string }) {
  return <View style={styles.screen}><MascotLoading label={label} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: 20 },
  panel: { width: "100%", maxWidth: 360, alignSelf: "center", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  compact: { gap: 5 },
  mascot: { width: 96, height: 96 },
  smallMascot: { width: 48, height: 48 },
  label: { fontSize: 15, fontWeight: "700", textAlign: "center", color: colors.text },
  detail: { fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: "center" },
  track: { width: "100%", maxWidth: 230, height: 7, borderRadius: radius.pill, backgroundColor: colors.surface, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.accent },
});
