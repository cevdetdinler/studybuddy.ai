import {
  GoogleGenerativeAI,
  TaskType,
  type EmbedContentRequest,
} from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY is not set. API routes will fail until it is.");
}

export const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIM = 768;
export const CHAT_MODEL = "gemini-2.5-flash";

export async function embed(
  texts: string[],
  taskType: TaskType = TaskType.RETRIEVAL_DOCUMENT,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const model = gemini.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.batchEmbedContents({
    requests: texts.map(
      (text) =>
        ({
          content: { role: "user", parts: [{ text }] },
          taskType,
          // supported by the API but missing from the SDK's request types
          outputDimensionality: EMBEDDING_DIM,
        }) as EmbedContentRequest,
    ),
  });
  return result.embeddings.map((e) => e.values);
}

export async function embedOne(
  text: string,
  taskType: TaskType = TaskType.RETRIEVAL_QUERY,
): Promise<number[]> {
  const model = gemini.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent({
    content: { role: "user", parts: [{ text }] },
    taskType,
    // supported by the API but missing from the SDK's request types
    outputDimensionality: EMBEDDING_DIM,
  } as EmbedContentRequest);
  return result.embedding.values;
}

// Shown to the user whenever Gemini is overloaded / rate-limited (503 / 429)
// instead of leaking the raw SDK error string.
export const HIGH_DEMAND_MESSAGE =
  "Our services are experiencing a high spike in demand right now. This is usually temporary — please try again in a few moments.";

/** True when the error is a transient Gemini overload / rate-limit (503 / 429). */
export function isOverloadedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const status =
    (err as any)?.status ??
    (err as any)?.statusCode ??
    (err as any)?.response?.status;
  if (status === 503 || status === 429) return true;
  return /\b(503|429)\b|service unavailable|overloaded|high demand|too many requests|rate.?limit|temporarily unavailable|please try again later/i.test(
    message,
  );
}

/**
 * Maps any error thrown by a Gemini call to a user-facing `{ status, message }`.
 * Overload / rate-limit errors get a friendly "high demand" message and a 503;
 * everything else falls back to the route's generic message and a 500.
 */
export function resolveGeminiError(
  err: unknown,
  fallback: string,
): { status: number; message: string } {
  if (isOverloadedError(err)) {
    return { status: 503, message: HIGH_DEMAND_MESSAGE };
  }
  const message = err instanceof Error ? err.message : String(err ?? "");
  return { status: 500, message: message || fallback };
}

export type GeminiMessage = { role: "user" | "model"; parts: { text: string }[] };

export function toGeminiHistory(
  messages: { role: "user" | "assistant"; content: string }[],
): GeminiMessage[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}
