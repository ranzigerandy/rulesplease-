import { useAuth } from "@clerk/clerk-expo";
import * as Notifications from "expo-notifications";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProviders } from "@/lib/providers";

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

function Navigation() {
  const { isLoaded, isSignedIn } = useAuth();
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const libraryGameId = response.notification.request.content.data?.libraryGameId;
    if (typeof libraryGameId === "string") {
      const kind = response.notification.request.content.data?.kind;
      router.push(kind === "completed" ? `/chat/${libraryGameId}` : `/game/${libraryGameId}`);
    }
    });
    return () => subscription.remove();
  }, []);
  if (!isLoaded) return null;
  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: "#FFFFFF" } }}>
    <Stack.Screen name="sso-callback" options={{ animation: "none" }} />
    <Stack.Protected guard={!isSignedIn}><Stack.Screen name="(auth)" /></Stack.Protected>
    <Stack.Protected guard={Boolean(isSignedIn)}><Stack.Screen name="(app)" /></Stack.Protected>
  </Stack>;
}

export default function RootLayout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><AppProviders><StatusBar style="dark" /><Navigation /></AppProviders></GestureHandlerRootView>;
}
