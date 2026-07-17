import { NextRequest } from "next/server";
import { GET as getThumbnail } from "../../../../catalog/thumbnail/[id]/route";

export async function GET(request: NextRequest, context: { params: Promise<{ bggId: string }> }) {
  const { bggId } = await context.params;
  return getThumbnail(request, { params: Promise.resolve({ id: bggId }) });
}
