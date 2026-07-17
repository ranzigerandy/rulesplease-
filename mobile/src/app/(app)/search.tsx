import { api, type CatalogGame, type CatalogSearchResponse } from "@rulesplease/shared";
import { router } from "expo-router";
import { useMutation } from "convex/react";
import { Plus, Search } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { GameCover, Header, Screen, thumbnailUrl } from "@/components/ui";
import { colors, radius } from "@/constants/design";
import { usePushRegistration } from "@/lib/notifications";

export default function SearchScreen() {
  const addGame = useMutation(api.library.add);
  const registerPush = usePushRegistration();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const base = process.env.EXPO_PUBLIC_CATALOG_BASE_URL?.replace(/\/$/, "") ?? "https://www.rulesplease.com";
        const response = await fetch(`${base}/api/v1/catalog/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const payload = await response.json() as CatalogSearchResponse;
        if (!response.ok) throw new Error(payload.error ?? "Catalog search failed");
        setResults(payload.results);
      } catch (error) { if (!controller.signal.aborted) Alert.alert("Search failed", error instanceof Error ? error.message : "Try again."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 320);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [query]);
  const visibleResults = query.trim().length < 2 ? [] : results;

  async function choose(game: CatalogGame) {
    setAdding(game.id);
    try {
      const libraryGameId = await addGame({ game: { bggId: game.id, name: game.name, year: game.year, rank: game.rank, average: game.average, usersRated: game.users, isExpansion: game.expansion, thumbnailUrl: thumbnailUrl(game.id) } });
      registerPush().catch(() => false);
      router.replace(`/game/${libraryGameId}`);
    } catch (error) { Alert.alert("Could not add game", error instanceof Error ? error.message : "Try again."); }
    finally { setAdding(null); }
  }

  return <Screen>
    <Header title="New rules chat" />
    <Text style={styles.title}>What are you playing?</Text><Text style={styles.subtitle}>Choose one game to start a cited rules chat.</Text>
    <View style={styles.search}><Search color={colors.muted} size={21} /><TextInput autoFocus placeholder="Search games" value={query} onChangeText={setQuery} style={styles.input} returnKeyType="search" />{loading ? <ActivityIndicator color={colors.text} /> : null}</View>
    {query.length >= 2 ? <Text style={styles.label}>Search results</Text> : null}
    {visibleResults.map((game) => <Pressable key={game.id} onPress={() => choose(game)} style={styles.result}>
      <GameCover uri={thumbnailUrl(game.id)} size={54} /><View style={styles.copy}><Text style={styles.name}>{game.name}</Text><Text style={styles.meta}>{[game.year, game.rank ? `BGG rank ${game.rank}` : null].filter(Boolean).join(" · ")}</Text></View><View style={styles.plus}>{adding === game.id ? <ActivityIndicator color={colors.text} /> : <Plus color={colors.text} size={23} />}</View>
    </Pressable>)}
  </Screen>;
}

const styles = StyleSheet.create({
  title: { fontSize: 32, lineHeight: 38, fontWeight: "800", color: colors.text, textAlign: "center", marginTop: 16 }, subtitle: { fontSize: 16, color: colors.muted, textAlign: "center", marginTop: 8 },
  search: { height: 60, borderRadius: radius.medium, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, gap: 10, marginTop: 30 }, input: { flex: 1, fontSize: 17, color: colors.text }, label: { color: colors.muted, marginTop: 30, marginBottom: 10 },
  result: { minHeight: 92, flexDirection: "row", alignItems: "center", gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: 12 }, copy: { flex: 1, gap: 6 }, name: { fontSize: 18, fontWeight: "700", color: colors.text }, meta: { color: colors.muted }, plus: { width: 48, height: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
});
