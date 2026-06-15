import { NextRequest, NextResponse } from "next/server";
import { embedOne, resolveGeminiError } from "@/lib/gemini";
import { queryChunks } from "@/lib/pinecone";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { query, documentId, topK } = (await req.json()) as {
      query: string;
      documentId?: string;
      topK?: number;
    };
    if (!query?.trim()) {
      return NextResponse.json({ error: "Empty query" }, { status: 400 });
    }
    const vec = await embedOne(query);
    const matches = await queryChunks(vec, topK ?? 10, documentId);
    return NextResponse.json({
      results: matches.map((m) => ({
        id: m.id,
        score: m.score,
        documentName: m.metadata.documentName,
        chunkIndex: m.metadata.chunkIndex,
        text: m.metadata.text,
      })),
    });
  } catch (err: any) {
    console.error("search error:", err);
    const { status, message } = resolveGeminiError(err, "Search failed");
    return NextResponse.json({ error: message }, { status });
  }
}
