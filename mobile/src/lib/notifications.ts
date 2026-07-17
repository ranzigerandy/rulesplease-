import { api } from "@rulesplease/shared";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { useMutation } from "convex/react";
import { Platform } from "react-native";

const DEVICE_KEY = "rulesplease.device-id";

export function usePushRegistration() {
  const register = useMutation(api.notifications.registerToken);
  return async () => {
    if (!Device.isDevice || Platform.OS === "web") return false;
    if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("rulebooks", { name: "Rulebooks", importance: Notifications.AndroidImportance.DEFAULT });
    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
    if (!permission.granted) return false;
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) throw new Error("EXPO_PUBLIC_EAS_PROJECT_ID is missing");
    let deviceId = await SecureStore.getItemAsync(DEVICE_KEY);
    if (!deviceId) {
      deviceId = Crypto.randomUUID();
      await SecureStore.setItemAsync(DEVICE_KEY, deviceId);
    }
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await register({ expoPushToken: data, deviceId, platform: Platform.OS === "ios" ? "ios" : "android" });
    return true;
  };
}
