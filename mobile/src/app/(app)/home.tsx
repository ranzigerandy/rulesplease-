import { api } from "@rulesplease/shared";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { ChevronRight, Plus, Settings } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { GameCover, Screen, thumbnailUrl } from "@/components/ui";
import { colors, radius } from "@/constants/design";
import type { LibraryRow } from "@/lib/types";

export default function HomeScreen() {
  const library = useQuery(api.library.list) as LibraryRow[] | undefined;
  return <Screen>
    <View style={styles.top}><View style={styles.brand}><Image source={require("@/assets/images/rulesplease-mascot.png")} style={styles.mascot} /><Text style={styles.brandText}>Rules Please!</Text></View><Pressable accessibilityLabel="Settings" onPress={() => router.push("/settings")} style={styles.settings}><Settings size={22} color={colors.text} /></Pressable></View>
    <View style={styles.hero}><Text style={styles.eyebrow}>YOUR RULES LIBRARY</Text><Text style={styles.title}>What are you playing?</Text><Text style={styles.subtitle}>Find a game and start a cited rules chat.</Text><Pressable onPress={() => router.push("/search")} style={styles.newChat}><Plus size={22} color="#FFFFFF" /><Text style={styles.newChatText}>Start a new rules chat</Text></Pressable></View>
    <Text style={styles.sectionTitle}>Recent chats</Text>
    {!library ? <ActivityIndicator color={colors.text} style={styles.loader} /> : library.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No games yet</Text><Text style={styles.emptyBody}>Your approved and processing rulebooks will appear here.</Text></View> : library.map((row) => <Pressable key={row._id} onPress={() => router.push(`/game/${row._id}`)} style={styles.card}>
      <GameCover uri={row.game ? thumbnailUrl(row.game.bggId) : undefined} size={62} />
      <View style={styles.cardCopy}><Text numberOfLines={1} style={styles.gameName}>{row.game?.name ?? "Board game"}</Text><Text numberOfLines={1} style={[styles.status, row.status === "ready" && styles.ready]}>{row.statusLabel}</Text><Text numberOfLines={2} style={styles.message}>{row.statusMessage}</Text></View><ChevronRight color={colors.muted} size={20} />
    </Pressable>)}
  </Screen>;
}

const styles = StyleSheet.create({
  top: { height: 76, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, brand: { flexDirection: "row", alignItems: "center", gap: 10 }, mascot: { width: 38, height: 38 }, brandText: { fontSize: 20, fontWeight: "800", color: colors.text }, settings: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surface },
  hero: { paddingTop: 34, paddingBottom: 42 }, eyebrow: { color: colors.accent, fontWeight: "800", fontSize: 13, letterSpacing: 1.4, textAlign: "center" }, title: { fontSize: 36, lineHeight: 43, fontWeight: "800", textAlign: "center", color: colors.text, marginTop: 12 }, subtitle: { textAlign: "center", color: colors.muted, fontSize: 17, marginTop: 8 },
  newChat: { height: 62, backgroundColor: colors.black, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 28 }, newChatText: { color: "#FFFFFF", fontWeight: "700", fontSize: 17 }, sectionTitle: { fontSize: 25, fontWeight: "800", color: colors.text, marginBottom: 18 },
  loader: { marginTop: 36 }, empty: { backgroundColor: colors.surface, borderRadius: radius.large, padding: 28 }, emptyTitle: { fontSize: 19, fontWeight: "700", color: colors.text }, emptyBody: { color: colors.muted, lineHeight: 22, marginTop: 6 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.medium, padding: 14, marginBottom: 12 }, cardCopy: { flex: 1, gap: 4 }, gameName: { fontSize: 18, fontWeight: "700", color: colors.text }, status: { fontSize: 14, fontWeight: "700", color: colors.muted }, ready: { color: colors.accent }, message: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
