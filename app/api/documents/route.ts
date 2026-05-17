import { NextRequest, NextResponse } from "next/server";
import { deleteDocument, getIndex } from "@/lib/pinecone";

export const runtime = "nodejs";

export async function GET() {
  try {
    const index = await getIndex();
    const seen = new Map<string, { documentId: string; documentName: string; chunks: number }>();

    let token: string | undefined = undefined;
    let pages = 0;
    do {
      const page: any = await (index as any).listPaginated({ paginationToken: token });
      const ids: string[] = (page.vectors || []).map((v: any) => v.id);
      if (ids.length > 0) {
        const fetched: any = await index.fetch(ids);
        const records = fetched.records || fetched.vectors || {};
        for (const id of Object.keys(records)) {
          const meta = records[id]?.metadata;
          if (!meta?.documentId) continue;
          const prev = seen.get(meta.documentId);
          seen.set(meta.documentId, {
            documentId: meta.documentId,
            documentName: meta.documentName,
            chunks: (prev?.chunks || 0) + 1,
          });
        }
      }
      token = page.pagination?.next;
      pages += 1;
      // Safety: stop after 20 pages so we never spin.
      if (pages > 20) break;
    } while (token);

    return NextResponse.json({ documents: Array.from(seen.values()) });
  } catch (err: any) {
    console.error("documents list error:", err);
    return NextResponse.json(
      { error: err?.message || "Could not list documents" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");
    if (!documentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
    }
    await deleteDocument(documentId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("documents delete error:", err);
    return NextResponse.json(
      { error: err?.message || "Delete failed" },
      { status: 500 },
    );
  }
}
