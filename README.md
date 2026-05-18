<img width="1913" height="940" alt="image" src="https://github.com/user-attachments/assets/e0f3a008-bfb5-4b5e-994e-92ac0e774f9b" />
<img width="1908" height="789" alt="image" src="https://github.com/user-attachments/assets/6d11ca99-d87c-4db6-a523-2efe58eefbe5" />




# StudyBuddy AI

Upload lecture notes / PDFs and chat with them. A full-stack RAG agent built on Next.js, Google Gemini, and Pinecone — deployable to Vercel in minutes.

**Features**
- **Chat** with your notes (streaming, with inline source citations)
- **Semantic search** across uploaded documents
- **Flashcard generation** with flip animation
- **Quiz mode** — multiple choice, scored, with explanations
- **Explain Like I'm 12** — plain-English breakdowns

**Stack**
- Next.js 14 (App Router, server actions / route handlers)
- Google Generative AI SDK (`text-embedding-004` + `gemini-2.0-flash`)
- Pinecone (serverless vector DB, auto-created on first run)
- Tailwind CSS, Lucide icons
- `pdf-parse` for PDF extraction

---

## Architecture

```
┌──────────────────────────┐         ┌──────────────────────────┐
│  Next.js client (React)  │ ◄─────► │  Route handlers (Node)   │
│  - Upload                │  fetch  │  /api/upload  parse+embed│
│  - Chat (streaming)      │         │  /api/chat    RAG stream │
│  - Search / Flash / Quiz │         │  /api/search  top-k      │
│  - ELI12 (streaming)     │         │  /api/flashcards JSON    │
└──────────────────────────┘         │  /api/quiz       JSON    │
                                     │  /api/eli12   stream     │
                                     │  /api/documents list/del │
                                     └──────────┬───────────────┘
                                                │
                            ┌───────────────────┼───────────────────┐
                            ▼                                       ▼
                   ┌─────────────────┐                    ┌──────────────────┐
                   │ Gemini          │                    │ Pinecone         │
                   │ embeddings +    │                    │ serverless index │
                   │ generateContent │                    │ (768-dim cosine) │
                   └─────────────────┘                    └──────────────────┘
```

### How a query flows

1. User asks a question in **Chat**.
2. The route handler embeds the question with `text-embedding-004` (using `RETRIEVAL_QUERY` task type for better retrieval quality).
3. We query Pinecone for the top-6 most similar chunks (optionally filtered to a single document).
4. The chunks are stitched into the model's `systemInstruction` as labeled sources.
5. `gemini-2.0-flash` streams the answer back; the UI renders markdown and a collapsible "sources" section.

Quiz / flashcard / ELI12 follow the same RAG pattern but with different system prompts and a JSON response format where structure matters.

---

## Quick start (local)

### 1. Prereqs

- Node 18.18+ (or 20+)
- A Gemini API key (free tier is generous) — https://aistudio.google.com/apikey
- A Pinecone account (free tier works) — https://app.pinecone.io/

### 2. Install + env

```bash
cd studybuddy-ai
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

```
GEMINI_API_KEY=...
PINECONE_API_KEY=...
PINECONE_INDEX=studybuddy
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1
```

The index is **auto-created** on the first request — you don't need to create it in the Pinecone dashboard. It uses **768 dimensions** (matching `gemini-embedding-001` at `outputDimensionality: 768`) and cosine similarity.

> **Dimension mismatch?** Pinecone indexes can't change dimension after creation. If your `studybuddy` index already exists at a different dim, either delete it in the Pinecone dashboard or pick a new `PINECONE_INDEX` name.

### 3. Run

```bash
npm run dev
```

Open http://localhost:3000. Upload a PDF, then chat / search / quiz away.

---

## Deploying to Vercel

### One-click via CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts. Then add the env vars:

```bash
vercel env add GEMINI_API_KEY
vercel env add PINECONE_API_KEY
vercel env add PINECONE_INDEX
vercel env add PINECONE_CLOUD
vercel env add PINECONE_REGION
vercel --prod
```

### Or via the dashboard

1. Push this repo to GitHub.
2. Go to https://vercel.com/new and import it.
3. Add the env vars from `.env.example` under **Settings → Environment Variables**.
4. Deploy.

`vercel.json` already extends function timeouts to 60s for the heavier routes (upload, chat, etc).

> **Hobby plan note:** Max function duration is 60s. Very large PDFs may need to be split. If you upgrade to Pro, bump the values in `vercel.json` up to 300.

---

## Project layout

```
studybuddy-ai/
├── app/
│   ├── api/
│   │   ├── chat/route.ts          # RAG chat, streaming
│   │   ├── documents/route.ts     # list + delete
│   │   ├── eli12/route.ts         # ELI12, streaming
│   │   ├── flashcards/route.ts    # JSON flashcards
│   │   ├── quiz/route.ts          # JSON quiz
│   │   ├── search/route.ts        # raw semantic search
│   │   └── upload/route.ts        # parse + chunk + embed + upsert
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                   # main tabbed UI
├── components/
│   ├── Chat.tsx
│   ├── Eli12.tsx
│   ├── Flashcards.tsx
│   ├── Quiz.tsx
│   ├── SearchPanel.tsx
│   └── Sidebar.tsx
├── lib/
│   ├── chunking.ts                # paragraph-aware splitter with overlap
│   ├── gemini.ts                  # Gemini client + embed helpers
│   ├── pinecone.ts                # Pinecone client + index auto-create
│   └── prompts.ts                 # system prompts per feature
├── .env.example
├── next.config.js
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vercel.json
```

---

## Key design decisions

- **No database besides Pinecone.** Document metadata is stored as Pinecone vector metadata; the document list is derived from `index.listPaginated`. Keeps the stack to two services.
- **Streaming responses** for Chat and ELI12 using a raw `ReadableStream` over Gemini's `generateContentStream`. The Chat route prepends a `__SOURCES__...__END_SOURCES__` JSON frame so the UI gets citations without a second round-trip.
- **JSON response format** (`responseMimeType: "application/json"`) for flashcards and quiz, so the UI can render structured cards safely.
- **Task-typed embeddings:** documents are embedded with `RETRIEVAL_DOCUMENT`, queries with `RETRIEVAL_QUERY` — Gemini optimizes the vector space for retrieval when you tell it the intent.
- **Per-document scoping** is implemented as a Pinecone metadata filter (`{ documentId: { $eq: ... } }`).
- **Chunking** is paragraph-aware with character-window fallback for long paragraphs, with 200-char overlap so context isn't lost on chunk boundaries.

---

## Common tweaks

- **Bigger model:** swap `CHAT_MODEL` in `lib/gemini.ts` to `gemini-2.5-pro` for better answers (slower, costlier on paid tiers).
- **More chunks per query:** bump `topK` in `app/api/chat/route.ts` (default 6).
- **Different chunk size:** `lib/chunking.ts` — defaults are 1000 chars with 200 overlap.
- **Use Claude instead:** rewrite `lib/gemini.ts` against the `@anthropic-ai/sdk` package and update `EMBEDDING_DIM` to match the new embedding model.

---

## Limitations

- PDFs with scanned (image-only) pages won't extract text — you'd need an OCR step (e.g. `tesseract.js` or Google Document AI).
- No auth — anyone hitting your deployed URL can upload and query. Add NextAuth / Clerk before exposing publicly.
- No multi-user isolation — all uploads share the same Pinecone index. For per-user data, add a `userId` filter to metadata and to every query.

---

## License

MIT. Have fun.
