import { NextRequest } from "next/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return new Response(null, { status: 400 });

  const legacyUrl = process.env.LEGACY_API_URL ?? "http://localhost:4173";
  let response: Response | undefined;
  try {
    response = await fetch(`${legacyUrl}/api/games/${id}/thumbnail`, {
      cache: "force-cache",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    // Production uses the direct BGG item endpoint when the local catalogue is absent.
  }

  if (!response?.ok || response.status === 204) {
    try {
      const gameResponse = await fetch(`https://api.geekdo.com/api/geekitems?objectid=${id}&objecttype=thing`, {
        cache: "force-cache",
        signal: AbortSignal.timeout(20_000),
        headers: { "User-Agent": "RulesPlease/1.0 (+https://www.rulesplease.com)" },
      });
      if (!gameResponse.ok) return new Response(null, { status: 404 });
      const item = (await gameResponse.json()).item;
      const thumbnailUrl = item?.images?.tallthumb ?? item?.images?.thumb ?? item?.images?.imageurl ?? item?.images?.original;
      if (!thumbnailUrl) return new Response(null, { status: 404 });
      response = await fetch(thumbnailUrl, { cache: "force-cache", signal: AbortSignal.timeout(20_000) });
    } catch {
      return new Response(null, { status: 404 });
    }
  }

  if (!response?.ok || response.status === 204) return new Response(null, { status: 404 });
  const image = await response.arrayBuffer();
  return new Response(image, {
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=2592000, immutable",
    },
  });
}
