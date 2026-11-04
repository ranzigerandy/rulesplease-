import { useState } from "react";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { ArrowRight, Search } from "lucide-react-native";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  api,
  teachingLibraryGames,
  type TeachingLibraryGame,
} from "@rulesplease/shared";
import {
  Header,
  PrimaryButton,
  Screen,
  GameCover,
  thumbnailUrl,
} from "@/components/ui";
import { colors, radius } from "@/constants/design";

export default function TeachingLibraryScreen() {
  const library = useQuery(api.library.list) as
    TeachingLibraryGame[] | undefined;
  const enabled = useQuery(api.teaching.availability);
  const [query, setQuery] = useState("");
  const games = teachingLibraryGames(library ?? [], query);
  return (
    <Screen>
      <Header title="Explain this game" />
      <Text accessibilityRole="header" style={styles.title}>
        What would you like to learn?
      </Text>
      <Text style={styles.description}>
        Choose a game from your library. Learn from its approved rulebook,
        follow an example turn and keep the game overview close by.
      </Text>
      <Text style={styles.label}>Find a game in your library</Text>
      <View style={styles.search}>
        <Search color={colors.muted} size={20} />
        <TextInput
          accessibilityLabel="Find a game in your library"
          placeholder="Search by game title…"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
      {enabled === false && (
        <Text style={styles.description}>
          Teaching is not enabled for this account yet. You can still review
          your rulebooks in your library.
        </Text>
      )}
      {!library ? (
        <ActivityIndicator
          accessibilityLabel="Loading your games"
          color={colors.text}
        />
      ) : (
        <>
          <Text style={styles.count} accessibilityLiveRegion="polite">
            {games.length} {games.length === 1 ? "game" : "games"}
            {query.trim() ? " found" : " in your library"}
          </Text>
          {games.map((row) => (
            <Pressable
              key={row._id}
              accessibilityRole="button"
              accessibilityLabel={`${row.status === "ready" ? "Teach me" : "Prepare rulebook for"} ${row.game!.name}`}
              style={styles.row}
              onPress={() =>
                router.push(
                  row.status === "ready"
                    ? `/learn/${row._id}`
                    : `/game/${row._id}`,
                )
              }
            >
              <GameCover uri={thumbnailUrl(row.game!.bggId)} size={52} />
              <View style={styles.rowCopy}>
                <Text accessibilityRole="header" style={styles.name}>
                  {row.game!.name}
                </Text>
                <Text style={styles.meta}>
                  {row.game!.year ? `${row.game!.year} · ` : ""}
                  {row.status === "ready"
                    ? "Rulebook ready"
                    : (row.statusLabel ?? "Rulebook preparation needed")}
                </Text>
                {row.rulebookSource && (
                  <Text numberOfLines={1} style={styles.meta}>
                    {row.rulebookSource.label}
                    {row.rulebookSource.language
                      ? ` · ${row.rulebookSource.language}`
                      : ""}
                  </Text>
                )}
                <Text style={styles.action}>
                  {row.status === "ready"
                    ? "Teach me this game"
                    : "Prepare rulebook"}
                </Text>
              </View>
              <ArrowRight color={colors.muted} size={18} />
            </Pressable>
          ))}
          {games.length === 0 && (
            <Text style={styles.description}>
              {query.trim()
                ? "No matching games. Try another title, or add the game to your library first."
                : "Add a game and approve its rulebook to prepare your first lesson."}
            </Text>
          )}
          <PrimaryButton secondary onPress={() => router.push("/search")}>
            Find another game
          </PrimaryButton>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 27,
    lineHeight: 34,
    color: colors.text,
    fontWeight: "700",
    marginTop: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
    marginVertical: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 10,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.medium,
  },
  input: {
    flex: 1,
    minHeight: 52,
    color: colors.text,
    fontSize: 16,
    paddingVertical: 12,
  },
  count: { color: colors.muted, fontSize: 13, marginTop: 24 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowCopy: { flex: 1, gap: 4 },
  name: { fontSize: 17, lineHeight: 24, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, lineHeight: 22, color: colors.muted },
  action: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
    fontWeight: "600",
  },
});
