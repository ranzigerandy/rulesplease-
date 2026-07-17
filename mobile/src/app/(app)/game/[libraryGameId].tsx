import { api } from "@rulesplease/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { BookOpenCheck, CircleAlert, Info, RefreshCw, ScanText } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Pdf from "react-native-pdf";
import { Header, PrimaryButton, Screen, thumbnailUrl } from "@/components/ui";
import { ImportRulebook } from "@/components/import-rulebook";
import { colors, radius } from "@/constants/design";
import type { LibraryRow } from "@/lib/types";

export default function GameStatusScreen() {
  const { libraryGameId } = useLocalSearchParams<{ libraryGameId: string }>();
  const library = useQuery(api.library.list) as LibraryRow[] | undefined;
  const approve = useMutation(api.library.approveRulebook);
  const reportWrong = useMutation(api.library.reportWrongRulebook);
  const row = useMemo(() => library?.find((item) => item._id === libraryGameId), [library, libraryGameId]);
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!row || !row.game) return <Screen contentStyle={styles.center}><ActivityIndicator color={colors.text} /></Screen>;
  const cover = thumbnailUrl(row.game.bggId);
  const review = row.status === "review_required" && Boolean(row.rulebookSource && row.previewPdfUrl);
  const failed = row.status === "failed" || (row.status === "review_required" && !review);
  const processing = !review && !failed && row.status !== "ready";

  async function approveCandidate() {
    if (!row) return;
    setBusy(true);
    try { await approve({ libraryGameId: row._id }); }
    catch (error) { Alert.alert("Could not approve", error instanceof Error ? error.message : "Try again."); }
    finally { setBusy(false); }
  }
  async function nextCandidate() {
    if (!row) return;
    setBusy(true);
    try { await reportWrong({ libraryGameId: row._id }); }
    catch (error) { Alert.alert("Could not continue", error instanceof Error ? error.message : "Try again."); }
    finally { setBusy(false); }
  }

  return <Screen>
    <Header title={row.game.name} coverUrl={cover} right={<Pressable onPress={() => router.push(`/rulebook-info/${row._id}`)} style={styles.info}><Info color={colors.text} size={22} /></Pressable>} />
    {row.status === "ready" ? <View style={styles.state}><View style={styles.stateIcon}><BookOpenCheck color={colors.accent} size={34} /></View><Text style={styles.eyebrow}>READY TO PLAY</Text><Text style={styles.title}>Your rulebook is ready.</Text><Text style={styles.body}>{row.reusedSharedRulebook ? "This verified rulebook came from the shared database, so no indexing was needed." : "The rulebook is indexed and ready for cited answers."}</Text><View style={styles.actions}><PrimaryButton onPress={() => router.push(`/chat/${row._id}`)}>Open rules chat</PrimaryButton><PrimaryButton secondary onPress={() => setImportOpen(true)}>Replace rulebook</PrimaryButton></View></View> : null}
    {processing ? <View style={styles.state}><View style={styles.stateIcon}>{row.status.toLowerCase().includes("ocr") || row.statusLabel.toLowerCase().includes("ocr") ? <ScanText color={colors.accent} size={34} /> : <RefreshCw color={colors.text} size={34} />}</View><Text style={styles.eyebrow}>{row.status.toLowerCase().includes("ocr") ? "READING IMAGE-ONLY PAGES" : "PREPARING RULEBOOK"}</Text><Text style={styles.title}>{row.statusLabel}</Text><Text style={styles.body}>{row.statusMessage}</Text><View style={styles.progress}><View style={[styles.progressFill, { width: `${Math.max(4, Math.min(100, row.progress))}%` }]} /></View><Text style={styles.percent}>{Math.round(row.progress)}%</Text><PrimaryButton secondary onPress={() => setImportOpen(true)}>Import your own PDF</PrimaryButton></View> : null}
    {failed ? <View style={styles.state}><View style={styles.stateIcon}><CircleAlert color={colors.danger} size={34} /></View><Text style={styles.eyebrow}>RULEBOOK NEEDS ATTENTION</Text><Text style={styles.title}>We could not verify a rulebook.</Text><Text style={styles.body}>{row.statusMessage}</Text><View style={styles.actions}><PrimaryButton loading={busy} onPress={nextCandidate}>Search again</PrimaryButton><PrimaryButton secondary onPress={() => setImportOpen(true)}>Import rulebook</PrimaryButton></View></View> : null}
    {review ? <View style={styles.review}><View style={styles.stateIcon}><BookOpenCheck color={colors.text} size={32} /></View><Text style={styles.eyebrow}>BEFORE YOU START</Text><Text style={styles.title}>Is this the right rulebook?</Text><Text style={styles.body}>Preview the source first. We will only index an automatically found PDF after your approval.</Text>
      <View style={styles.preview}>{row.previewPdfUrl ? <Pdf source={{ uri: row.previewPdfUrl, cache: true }} page={1} singlePage style={styles.pdf} /> : null}<Text style={styles.pageBadge}>Page 1 preview</Text></View>
      <View style={styles.sourceCard}><Text style={styles.sourceTitle}>{row.game.name}</Text><Text style={styles.sourceMeta}>{row.rulebookSource?.edition ?? "Base game"} · {row.rulebookSource?.language?.toUpperCase()}</Text><Text style={styles.sourceLabel}>{row.rulebookSource?.label}</Text></View>
      <View style={styles.actions}><PrimaryButton loading={busy} onPress={approveCandidate}>Yes, this is the right rulebook</PrimaryButton><PrimaryButton secondary loading={busy} onPress={nextCandidate}>No, try the next candidate</PrimaryButton><PrimaryButton secondary onPress={() => setImportOpen(true)}>Import my PDF instead</PrimaryButton></View>
    </View> : null}
    <ImportRulebook visible={importOpen} row={row} onClose={() => setImportOpen(false)} />
  </Screen>;
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" }, info: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  state: { flex: 1, justifyContent: "center", paddingBottom: 60, gap: 14 }, stateIcon: { width: 66, height: 66, borderRadius: radius.pill, backgroundColor: colors.surface, alignSelf: "center", alignItems: "center", justifyContent: "center", marginBottom: 4 }, eyebrow: { color: colors.accent, fontWeight: "800", fontSize: 13, letterSpacing: 1.4, textAlign: "center" }, title: { fontSize: 31, lineHeight: 38, fontWeight: "800", color: colors.text, textAlign: "center" }, body: { color: colors.muted, textAlign: "center", fontSize: 17, lineHeight: 25 }, actions: { gap: 12, marginTop: 18 },
  progress: { height: 8, borderRadius: 8, backgroundColor: colors.surface, overflow: "hidden", marginTop: 12 }, progressFill: { height: "100%", backgroundColor: colors.accent, borderRadius: 8 }, percent: { color: colors.muted, textAlign: "center", fontWeight: "600" },
  review: { gap: 14, paddingBottom: 20 }, preview: { height: 480, borderRadius: radius.medium, borderWidth: 1, borderColor: colors.border, overflow: "hidden", backgroundColor: colors.surface, marginTop: 10 }, pdf: { flex: 1, width: "100%", backgroundColor: colors.surface }, pageBadge: { position: "absolute", right: 10, bottom: 10, backgroundColor: "rgba(0,0,0,.75)", color: "#FFF", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, fontWeight: "700" },
  sourceCard: { backgroundColor: colors.surface, borderRadius: radius.medium, padding: 18 }, sourceTitle: { fontSize: 20, fontWeight: "800", color: colors.text }, sourceMeta: { color: colors.accent, fontWeight: "700", marginTop: 6 }, sourceLabel: { color: colors.muted, marginTop: 8 },
});
