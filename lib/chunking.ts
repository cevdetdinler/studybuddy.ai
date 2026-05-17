const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_OVERLAP = 200;

export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_OVERLAP,
): string[] {
  const cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n\s*\n/);
  const chunks: string[] = [];
  let buffer = "";

  for (const p of paragraphs) {
    if ((buffer + "\n\n" + p).length <= chunkSize) {
      buffer = buffer ? buffer + "\n\n" + p : p;
      continue;
    }

    if (buffer) {
      chunks.push(buffer);
      buffer = buffer.slice(Math.max(0, buffer.length - overlap));
    }

    if (p.length <= chunkSize) {
      buffer = buffer ? buffer + "\n\n" + p : p;
    } else {
      let i = 0;
      while (i < p.length) {
        const piece = p.slice(i, i + chunkSize);
        chunks.push(piece);
        if (i + chunkSize >= p.length) break;
        i += chunkSize - overlap;
      }
      buffer = "";
    }
  }

  if (buffer) chunks.push(buffer);
  return chunks.filter((c) => c.trim().length > 0);
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
