import { Pinecone, type Index } from "@pinecone-database/pinecone";
import { EMBEDDING_DIM } from "./gemini";

if (!process.env.PINECONE_API_KEY) {
  console.warn("PINECONE_API_KEY is not set. Pinecone calls will fail.");
}

const PINECONE_INDEX = process.env.PINECONE_INDEX || "studybuddy";

let _client: Pinecone | null = null;
let _indexReadyPromise: Promise<Index> | null = null;

function getClient(): Pinecone {
  if (!_client) {
    _client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  }
  return _client;
}

async function ensureIndex(): Promise<Index> {
  const pc = getClient();
  const existing = await pc.listIndexes();
  const has = existing.indexes?.some((i) => i.name === PINECONE_INDEX);
  if (!has) {
    await pc.createIndex({
      name: PINECONE_INDEX,
      dimension: EMBEDDING_DIM,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: (process.env.PINECONE_CLOUD as "aws" | "gcp" | "azure") || "aws",
          region: process.env.PINECONE_REGION || "us-east-1",
        },
      },
    });
    // Wait until the index reports ready.
    for (let i = 0; i < 60; i++) {
      const desc = await pc.describeIndex(PINECONE_INDEX);
      if (desc.status?.ready) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return pc.index(PINECONE_INDEX);
}

export function getIndex(): Promise<Index> {
  if (!_indexReadyPromise) {
    _indexReadyPromise = ensureIndex();
  }
  return _indexReadyPromise;
}

export type ChunkMetadata = {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  text: string;
  page?: number;
};

export type QueryMatch = {
  id: string;
  score: number;
  metadata: ChunkMetadata;
};

export async function upsertChunks(
  vectors: Array<{ id: string; values: number[]; metadata: ChunkMetadata }>,
) {
  const index = await getIndex();
  // Pinecone recommends batches of ~100.
  for (let i = 0; i < vectors.length; i += 100) {
    const batch = vectors.slice(i, i + 100);
    await index.upsert(batch as any);
  }
}

export async function queryChunks(
  vector: number[],
  topK = 6,
  documentId?: string,
): Promise<QueryMatch[]> {
  const index = await getIndex();
  const res = await index.query({
    vector,
    topK,
    includeMetadata: true,
    filter: documentId ? { documentId: { $eq: documentId } } : undefined,
  });
  return (res.matches || []).map((m) => ({
    id: m.id,
    score: m.score ?? 0,
    metadata: m.metadata as unknown as ChunkMetadata,
  }));
}

export async function deleteDocument(documentId: string) {
  const index = await getIndex();
  // Pinecone serverless requires deleting by id list, not metadata filter.
  // We page through ids via listPaginated.
  let token: string | undefined = undefined;
  do {
    const page: any = await (index as any).listPaginated({
      prefix: `${documentId}#`,
      paginationToken: token,
    });
    const ids: string[] = (page.vectors || []).map((v: any) => v.id);
    if (ids.length > 0) {
      await index.deleteMany(ids);
    }
    token = page.pagination?.next;
  } while (token);
}
