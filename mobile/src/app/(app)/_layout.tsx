import { api } from "@rulesplease/shared";
import { useQuery } from "convex/react";
import { Redirect, Stack, usePathname, type Href } from "expo-router";

export default function AppLayout() {
  const consent = useQuery(api.compliance.getAiConsent);
  const pathname = usePathname();
  if (consent === undefined) return null;
  const consenting = pathname.endsWith("/consent");
  if (!consent.granted && !consenting) return <Redirect href={"/consent" as Href} />;
  if (consent.granted && consenting) return <Redirect href="/home" />;
  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />;
}
