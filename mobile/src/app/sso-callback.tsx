import { LoadingScreen } from "@/components/mascot-loading";
import { useAuth } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";

/**
 * Clerk completes Google sign-in by opening `rulesplease://sso-callback`.
 * It must be a real Expo Router screen so the native deep link never lands
 * on Router's "Unmatched Route" fallback.
 */
export default function SsoCallback() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return <LoadingScreen label="Finishing sign-in…" />;
  return <Redirect href={isSignedIn ? "/home" : "/sign-in"} />;
}
