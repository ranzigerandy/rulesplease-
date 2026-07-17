import { findRelevantSentence, splitHighlightedExcerpt } from "@rulesplease/shared";
import { router } from "expo-router";
import { BookOpenText, ChevronDown, ExternalLink } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "@/constants/design";
import type { CitationRecord } from "@/lib/types";

export function SourceCard({ citations, answer }: { citations: CitationRecord[]; answer: string }) {
  const [open, setOpen] = useState(false);
  if (citations.length === 0) return null;
  return <View style={[styles.card, open && styles.openCard]}>
    <Pressable accessibilityRole="button" onPress={() => setOpen((value) => !value)} style={styles.trigger}><BookOpenText color={colors.text} size={20} /><Text style={styles.count}>{citations.length} {citations.length === 1 ? "source" : "sources"}</Text><ChevronDown color={colors.text} size={19} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} /></Pressable>
    {open ? <View style={styles.sources}>{[...citations].sort((a, b) => a.order - b.order).map((citation) => <Citation key={citation._id} citation={citation} answer={answer} />)}</View> : null}
  </View>;
}

function Citation({ citation, answer }: { citation: CitationRecord; answer: string }) {
  const passage = citation.excerpt?.trim() || citation.quote.trim();
  const highlight = useMemo(() => findRelevantSentence(passage, answer), [answer, passage]);
  const parts = useMemo(() => splitHighlightedExcerpt(passage, highlight), [highlight, passage]);
  const url = citation.pdfUrl ?? citation.sourceUrl;
  return <View style={styles.citation}>
    <Text style={styles.label}>{citation.sourceLabel} · page {citation.page}</Text>
    {url ? <Pressable onPress={() => router.push({ pathname: "/rulebook", params: { url, page: String(citation.page), title: citation.sourceLabel } })} style={styles.open}><Text style={styles.openText}>Open rulebook</Text><ExternalLink color={colors.text} size={17} /></Pressable> : null}
    <Text selectable style={styles.passage}>{parts.map((part, index) => <Text key={`${index}-${part.text.slice(0, 8)}`} style={part.highlighted ? styles.highlight : undefined}>{part.text}</Text>)}</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { alignSelf: "flex-start", borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, marginTop: 14, overflow: "hidden", maxWidth: "100%" }, openCard: { alignSelf: "stretch", borderRadius: radius.medium }, trigger: { minHeight: 52, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 9 }, count: { fontSize: 15, fontWeight: "700", color: colors.text, flex: 1 }, sources: { paddingHorizontal: 18, paddingBottom: 18, gap: 18 }, citation: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, gap: 10 }, label: { color: colors.muted, fontWeight: "600", lineHeight: 20 }, open: { flexDirection: "row", alignItems: "center", gap: 7 }, openText: { color: colors.text, fontWeight: "800" }, passage: { color: "#343434", fontSize: 16, lineHeight: 25 }, highlight: { fontWeight: "800", color: colors.text },
});
