import { api, validatePdfFile, type CatalogGame, type CatalogSearchResponse, type Id } from "@rulesplease/shared";
import * as DocumentPicker from "expo-document-picker";
import { useMutation } from "convex/react";
import { Check, FileUp, Link2, Plus, Search, ShieldCheck, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton, GameCover, thumbnailUrl } from "@/components/ui";
import { colors, radius } from "@/constants/design";
import { usePushRegistration } from "@/lib/notifications";
import type { LibraryRow } from "@/lib/types";

export function ImportRulebook({ visible, row, onClose }: { visible: boolean; row: LibraryRow; onClose: () => void }) {
  const generateUploadUrl = useMutation(api.library.generateRulebookUploadUrl);
  const addManual = useMutation(api.library.addManualRulebook);
  const addGame = useMutation(api.library.add);
  const registerPush = usePushRegistration();
  const [mode, setMode] = useState<"file" | "url">("file");
  const [asset, setAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [expansionQuery, setExpansionQuery] = useState("");
  const [expansionResults, setExpansionResults] = useState<CatalogGame[]>([]);
  const [expansionLoading, setExpansionLoading] = useState(false);
  const [expansions, setExpansions] = useState<CatalogGame[]>([]);
  const game = row.game;

  useEffect(() => {
    if (expansionQuery.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setExpansionLoading(true);
      try {
        const base = process.env.EXPO_PUBLIC_CATALOG_BASE_URL?.replace(/\/$/, "") ?? "https://www.rulesplease.com";
        const response = await fetch(`${base}/api/v1/catalog/search?q=${encodeURIComponent(expansionQuery.trim())}`, { signal: controller.signal });
        const payload = await response.json() as CatalogSearchResponse;
        if (!response.ok) throw new Error(payload.error ?? "Catalog search failed");
        setExpansionResults(payload.results.filter((candidate) => candidate.expansion && candidate.id !== game?.bggId));
      } catch (error) {
        if (!controller.signal.aborted) Alert.alert("Expansion search failed", error instanceof Error ? error.message : "Try again.");
      } finally { if (!controller.signal.aborted) setExpansionLoading(false); }
    }, 320);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [expansionQuery, game?.bggId]);
  const visibleExpansionResults = expansionQuery.trim().length < 2 ? [] : expansionResults;

  function toggleExpansion(expansion: CatalogGame) {
    setExpansions((selected) => selected.some((item) => item.id === expansion.id) ? selected.filter((item) => item.id !== expansion.id) : [...selected, expansion]);
  }

  async function pick() {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true, multiple: false });
    if (!result.canceled) setAsset(result.assets[0]);
  }

  async function submit() {
    if (!game) return;
    setBusy(true);
    try {
      let sourceStorageId: Id<"_storage"> | undefined;
      if (mode === "file") {
        if (!asset) throw new Error("Choose a PDF file first.");
        const response = await fetch(asset.uri);
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const validationError = validatePdfFile({ name: asset.name, mimeType: asset.mimeType, size: asset.size, bytes: bytes.slice(0, 8) });
        if (validationError) throw new Error(validationError);
        const uploadUrl = await generateUploadUrl();
        const upload = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: new Blob([buffer], { type: "application/pdf" }) });
        if (!upload.ok) throw new Error("The upload was interrupted. Please try again.");
        sourceStorageId = (await upload.json() as { storageId: Id<"_storage"> }).storageId;
      }
      await addManual({ game: { bggId: game.bggId, name: game.name, year: game.year, rank: game.rank, average: game.average, usersRated: game.usersRated, isExpansion: Boolean(game.isExpansion), thumbnailUrl: game.thumbnailUrl ?? thumbnailUrl(game.bggId) }, sourceStorageId, sourceUrl: mode === "url" ? url.trim() : undefined, fileName: mode === "file" ? asset?.name : undefined });
      await Promise.all(expansions.map((expansion) => addGame({ game: { bggId: expansion.id, name: expansion.name, year: expansion.year, rank: expansion.rank, average: expansion.average, usersRated: expansion.users, isExpansion: true, thumbnailUrl: thumbnailUrl(expansion.id) } })));
      onClose();
      setAsset(null); setUrl(""); setExpansions([]); setExpansionQuery("");
      registerPush().catch(() => false);
    } catch (error) { Alert.alert("Import failed", error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.scrim}><SafeAreaView style={styles.sheet} edges={["bottom"]}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <View style={styles.heading}><View><Text style={styles.eyebrow}>YOUR RULEBOOK</Text><Text style={styles.title}>Import PDF</Text></View><Pressable onPress={onClose} style={styles.close}><X color={colors.text} size={25} /></Pressable></View>
    {game ? <View style={styles.game}><GameCover uri={thumbnailUrl(game.bggId)} size={62} /><View><Text style={styles.gameName}>{game.name}</Text><Text style={styles.meta}>{game.year ?? "Unknown year"} · Base game</Text></View></View> : null}
    <View style={styles.tabs}><Pressable onPress={() => setMode("file")} style={[styles.tab, mode === "file" && styles.activeTab]}><FileUp size={19} color={colors.text} /><Text style={styles.tabText}>PDF file</Text></Pressable><Pressable onPress={() => setMode("url")} style={[styles.tab, mode === "url" && styles.activeTab]}><Link2 size={19} color={colors.text} /><Text style={styles.tabText}>PDF link</Text></Pressable></View>
    {mode === "file" ? <Pressable onPress={pick} style={styles.picker}><FileUp size={25} color={colors.text} /><View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.fileName}>{asset?.name ?? "Choose a PDF"}</Text><Text style={styles.meta}>{asset?.size ? `${Math.round(asset.size / 1024)} KB selected` : "Up to 50 MB"}</Text></View></Pressable> : <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://publisher.com/rules.pdf" value={url} onChangeText={setUrl} style={styles.urlInput} />}
    <View style={styles.expansions}><View><Text style={styles.sectionTitle}>Add expansions</Text><Text style={styles.sectionBody}>Select one or more BGG expansions. Each gets its own rulebook and rules chat.</Text></View>
      {expansions.length > 0 ? <View style={styles.selectedExpansions}>{expansions.map((expansion) => <Pressable key={expansion.id} onPress={() => toggleExpansion(expansion)} style={styles.expansionChip}><Text numberOfLines={1} style={styles.expansionChipText}>{expansion.name}</Text><X size={15} color={colors.text} /></Pressable>)}</View> : null}
      <View style={styles.expansionSearch}><Search color={colors.muted} size={19} /><TextInput placeholder="Search expansions" value={expansionQuery} onChangeText={setExpansionQuery} style={styles.expansionInput} />{expansionLoading ? <ActivityIndicator color={colors.accent} /> : null}</View>
      {visibleExpansionResults.map((expansion) => { const selected = expansions.some((item) => item.id === expansion.id); return <Pressable key={expansion.id} onPress={() => toggleExpansion(expansion)} style={styles.expansionResult}><GameCover uri={thumbnailUrl(expansion.id)} size={42} /><View style={styles.expansionCopy}><Text numberOfLines={1} style={styles.expansionName}>{expansion.name}</Text><Text style={styles.meta}>{expansion.year ?? "Expansion"}</Text></View><View style={[styles.selectIcon, selected && styles.selectIconActive]}>{selected ? <Check color="#FFFFFF" size={17} /> : <Plus color={colors.text} size={18} />}</View></Pressable>; })}
    </View>
    <View style={styles.note}><ShieldCheck size={20} color={colors.accent} /><Text style={styles.noteText}>Your selected file starts indexing immediately. Image-only pages automatically use OCR.</Text></View>
    <PrimaryButton disabled={mode === "file" ? !asset : !url.startsWith("https://")} loading={busy} onPress={submit}>Import & index</PrimaryButton>
    {busy ? <View style={styles.uploading}><ActivityIndicator color={colors.accent} /><Text style={styles.meta}>Keep the app open while the file uploads.</Text></View> : null}
  </ScrollView></SafeAreaView></View></Modal>;
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,.32)", justifyContent: "flex-end" }, sheet: { maxHeight: "90%", backgroundColor: "#FFFFFF", borderTopLeftRadius: 32, borderTopRightRadius: 32 }, content: { padding: 24, gap: 20 }, heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, eyebrow: { fontSize: 12, letterSpacing: 1.2, fontWeight: "800", color: colors.muted }, title: { fontSize: 29, fontWeight: "800", color: colors.text, marginTop: 4 }, close: { width: 52, height: 52, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  game: { flexDirection: "row", alignItems: "center", gap: 16 }, gameName: { fontSize: 21, fontWeight: "800", color: colors.text }, meta: { color: colors.muted, marginTop: 4 }, tabs: { flexDirection: "row", padding: 3, backgroundColor: colors.surface, borderRadius: 16 }, tab: { flex: 1, height: 54, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, activeTab: { backgroundColor: "#FFFFFF", elevation: 2 }, tabText: { fontSize: 16, fontWeight: "600", color: colors.text },
  picker: { minHeight: 94, borderRadius: radius.medium, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.text, flexDirection: "row", alignItems: "center", padding: 18, gap: 14 }, fileName: { fontSize: 16, fontWeight: "700", color: colors.text }, urlInput: { height: 62, borderRadius: radius.medium, backgroundColor: colors.surface, paddingHorizontal: 18, fontSize: 16 }, expansions: { gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 18 }, sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.text }, sectionBody: { color: colors.muted, lineHeight: 20, marginTop: 4 }, selectedExpansions: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, expansionChip: { maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#E6F4EF", borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 11 }, expansionChipText: { maxWidth: 220, color: colors.text, fontWeight: "700" }, expansionSearch: { height: 52, borderRadius: radius.medium, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14 }, expansionInput: { flex: 1, fontSize: 16, color: colors.text }, expansionResult: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 4 }, expansionCopy: { flex: 1 }, expansionName: { fontWeight: "700", color: colors.text, fontSize: 16 }, selectIcon: { width: 34, height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }, selectIconActive: { backgroundColor: colors.accent, borderColor: colors.accent }, note: { flexDirection: "row", gap: 10, alignItems: "flex-start" }, noteText: { flex: 1, color: colors.muted, lineHeight: 21 }, uploading: { flexDirection: "row", gap: 10, justifyContent: "center", alignItems: "center" },
});
