import { LoadingScreen } from "@/components/mascot-loading";
import { useAuth } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen label="Opening Rules Please!…" />;
  return <Redirect href={isSignedIn ? "/home" : "/sign-in"} />;
}
