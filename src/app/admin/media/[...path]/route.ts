import { NextResponse, type NextRequest } from "next/server";
import { devStoreAllowed } from "@/lib/admin/env";
import { devMediaTable } from "@/lib/admin/media";

/** DEVELOPMENT-ONLY: serves images held by the in-memory media store. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (!devStoreAllowed()) return new NextResponse("Not found", { status: 404 });
  const { path } = await params;
  const entry = devMediaTable().get(path.join("/"));
  if (!entry) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(entry.bytes), {
    headers: { "Content-Type": entry.contentType, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
