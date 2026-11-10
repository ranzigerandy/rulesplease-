import { MascotLoading } from "@/components/mascot-loading";
import { api } from "@rulesplease/shared";
import { useMutation } from "convex/react";
import { Bell, Bot, ExternalLink, FileText, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { PrimaryButton, Screen } from "@/components/ui";
import { colors, radius } from "@/constants/design";

const APP_URL = "https://app.rulesplease.com";

export default function ConsentScreen() {
  const accept = useMutation(api.compliance.acceptAiConsent);
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try { await accept({}); } finally { setBusy(false); }
  };
  return <Screen contentStyle={styles.screen}>
    <View style={styles.badge}><ShieldCheck color={colors.accent} size={28} /></View>
    <Text style={styles.eyebrow}>YOUR DATA & AI</Text>
    <Text style={styles.title}>Know where your rulebook goes.</Text>
    <Text style={styles.lead}>Rules Please uses trusted services to find answers and show the exact source page. Please review this before continuing.</Text>
    <View style={styles.cards}>
      <View style={styles.card}><FileText color={colors.text} size={22} /><View style={styles.copy}><Text style={styles.cardTitle}>Rulebooks and questions</Text><Text style={styles.body}>PDFs and questions are stored in Convex and processed by the Railway worker.</Text></View></View>
      <View style={styles.card}><Bot color={colors.text} size={22} /><View style={styles.copy}><Text style={styles.cardTitle}>OpenAI processing</Text><Text style={styles.body}>Relevant text and image-only pages can be sent to OpenAI for OCR, embeddings and answers.</Text></View></View>
      <View style={styles.card}><Bell color={colors.text} size={22} /><View style={styles.copy}><Text style={styles.cardTitle}>Optional notifications</Text><Text style={styles.body}>If you opt in, an Expo push token is stored in Convex so Expo can notify you when lengthy processing finishes.</Text></View></View>
      <View style={styles.card}><ShieldCheck color={colors.text} size={22} /><View style={styles.copy}><Text style={styles.cardTitle}>You stay in control</Text><Text style={styles.body}>AI can be wrong. Check citations and the original page. You can withdraw consent in Settings.</Text></View></View>
    </View>
    <Pressable onPress={() => Linking.openURL(`${APP_URL}/privacy`)} style={styles.link}><Text style={styles.linkText}>Read the Privacy Policy</Text><ExternalLink color={colors.accent} size={14} /></Pressable>
    {busy ? <MascotLoading label="Saving your privacy choice…" compact /> : null}
    <PrimaryButton loading={busy} onPress={confirm}>I agree and want to continue</PrimaryButton>
    <Text style={styles.note}>Without consent, AI search, uploads and new answers remain unavailable.</Text>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { justifyContent: "center", paddingVertical: 28 }, badge: { width: 58, height: 58, borderRadius: radius.medium, backgroundColor: "#E5F4EF", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1.4 }, title: { color: colors.text, fontSize: 34, lineHeight: 39, fontWeight: "800", marginTop: 8 }, lead: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 14 },
  cards: { gap: 10, marginVertical: 24 }, card: { flexDirection: "row", gap: 14, padding: 16, borderRadius: radius.medium, backgroundColor: colors.surface }, copy: { flex: 1 }, cardTitle: { color: colors.text, fontWeight: "800", fontSize: 16 }, body: { color: colors.muted, lineHeight: 20, marginTop: 4 },
  link: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 18 }, linkText: { color: colors.accent, fontWeight: "700" }, note: { color: colors.muted, textAlign: "center", fontSize: 12, lineHeight: 18, marginTop: 12 },
});
