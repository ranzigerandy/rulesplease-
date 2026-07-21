import { api, type CatalogGame, type CatalogSearchResponse, type Id } from "@rulesplease/shared";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Check, FileText, Languages, Plus, RefreshCw, Search, ShieldCheck, Trash2, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header, PrimaryButton, Screen, thumbnailUrl } from "@/components/ui";
import { ImportRulebook } from "@/components/import-rulebook";
import { colors, radius } from "@/constants/design";
import type { LibraryRow } from "@/lib/types";

export default function RulebookInfoScreen() {
  const { libraryGameId } = useLocalSearchParams<{ libraryGameId: string }>();
  const library = useQuery(api.library.list) as LibraryRow[] | undefined;
  const row = library?.find((item) => item._id === libraryGameId as Id<"libraryGames">);
  const [importOpen, setImportOpen] = useState(false);
  const [expansionsOpen, setExpansionsOpen] = useState(false);
  const removeExpansion = useMutation(api.library.removeExpansion);
  if (!row?.game) return <Screen contentStyle={styles.center}><ActivityIndicator color={colors.text} /></Screen>;
  const source = row.rulebookSource;
  return <Screen><Header title="Rulebook info" coverUrl={thumbnailUrl(row.game.bggId)} />
    <Text style={styles.title}>{row.game.name}</Text><Text style={styles.subtitle}>The exact document used for every answer in this chat.</Text>
    <View style={styles.card}><InfoRow icon={<FileText color={colors.text} size={22} />} label="Source" value={source?.label ?? "Processing"} /><InfoRow icon={<ShieldCheck color={colors.accent} size={22} />} label="Edition" value={source?.edition ?? "Base game"} /><InfoRow icon={<Languages color={colors.text} size={22} />} label="Language" value={source?.language?.toUpperCase() ?? "—"} /><InfoRow icon={<RefreshCw color={colors.text} size={22} />} label="Revision" value={source?.revision ?? "Not specified"} /></View>
    <View style={styles.stats}><View style={styles.stat}><Text style={styles.statLabel}>PAGES</Text><Text style={styles.statValue}>{source?.pageCount ?? row.rulebook?.pageCount ?? "—"}</Text></View><View style={styles.stat}><Text style={styles.statLabel}>STATUS</Text><Text style={styles.statValue}>{row.statusLabel}</Text></View></View>
    {(row.expansions?.length ?? 0) > 0 ? <View style={styles.attached}><Text style={styles.attachedTitle}>IN THIS CHAT</Text>{row.expansions?.map((expansion) => <View key={expansion.libraryGameId} style={styles.attachedRow}><View style={{ flex: 1 }}><Text style={styles.attachedName}>{expansion.game.name}</Text><Text style={styles.attachedMeta}>{expansion.status === "ready" ? "Included in this chat" : expansion.statusLabel}</Text></View><Pressable onPress={() => removeExpansion({ libraryGameId: row._id, expansionLibraryGameId: expansion.libraryGameId }).catch((error) => Alert.alert("Could not remove expansion", String(error)))} style={styles.remove}><Trash2 color={colors.danger} size={18} /></Pressable></View>)}</View> : null}
    <View style={styles.bottom}><PrimaryButton secondary onPress={() => setExpansionsOpen(true)}>Add expansions</PrimaryButton><PrimaryButton secondary onPress={() => setImportOpen(true)}>Replace with PDF or link</PrimaryButton></View>
    <ExpansionPicker visible={expansionsOpen} libraryGameId={row._id} baseGameId={row.game.bggId} onClose={() => setExpansionsOpen(false)} />
    <ImportRulebook visible={importOpen} row={row} onClose={() => setImportOpen(false)} />
  </Screen>;
}

