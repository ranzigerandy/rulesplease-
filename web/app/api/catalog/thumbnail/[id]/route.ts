import { NextRequest } from "next/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return new Response(null, { status: 400 });

  const legacyUrl = process.env.LEGACY_API_URL ?? "http://localhost:4173";
  const response = await fetch(`${legacyUrl}/api/games/${id}/thumbnail`, {
    cache: "force-cache",
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok || response.status === 204) return new Response(null, { status: 404 });
  const image = await response.arrayBuffer();
  return new Response(image, {
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=2592000, immutable",
    },
  });
}
