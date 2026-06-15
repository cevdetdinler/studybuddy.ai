import { NextRequest } from "next/server";
import { embedOne, gemini, CHAT_MODEL, resolveGeminiError } from "@/lib/gemini";
import { queryChunks } from "@/lib/pinecone";
import { ELI12_SYSTEM, formatContext } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { topic, documentId } = (await req.json()) as {
      topic: string;
      documentId?: string;
    };
    if (!topic?.trim()) {
      return new Response(JSON.stringify({ error: "Empty topic" }), { status: 400 });
    }

    const qVec = await embedOne(topic);
    const matches = await queryChunks(qVec, 5, documentId);

    if (matches.length === 0) {
      return new Response(
        JSON.stringify({ error: "No source material found. Upload notes first." }),
        { status: 400 },
      );
    }

    const context = formatContext(matches);
    const model = gemini.getGenerativeModel({
      model: CHAT_MODEL,
      systemInstruction: ELI12_SYSTEM,
      generationConfig: { temperature: 0.5 },
    });

    const result = await model.generateContentStream({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Explain this concept simply: "${topic}"\n\nSource material:\n\n${context}`,
            },
          ],
        },
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) controller.enqueue(encoder.encode(text));
          }
        } catch (err) {
          console.error("eli12 stream error:", err);
          const { message } = resolveGeminiError(err, "ELI12 failed");
          controller.enqueue(encoder.encode(`\n\n⚠️ ${message}`));
        }
        controller.close();
      },
    });
    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (err: any) {
    console.error("eli12 error:", err);
    const { status, message } = resolveGeminiError(err, "ELI12 failed");
    return new Response(JSON.stringify({ error: message }), { status });
  }
}
