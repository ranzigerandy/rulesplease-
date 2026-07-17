import { api, type Id } from "@rulesplease/shared";
import { useLocalSearchParams } from "expo-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { Send } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header, thumbnailUrl } from "@/components/ui";
import { SourceCard } from "@/components/source-card";
import { colors, maxContentWidth, radius } from "@/constants/design";
import type { ChatMessage, CitationRecord, LibraryRow } from "@/lib/types";

function messageText(message: ChatMessage) { return message.text ?? message.parts?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("") ?? ""; }

export default function ChatScreen() {
  const { libraryGameId } = useLocalSearchParams<{ libraryGameId: string }>();
  const id = libraryGameId as Id<"libraryGames">;
  const library = useQuery(api.library.list) as LibraryRow[] | undefined;
  const row = library?.find((item) => item._id === id);
  const existingThread = useQuery(api.chat.getThreadForGame, { libraryGameId: id }) as { _id: Id<"chatThreads"> } | null | undefined;
  const createThread = useMutation(api.chat.getOrCreateThread);
  const ask = useAction(api.chat.ask);
  const [threadId, setThreadId] = useState<Id<"chatThreads"> | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  useEffect(() => {
    if (existingThread === null && !threadId) createThread({ libraryGameId: id }).then(setThreadId).catch((error) => Alert.alert("Could not open chat", String(error)));
  }, [createThread, existingThread, id, threadId]);
  const activeThreadId = threadId ?? existingThread?._id ?? null;
  const messagesResult = useQuery(api.chat.listMessages, activeThreadId ? { chatThreadId: activeThreadId } : "skip") as { page?: ChatMessage[] } | undefined;
  const citations = useQuery(api.chat.listCitations, activeThreadId ? { chatThreadId: activeThreadId } : "skip") as CitationRecord[] | undefined;
  const messages = messagesResult?.page ?? [];
  const citationMap = useMemo(() => {
    const map = new Map<string, CitationRecord[]>();
    for (const citation of citations ?? []) map.set(citation.agentMessageId, [...(map.get(citation.agentMessageId) ?? []), citation]);
    return map;
  }, [citations]);

  async function submit() {
    const text = question.trim();
    if (!text || !activeThreadId || asking) return;
    setQuestion(""); setAsking(true);
    try { await ask({ chatThreadId: activeThreadId, libraryGameId: id, question: text }); }
    catch (error) { setQuestion(text); Alert.alert("Could not answer", error instanceof Error ? error.message : "Try again."); }
    finally { setAsking(false); }
  }

  return <SafeAreaView style={styles.safe} edges={["top", "bottom"]}><KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}><View style={styles.content}>
    <Header title={row?.game?.name ?? "Rules chat"} coverUrl={row?.game ? thumbnailUrl(row.game.bggId) : undefined} />
    <FlatList ref={listRef} data={messages} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.messages} onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })} ListEmptyComponent={<View style={styles.welcome}><Text style={styles.welcomeTitle}>Ask anything about the rules.</Text><Text style={styles.welcomeBody}>Every answer is grounded in this rulebook and includes the exact source passage.</Text></View>} renderItem={({ item }) => {
      const text = messageText(item); if (!text || item.role === "system") return null;
      const sources = citationMap.get(item.id) ?? [];
      return <View style={[styles.messageBlock, item.role === "user" && styles.userBlock]}><View style={item.role === "user" ? styles.userBubble : undefined}><Text style={styles.messageText}>{text}</Text></View>{item.role === "assistant" ? <SourceCard citations={sources} answer={text} /> : null}</View>;
    }} ListFooterComponent={asking ? <View style={styles.thinking}><ActivityIndicator color={colors.accent} /><Text style={styles.thinkingText}>Checking the rulebook…</Text></View> : null} />
    <View style={styles.composer}><TextInput accessibilityLabel="Ask about the rules" placeholder="Ask about the rules" value={question} onChangeText={setQuestion} multiline maxLength={2000} style={styles.input} onSubmitEditing={submit} blurOnSubmit={false} /><Pressable accessibilityLabel="Send question" disabled={!question.trim() || asking} onPress={submit} style={[styles.send, (!question.trim() || asking) && styles.sendDisabled]}><Send color="#FFFFFF" size={22} /></Pressable></View>
  </View></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, alignItems: "center" }, keyboard: { flex: 1, width: "100%", alignItems: "center" }, content: { flex: 1, width: "100%", maxWidth: maxContentWidth, paddingHorizontal: 18 }, messages: { flexGrow: 1, paddingTop: 8, paddingBottom: 20 }, welcome: { flex: 1, minHeight: 340, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }, welcomeTitle: { fontSize: 27, fontWeight: "800", color: colors.text, textAlign: "center" }, welcomeBody: { color: colors.muted, textAlign: "center", lineHeight: 23, marginTop: 10 },
  messageBlock: { marginVertical: 14, alignSelf: "stretch" }, userBlock: { alignItems: "flex-end" }, userBubble: { backgroundColor: colors.surface, paddingHorizontal: 18, paddingVertical: 13, borderRadius: radius.medium, maxWidth: "86%" }, messageText: { fontSize: 17, lineHeight: 26, color: colors.text }, thinking: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 16 }, thinkingText: { color: colors.muted },
  composer: { minHeight: 70, flexDirection: "row", alignItems: "flex-end", gap: 8, borderWidth: 1, borderColor: "#BDBDB8", borderRadius: radius.large, padding: 7, marginBottom: 6, backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: .08, shadowRadius: 14, elevation: 4 }, input: { flex: 1, minHeight: 52, maxHeight: 120, paddingHorizontal: 14, paddingVertical: 14, fontSize: 17, color: colors.text }, send: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.black, alignItems: "center", justifyContent: "center" }, sendDisabled: { opacity: .35 },
});
