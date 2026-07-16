import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ results: [] });
  const legacyUrl = process.env.LEGACY_API_URL ?? "http://localhost:4173";
  try {
    const response = await fetch(
      `${legacyUrl}/api/search?q=${encodeURIComponent(query)}&baseOnly=true`,
      { cache: "no-store", signal: AbortSignal.timeout(12_000) },
    );
    if (!response.ok) throw new Error(`Local catalogue returned ${response.status}`);
    return Response.json(await response.json());
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Catalogue unavailable",
        results: [],
      },
      { status: 503 },
    );
  }
}
