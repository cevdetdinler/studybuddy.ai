import { NextRequest } from "next/server";
import { gemini, CHAT_MODEL, embedOne, toGeminiHistory } from "@/lib/gemini";
import { queryChunks } from "@/lib/pinecone";
import { CHAT_SYSTEM, formatContext } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  try {
    const { messages, documentId } = (await req.json()) as {
      messages: ChatMessage[];
      documentId?: string;
    };

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages" }), {
        status: 400,
      });
    }

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return new Response(JSON.stringify({ error: "No user message" }), {
        status: 400,
      });
    }

    const qVec = await embedOne(lastUser.content);
    const matches = await queryChunks(qVec, 6, documentId);
    const context = formatContext(matches);

    const systemInstruction = context
      ? `${CHAT_SYSTEM}\n\nSource material:\n\n${context}`
      : `${CHAT_SYSTEM}\n\nNo source material was retrieved. Tell the user to upload notes first.`;

    const model = gemini.getGenerativeModel({
      model: CHAT_MODEL,
      systemInstruction,
      generationConfig: { temperature: 0.2 },
    });

    // Gemini requires the conversation to start with a "user" turn. If the
    // first message is somehow not user, drop until we find one.
    const history = toGeminiHistory(messages);
    const result = await model.generateContentStream({ contents: history });

    const encoder = new TextEncoder();
    const sourcesPayload = matches.map((m) => ({
      id: m.id,
      score: m.score,
      documentName: m.metadata.documentName,
      chunkIndex: m.metadata.chunkIndex,
      preview: m.metadata.text.slice(0, 240),
    }));

    const readable = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            `__SOURCES__${JSON.stringify(sourcesPayload)}__END_SOURCES__`,
          ),
        );
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) controller.enqueue(encoder.encode(text));
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
    console.error("chat error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Chat failed" }), {
      status: 500,
    });
  }
}
