import { api, type Id } from "@rulesplease/shared";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";
import { FileText, Languages, RefreshCw, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Header, PrimaryButton, Screen, thumbnailUrl } from "@/components/ui";
import { ImportRulebook } from "@/components/import-rulebook";
import { colors, radius } from "@/constants/design";
import type { LibraryRow } from "@/lib/types";

export default function RulebookInfoScreen() {
  const { libraryGameId } = useLocalSearchParams<{ libraryGameId: string }>();
  const library = useQuery(api.library.list) as LibraryRow[] | undefined;
  const row = library?.find((item) => item._id === libraryGameId as Id<"libraryGames">);
  const [importOpen, setImportOpen] = useState(false);
  if (!row?.game) return <Screen contentStyle={styles.center}><ActivityIndicator color={colors.text} /></Screen>;
  const source = row.rulebookSource;
  return <Screen><Header title="Rulebook info" coverUrl={thumbnailUrl(row.game.bggId)} />
    <Text style={styles.title}>{row.game.name}</Text><Text style={styles.subtitle}>The exact document used for every answer in this chat.</Text>
    <View style={styles.card}><InfoRow icon={<FileText color={colors.text} size={22} />} label="Source" value={source?.label ?? "Processing"} /><InfoRow icon={<ShieldCheck color={colors.accent} size={22} />} label="Edition" value={source?.edition ?? "Base game"} /><InfoRow icon={<Languages color={colors.text} size={22} />} label="Language" value={source?.language?.toUpperCase() ?? "—"} /><InfoRow icon={<RefreshCw color={colors.text} size={22} />} label="Revision" value={source?.revision ?? "Not specified"} /></View>
    <View style={styles.stats}><View style={styles.stat}><Text style={styles.statLabel}>PAGES</Text><Text style={styles.statValue}>{source?.pageCount ?? row.rulebook?.pageCount ?? "—"}</Text></View><View style={styles.stat}><Text style={styles.statLabel}>STATUS</Text><Text style={styles.statValue}>{row.statusLabel}</Text></View></View>
    <View style={styles.bottom}><PrimaryButton secondary onPress={() => setImportOpen(true)}>Replace with PDF or link</PrimaryButton></View>
    <ImportRulebook visible={importOpen} row={row} onClose={() => setImportOpen(false)} />
  </Screen>;
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <View style={styles.row}>{icon}<View style={{ flex: 1 }}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View></View>; }
const styles = StyleSheet.create({ center: { alignItems: "center", justifyContent: "center" }, title: { fontSize: 31, fontWeight: "800", color: colors.text, marginTop: 12 }, subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 8, marginBottom: 26 }, card: { backgroundColor: colors.surface, borderRadius: radius.medium, paddingHorizontal: 18 }, row: { minHeight: 78, flexDirection: "row", gap: 14, alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, rowLabel: { color: colors.muted, fontSize: 13, fontWeight: "700" }, rowValue: { color: colors.text, fontSize: 16, fontWeight: "600", marginTop: 4 }, stats: { flexDirection: "row", marginTop: 16, borderWidth: 1, borderColor: colors.border, borderRadius: radius.medium, overflow: "hidden" }, stat: { flex: 1, minHeight: 92, alignItems: "center", justifyContent: "center" }, statLabel: { color: colors.muted, fontSize: 12, fontWeight: "800" }, statValue: { color: colors.text, fontWeight: "700", marginTop: 6, textAlign: "center" }, bottom: { marginTop: 26 } });
