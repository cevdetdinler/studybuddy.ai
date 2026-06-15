import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { chunkText } from "@/lib/chunking";
import { embed, resolveGeminiError } from "@/lib/gemini";
import { upsertChunks, type ChunkMetadata } from "@/lib/pinecone";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024; // 20MB

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_BYTES / 1024 / 1024}MB)` },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const documentId = uuid();
    const documentName = file.name;

    let rawText = "";
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default;
      const parsed = await pdfParse(buffer);
      rawText = parsed.text || "";
    } else if (
      file.type.startsWith("text/") ||
      file.name.toLowerCase().endsWith(".txt") ||
      file.name.toLowerCase().endsWith(".md")
    ) {
      rawText = buffer.toString("utf-8");
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Upload a PDF, .txt, or .md file." },
        { status: 400 },
      );
    }

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "Could not extract any text from that file." },
        { status: 400 },
      );
    }

    const chunks = chunkText(rawText);
    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "File parsed but produced no usable chunks." },
        { status: 400 },
      );
    }

    // Gemini batchEmbedContents handles up to ~100 inputs per call comfortably.
    const embeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += 64) {
      const slice = chunks.slice(i, i + 64);
      const vecs = await embed(slice);
      embeddings.push(...vecs);
    }

    const vectors = chunks.map((text, i) => ({
      id: `${documentId}#${i}`,
      values: embeddings[i],
      metadata: {
        documentId,
        documentName,
        chunkIndex: i,
        text,
      } satisfies ChunkMetadata,
    }));

    await upsertChunks(vectors);

    return NextResponse.json({
      documentId,
      documentName,
      chunks: chunks.length,
      bytes: file.size,
    });
  } catch (err: any) {
    console.error("upload error:", err);
    const { status, message } = resolveGeminiError(err, "Upload failed");
    return NextResponse.json({ error: message }, { status });
  }
}
