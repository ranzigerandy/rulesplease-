import { Image } from "expo-image";
import { router } from "expo-router";
import { ArrowLeft, LoaderCircle } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, maxContentWidth, radius } from "@/constants/design";

export function Screen({ children, scroll = true, contentStyle }: { children: ReactNode; scroll?: boolean; contentStyle?: ViewStyle }) {
  const content = <View style={[styles.content, contentStyle]}>{children}</View>;
  return <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>{scroll ? <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">{content}</ScrollView> : content}</SafeAreaView>;
}

export function Header({ title, coverUrl, right }: { title: string; coverUrl?: string; right?: ReactNode }) {
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.iconButton}><ArrowLeft color={colors.text} size={24} /></Pressable>
    {coverUrl ? <GameCover uri={coverUrl} size={48} /> : null}
    <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
    {right ?? <View style={styles.iconSpacer} />}
  </View>;
}

export function PrimaryButton({ children, onPress, disabled, loading, secondary = false }: { children: ReactNode; onPress: () => void; disabled?: boolean; loading?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, (disabled || loading) && styles.disabled, pressed && styles.pressed]}>
    {loading ? <ActivityIndicator color={secondary ? colors.text : "#FFFFFF"} /> : <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{children}</Text>}
  </Pressable>;
}

export function GameCover({ uri, size = 64 }: { uri?: string | null; size?: number }) {
  return <View style={[styles.cover, { width: size, height: size * 1.22 }]}>{uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} /> : <LoaderCircle color={colors.muted} size={22} />}</View>;
}

export function thumbnailUrl(bggId: number) {
  const base = process.env.EXPO_PUBLIC_CATALOG_BASE_URL?.replace(/\/$/, "") ?? "https://www.rulesplease.com";
  return `${base}/api/v1/catalog/thumbnail/${bggId}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, scroll: { flexGrow: 1, alignItems: "center" },
  content: { width: "100%", maxWidth: maxContentWidth, flexGrow: 1, paddingHorizontal: 20, paddingBottom: 28 },
  header: { height: 72, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }, headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", color: colors.text },
  iconButton: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 }, iconSpacer: { width: 48 },
  button: { minHeight: 58, paddingHorizontal: 24, borderRadius: radius.pill, backgroundColor: colors.black, alignItems: "center", justifyContent: "center" },
  buttonSecondary: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border }, buttonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700", textAlign: "center" }, buttonTextSecondary: { color: colors.text },
  disabled: { opacity: 0.45 }, pressed: { transform: [{ scale: 0.99 }] }, cover: { overflow: "hidden", borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
