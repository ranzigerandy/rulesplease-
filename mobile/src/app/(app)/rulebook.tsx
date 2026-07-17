import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Pdf from "react-native-pdf";
import { Header, Screen } from "@/components/ui";
import { colors } from "@/constants/design";

export default function RulebookViewerScreen() {
  const params = useLocalSearchParams<{ url: string; page?: string; title?: string }>();
  const initialPage = Math.max(1, Number(params.page ?? 1));
  const [page, setPage] = useState(initialPage);
  return <Screen scroll={false} contentStyle={styles.screen}><Header title={params.title ?? "Rulebook"} /><View style={styles.viewer}><Pdf source={{ uri: params.url, cache: true }} page={initialPage} onPageChanged={setPage} enablePaging style={styles.pdf} /></View><Text style={styles.page}>Page {page}</Text></Screen>;
}
const styles = StyleSheet.create({ screen: { paddingBottom: 8 }, viewer: { flex: 1, overflow: "hidden", borderRadius: 16, backgroundColor: colors.surface }, pdf: { flex: 1, width: "100%", backgroundColor: colors.surface }, page: { textAlign: "center", paddingVertical: 10, color: colors.muted, fontWeight: "700" } });
