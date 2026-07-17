import { useSignIn, useSSO } from "@clerk/clerk-expo";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { Mail } from "lucide-react-native";
import { useState } from "react";
import { Alert, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen, PrimaryButton } from "@/components/ui";
import { colors, radius } from "@/constants/design";

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startSSOFlow } = useSSO();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [emailAddressId, setEmailAddressId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    if (!isLoaded || !signIn) return;
    setBusy(true);
    try {
      const attempt = await signIn.create({ identifier: email.trim() });
      const factor = attempt.supportedFirstFactors?.find((item) => item.strategy === "email_code");
      if (!factor || !("emailAddressId" in factor)) throw new Error("Email code sign-in is not enabled for this account.");
      await attempt.prepareFirstFactor({ strategy: "email_code", emailAddressId: factor.emailAddressId });
      setEmailAddressId(factor.emailAddressId);
      Keyboard.dismiss();
    } catch (error) { Alert.alert("Could not send code", error instanceof Error ? error.message : "Try again."); }
    finally { setBusy(false); }
  }

  async function verifyCode() {
    if (!signIn || !emailAddressId) return;
    setBusy(true);
    try {
      const result = await signIn.attemptFirstFactor({ strategy: "email_code", code: code.trim() });
      if (result.status !== "complete" || !result.createdSessionId) throw new Error("The code could not be verified.");
      await setActive?.({ session: result.createdSessionId });
    } catch (error) { Alert.alert("Invalid code", error instanceof Error ? error.message : "Try again."); }
    finally { setBusy(false); }
  }

  async function google() {
    setBusy(true);
    try {
      const result = await startSSOFlow({ strategy: "oauth_google" });
      if (result.createdSessionId) await result.setActive?.({ session: result.createdSessionId });
    } catch (error) { Alert.alert("Google sign-in failed", error instanceof Error ? error.message : "Try again."); }
    finally { setBusy(false); }
  }

  return <Screen contentStyle={styles.screen}>
    <Image source={require("@/assets/images/rulesplease-mascot.png")} style={styles.mascot} contentFit="contain" />
    <Text style={styles.title}>Rules, without the rulebook hunt.</Text>
    <Text style={styles.subtitle}>Sign in to use your shared game library on every device.</Text>
    <View style={styles.form}>
      <View style={styles.inputRow}><Mail color={colors.muted} size={20} /><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="Email address" value={email} onChangeText={setEmail} style={styles.input} editable={!emailAddressId} /></View>
      {emailAddressId ? <TextInput accessibilityLabel="Email verification code" keyboardType="number-pad" placeholder="6-digit code" value={code} onChangeText={setCode} style={styles.codeInput} /> : null}
      <PrimaryButton loading={busy} disabled={emailAddressId ? code.length < 6 : !email.includes("@")} onPress={emailAddressId ? verifyCode : sendCode}>{emailAddressId ? "Verify & sign in" : "Continue with email"}</PrimaryButton>
      <View style={styles.or}><View style={styles.line} /><Text style={styles.orText}>or</Text><View style={styles.line} /></View>
      <PrimaryButton secondary loading={busy} onPress={google}>Continue with Google</PrimaryButton>
      {emailAddressId ? <Pressable onPress={() => { setEmailAddressId(null); setCode(""); }}><Text style={styles.link}>Use another email</Text></Pressable> : null}
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { justifyContent: "center", paddingVertical: 36 }, mascot: { width: 92, height: 92, alignSelf: "center", marginBottom: 24 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: "800", color: colors.text, textAlign: "center" }, subtitle: { color: colors.muted, textAlign: "center", fontSize: 17, lineHeight: 25, marginTop: 12, marginBottom: 34 },
  form: { gap: 14 }, inputRow: { height: 58, borderRadius: radius.medium, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, gap: 10 }, input: { flex: 1, fontSize: 17, color: colors.text },
  codeInput: { height: 58, borderRadius: radius.medium, backgroundColor: colors.surface, paddingHorizontal: 18, fontSize: 21, letterSpacing: 5, textAlign: "center" }, or: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 }, line: { height: 1, backgroundColor: colors.border, flex: 1 }, orText: { color: colors.muted }, link: { color: colors.accent, textAlign: "center", fontWeight: "600", padding: 10 },
});
