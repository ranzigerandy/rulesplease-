import { TeachingPanel } from "@/components/TeachingPanel";
import type { Id } from "@/convex/_generated/dataModel";

export default async function LearnPage({
  params,
}: {
  params: Promise<{ libraryGameId: string }>;
}) {
  const { libraryGameId } = await params;
  return <TeachingPanel libraryGameId={libraryGameId as Id<"libraryGames">} />;
}
