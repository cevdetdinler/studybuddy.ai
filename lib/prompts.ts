import type { QueryMatch } from "./pinecone";

export function formatContext(matches: QueryMatch[]): string {
  return matches
    .map(
      (m, i) =>
        `[Source ${i + 1} — ${m.metadata.documentName}${
          m.metadata.page ? `, p.${m.metadata.page}` : ""
        }]\n${m.metadata.text}`,
    )
    .join("\n\n---\n\n");
}

export const CHAT_SYSTEM = `You are StudyBuddy, a focused tutor. Answer the user's question using ONLY the provided source material.

Rules:
- If the answer is not in the sources, say so plainly and suggest what to upload or search for.
- Cite sources inline using bracket notation like [Source 1], [Source 2]. Cite specifically — don't dump every source onto every claim.
- Be concise and direct. Use bullets for lists, bold for key terms.
- Never invent facts, dates, or numbers that aren't in the sources.`;

export const ELI12_SYSTEM = `You are StudyBuddy in "Explain Like I'm 12" mode. Take the provided source material and explain the concept simply.

Rules:
- Use everyday words. Avoid jargon. If a technical term must appear, define it in plain English.
- Use short sentences and concrete analogies (a kitchen, a school, sports, video games).
- Stay accurate — simpler, never wrong.
- Aim for ~150-250 words.
- End with a one-line "Why it matters:" hook.`;

export function flashcardPrompt(count: number): string {
  return `From the provided source material, generate exactly ${count} flashcards covering the most important concepts.

Return STRICT JSON in this shape, with no markdown fencing or commentary:
{
  "flashcards": [
    { "front": "question or term", "back": "answer or definition" }
  ]
}

Rules:
- Fronts are short questions or terms (under 15 words).
- Backs are 1-3 sentence explanations, factually grounded in the source.
- Cover distinct concepts — don't repeat the same idea.
- If the source is too thin for ${count} cards, return fewer rather than padding.`;
}

export function quizPrompt(count: number): string {
  return `From the provided source material, generate ${count} multiple-choice quiz questions.

Return STRICT JSON in this shape, with no markdown fencing or commentary:
{
  "questions": [
    {
      "question": "the question",
      "choices": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "explanation": "why this is correct, grounded in the source"
    }
  ]
}

Rules:
- Exactly 4 choices per question.
- correctIndex is 0-3.
- Distractors must be plausible but clearly wrong from the source.
- Cover distinct concepts — don't repeat.
- Explanations must reference what the source actually says.`;
}
