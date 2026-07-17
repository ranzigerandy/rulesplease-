import { api, validatePdfFile, type Id } from "@rulesplease/shared";
import * as DocumentPicker from "expo-document-picker";
import { useMutation } from "convex/react";
import { FileUp, Link2, ShieldCheck, X } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton, GameCover, thumbnailUrl } from "@/components/ui";
import { colors, radius } from "@/constants/design";
import { usePushRegistration } from "@/lib/notifications";
import type { LibraryRow } from "@/lib/types";

export function ImportRulebook({ visible, row, onClose }: { visible: boolean; row: LibraryRow; onClose: () => void }) {
  const generateUploadUrl = useMutation(api.library.generateRulebookUploadUrl);
  const addManual = useMutation(api.library.addManualRulebook);
  const registerPush = usePushRegistration();
  const [mode, setMode] = useState<"file" | "url">("file");
  const [asset, setAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const game = row.game;

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
      await addManual({
        game: { bggId: game.bggId, name: game.name, year: game.year, rank: game.rank, average: game.average, usersRated: game.usersRated, isExpansion: Boolean(game.isExpansion), thumbnailUrl: game.thumbnailUrl ?? thumbnailUrl(game.bggId) },
        sourceStorageId,
        sourceUrl: mode === "url" ? url.trim() : undefined,
        fileName: mode === "file" ? asset?.name : undefined,
      });
      onClose();
      setAsset(null); setUrl("");
      registerPush().catch(() => false);
    } catch (error) { Alert.alert("Import failed", error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.scrim}><SafeAreaView style={styles.sheet} edges={["bottom"]}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.heading}><View><Text style={styles.eyebrow}>YOUR RULEBOOK</Text><Text style={styles.title}>Import PDF</Text></View><Pressable onPress={onClose} style={styles.close}><X color={colors.text} size={25} /></Pressable></View>
      {game ? <View style={styles.game}><GameCover uri={thumbnailUrl(game.bggId)} size={62} /><View><Text style={styles.gameName}>{game.name}</Text><Text style={styles.meta}>{game.year ?? "Unknown year"} · Base game</Text></View></View> : null}
      <View style={styles.tabs}><Pressable onPress={() => setMode("file")} style={[styles.tab, mode === "file" && styles.activeTab]}><FileUp size={19} color={colors.text} /><Text style={styles.tabText}>PDF file</Text></Pressable><Pressable onPress={() => setMode("url")} style={[styles.tab, mode === "url" && styles.activeTab]}><Link2 size={19} color={colors.text} /><Text style={styles.tabText}>PDF link</Text></Pressable></View>
      {mode === "file" ? <Pressable onPress={pick} style={styles.picker}><FileUp size={25} color={colors.text} /><View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.fileName}>{asset?.name ?? "Choose a PDF"}</Text><Text style={styles.meta}>{asset?.size ? `${Math.round(asset.size / 1024)} KB selected` : "Up to 50 MB"}</Text></View></Pressable> : <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://publisher.com/rules.pdf" value={url} onChangeText={setUrl} style={styles.urlInput} />}
      <View style={styles.note}><ShieldCheck size={20} color={colors.accent} /><Text style={styles.noteText}>Your selected file starts indexing immediately. Image-only pages automatically use OCR.</Text></View>
      <PrimaryButton disabled={mode === "file" ? !asset : !url.startsWith("https://")} loading={busy} onPress={submit}>Import & index</PrimaryButton>
      {busy ? <View style={styles.uploading}><ActivityIndicator color={colors.accent} /><Text style={styles.meta}>Keep the app open while the file uploads.</Text></View> : null}
    </ScrollView></SafeAreaView></View>
  </Modal>;
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,.32)", justifyContent: "flex-end" }, sheet: { maxHeight: "90%", backgroundColor: "#FFFFFF", borderTopLeftRadius: 32, borderTopRightRadius: 32 }, content: { padding: 24, gap: 20 }, heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, eyebrow: { fontSize: 12, letterSpacing: 1.2, fontWeight: "800", color: colors.muted }, title: { fontSize: 29, fontWeight: "800", color: colors.text, marginTop: 4 }, close: { width: 52, height: 52, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  game: { flexDirection: "row", alignItems: "center", gap: 16 }, gameName: { fontSize: 21, fontWeight: "800", color: colors.text }, meta: { color: colors.muted, marginTop: 4 }, tabs: { flexDirection: "row", padding: 3, backgroundColor: colors.surface, borderRadius: 16 }, tab: { flex: 1, height: 54, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, activeTab: { backgroundColor: "#FFFFFF", elevation: 2 }, tabText: { fontSize: 16, fontWeight: "600", color: colors.text },
  picker: { minHeight: 94, borderRadius: radius.medium, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.text, flexDirection: "row", alignItems: "center", padding: 18, gap: 14 }, fileName: { fontSize: 16, fontWeight: "700", color: colors.text }, urlInput: { height: 62, borderRadius: radius.medium, backgroundColor: colors.surface, paddingHorizontal: 18, fontSize: 16 }, note: { flexDirection: "row", gap: 10, alignItems: "flex-start" }, noteText: { flex: 1, color: colors.muted, lineHeight: 21 }, uploading: { flexDirection: "row", gap: 10, justifyContent: "center", alignItems: "center" },
});
