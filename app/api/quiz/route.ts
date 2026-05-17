import { NextRequest, NextResponse } from "next/server";
import { embedOne, gemini, CHAT_MODEL } from "@/lib/gemini";
import { queryChunks } from "@/lib/pinecone";
import { formatContext, quizPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { topic, documentId, count } = (await req.json()) as {
      topic?: string;
      documentId?: string;
      count?: number;
    };

    const n = Math.min(Math.max(count ?? 5, 3), 15);
    const seed = topic?.trim() || "important concepts to test understanding";
    const qVec = await embedOne(seed);
    const matches = await queryChunks(qVec, 8, documentId);

    if (matches.length === 0) {
      return NextResponse.json(
        { error: "No source material found. Upload notes first." },
        { status: 400 },
      );
    }

    const context = formatContext(matches);
    const model = gemini.getGenerativeModel({
      model: CHAT_MODEL,
      systemInstruction: quizPrompt(n),
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: `Source material:\n\n${context}\n\nTopic focus: ${seed}` },
          ],
        },
      ],
    });

    const raw = result.response.text() || "{}";
    const parsed = JSON.parse(raw);
    return NextResponse.json({
      questions: parsed.questions || [],
      sources: matches.map((m) => ({
        documentName: m.metadata.documentName,
        chunkIndex: m.metadata.chunkIndex,
      })),
    });
  } catch (err: any) {
    console.error("quiz error:", err);
    return NextResponse.json(
      { error: err?.message || "Quiz generation failed" },
      { status: 500 },
    );
  }
}
