import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const clerkKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!convexUrl || !clerkKey) throw new Error("Set EXPO_PUBLIC_CONVEX_URL and EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in mobile/.env");
const convex = new ConvexReactClient(convexUrl);

function useClerkConvexAuth() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const fetchAccessToken = useCallback(({ forceRefreshToken }: { forceRefreshToken: boolean }) => getToken({ template: "convex", skipCache: forceRefreshToken }), [getToken]);
  return useMemo(() => ({ isLoading: !isLoaded, isAuthenticated: Boolean(isSignedIn), fetchAccessToken }), [fetchAccessToken, isLoaded, isSignedIn]);
}

export function AppProviders({ children }: { children: ReactNode }) {
  return <ClerkProvider publishableKey={clerkKey} tokenCache={tokenCache}><ConvexProviderWithAuth client={convex} useAuth={useClerkConvexAuth}>{children}</ConvexProviderWithAuth></ClerkProvider>;
}
