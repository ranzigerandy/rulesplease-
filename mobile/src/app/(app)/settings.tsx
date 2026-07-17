import { useAuth, useUser } from "@clerk/clerk-expo";
import { LogOut, UserRound } from "lucide-react-native";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Header, PrimaryButton, Screen } from "@/components/ui";
import { colors, radius } from "@/constants/design";

export default function SettingsScreen() {
  const { user } = useUser();
  const { signOut } = useAuth();
  return <Screen><Header title="Settings" />
    <View style={styles.account}><View style={styles.avatar}><UserRound color={colors.text} size={30} /></View><View style={{ flex: 1 }}><Text style={styles.name}>{user?.fullName ?? "Rules Please player"}</Text><Text style={styles.email}>{user?.primaryEmailAddress?.emailAddress}</Text></View></View>
    <Text style={styles.label}>APP LANGUAGE</Text><View style={styles.option}><Text style={styles.optionTitle}>English interface</Text><Text style={styles.optionBody}>Answers automatically follow the language of your question.</Text></View>
    <View style={styles.privacy}><Text style={styles.optionTitle}>Privacy</Text><Text style={styles.optionBody}>Uploaded rulebooks and image-only pages are processed by Convex, Railway and OpenAI to provide search, OCR and cited answers.</Text></View>
    <View style={styles.bottom}><PrimaryButton secondary onPress={() => Alert.alert("Sign out?", "Your library remains saved to your account.", [{ text: "Cancel", style: "cancel" }, { text: "Sign out", style: "destructive", onPress: () => signOut() }])}><LogOut size={19} color={colors.text} /> Sign out</PrimaryButton></View>
  </Screen>;
}
const styles = StyleSheet.create({ account: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surface, padding: 18, borderRadius: radius.medium }, avatar: { width: 56, height: 56, borderRadius: radius.pill, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, name: { fontSize: 18, fontWeight: "800", color: colors.text }, email: { color: colors.muted, marginTop: 4 }, label: { color: colors.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1.1, marginTop: 30, marginBottom: 10 }, option: { padding: 18, borderWidth: 1, borderColor: colors.border, borderRadius: radius.medium }, privacy: { marginTop: 14, padding: 18, borderWidth: 1, borderColor: colors.border, borderRadius: radius.medium }, optionTitle: { fontSize: 16, fontWeight: "700", color: colors.text }, optionBody: { color: colors.muted, lineHeight: 21, marginTop: 6 }, bottom: { marginTop: "auto", paddingTop: 34 } });
