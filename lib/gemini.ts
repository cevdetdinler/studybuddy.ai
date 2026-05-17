import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";

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
    requests: texts.map((text) => ({
      content: { role: "user", parts: [{ text }] },
      taskType,
      outputDimensionality: EMBEDDING_DIM,
    })),
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
    outputDimensionality: EMBEDDING_DIM,
  });
  return result.embedding.values;
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