function ExpansionPicker({ visible, libraryGameId, baseGameId, onClose }: { visible: boolean; libraryGameId: Id<"libraryGames">; baseGameId: number; onClose: () => void }) {
  const addExpansions = useMutation(api.library.addExpansions);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogGame[]>([]);
  const [selected, setSelected] = useState<CatalogGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
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
        setResults(payload.results.filter((candidate) => candidate.expansion && candidate.id !== baseGameId));
      } catch (error) { if (!controller.signal.aborted) Alert.alert("Expansion search failed", error instanceof Error ? error.message : "Try again."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 320);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [query, baseGameId]);
  const visibleResults = query.trim().length < 2 ? [] : results;
  const toggle = (expansion: CatalogGame) => setSelected((current) => current.some((item) => item.id === expansion.id) ? current.filter((item) => item.id !== expansion.id) : [...current, expansion]);
  async function submit() {
    setAdding(true);
    try {
      await addExpansions({ libraryGameId, games: selected.map((expansion) => ({ bggId: expansion.id, name: expansion.name, year: expansion.year, rank: expansion.rank, average: expansion.average, usersRated: expansion.users, isExpansion: true, thumbnailUrl: thumbnailUrl(expansion.id) })) });
      setSelected([]); setQuery(""); onClose();
    } catch (error) { Alert.alert("Could not add expansions", error instanceof Error ? error.message : "Try again."); }
    finally { setAdding(false); }
  }
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.scrim}><SafeAreaView style={styles.sheet} edges={["bottom"]}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
    <View style={styles.sheetHeader}><View><Text style={styles.sheetEyebrow}>YOUR COLLECTION</Text><Text style={styles.sheetTitle}>Add expansions</Text></View><Pressable onPress={onClose} style={styles.close}><X color={colors.text} size={24} /></Pressable></View>
    <Text style={styles.sheetBody}>Search BoardGameGeek and select one or more expansions. Each receives its own rulebook and rules chat.</Text>
    {selected.length > 0 ? <View style={styles.chips}>{selected.map((expansion) => <Pressable key={expansion.id} onPress={() => toggle(expansion)} style={styles.chip}><Text numberOfLines={1} style={styles.chipText}>{expansion.name}</Text><X size={15} color={colors.text} /></Pressable>)}</View> : null}
    <View style={styles.search}><Search color={colors.muted} size={19} /><TextInput autoFocus placeholder="Search expansions" value={query} onChangeText={setQuery} style={styles.input} />{loading ? <ActivityIndicator color={colors.accent} /> : null}</View>
    {visibleResults.map((expansion) => { const isSelected = selected.some((item) => item.id === expansion.id); return <Pressable key={expansion.id} onPress={() => toggle(expansion)} style={styles.result}><View style={styles.resultCopy}><Text numberOfLines={1} style={styles.resultName}>{expansion.name}</Text><Text style={styles.resultMeta}>{expansion.year ?? "Expansion"}</Text></View><View style={[styles.select, isSelected && styles.selectActive]}>{isSelected ? <Check color="#FFF" size={17} /> : <Plus color={colors.text} size={18} />}</View></Pressable>; })}
    <PrimaryButton disabled={selected.length === 0} loading={adding} onPress={submit}>{selected.length === 0 ? "Add expansions" : `Add ${selected.length} expansion${selected.length === 1 ? "" : "s"}`}</PrimaryButton>
  </ScrollView></SafeAreaView></View></Modal>;
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <View style={styles.row}>{icon}<View style={{ flex: 1 }}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View></View>; }
const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" }, title: { fontSize: 31, fontWeight: "800", color: colors.text, marginTop: 12 }, subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 8, marginBottom: 26 }, card: { backgroundColor: colors.surface, borderRadius: radius.medium, paddingHorizontal: 18 }, row: { minHeight: 78, flexDirection: "row", gap: 14, alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, rowLabel: { color: colors.muted, fontSize: 13, fontWeight: "700" }, rowValue: { color: colors.text, fontSize: 16, fontWeight: "600", marginTop: 4 }, stats: { flexDirection: "row", marginTop: 16, borderWidth: 1, borderColor: colors.border, borderRadius: radius.medium, overflow: "hidden" }, stat: { flex: 1, minHeight: 92, alignItems: "center", justifyContent: "center" }, statLabel: { color: colors.muted, fontSize: 12, fontWeight: "800" }, statValue: { color: colors.text, fontWeight: "700", marginTop: 6, textAlign: "center" }, attached: { marginTop: 16, padding: 16, gap: 9, borderRadius: radius.medium, backgroundColor: "#EAF7F2" }, attachedTitle: { color: colors.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1 }, attachedRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }, attachedName: { color: colors.text, fontWeight: "700" }, attachedMeta: { color: colors.muted, fontSize: 12, marginTop: 2 }, remove: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: "#FFF0ED" }, bottom: { marginTop: 26, gap: 12 },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,.32)", justifyContent: "flex-end" }, sheet: { maxHeight: "88%", backgroundColor: "#FFFFFF", borderTopLeftRadius: 32, borderTopRightRadius: 32 }, sheetContent: { padding: 24, gap: 16 }, sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, sheetEyebrow: { color: colors.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1.1 }, sheetTitle: { color: colors.text, fontSize: 28, fontWeight: "800", marginTop: 4 }, close: { width: 48, height: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }, sheetBody: { color: colors.muted, lineHeight: 21 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { maxWidth: "100%", flexDirection: "row", gap: 6, alignItems: "center", paddingVertical: 8, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: "#E6F4EF" }, chipText: { maxWidth: 230, color: colors.text, fontWeight: "700" }, search: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, borderRadius: radius.medium, backgroundColor: colors.surface }, input: { flex: 1, color: colors.text, fontSize: 16 }, result: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, resultCopy: { flex: 1 }, resultName: { color: colors.text, fontSize: 16, fontWeight: "700" }, resultMeta: { color: colors.muted, marginTop: 3 }, select: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border }, selectActive: { backgroundColor: colors.accent, borderColor: colors.accent },
});
