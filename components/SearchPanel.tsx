"use client";

import { Search as SearchIcon, Loader2 } from "lucide-react";
import { useState } from "react";

type Result = {
  id: string;
  score: number;
  documentName: string;
  chunkIndex: number;
  text: string;
};

export function SearchPanel({ documentId }: { documentId: string | null }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, documentId, topK: 10 }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Search failed");
      setResults(j.results || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-1">Semantic search</h2>
      <p className="text-sm text-muted mb-5">
        Find passages by meaning, not just keywords.
      </p>

      <div className="flex gap-2 mb-6">
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="e.g. how does mitosis differ from meiosis?"
            className="w-full bg-card border border-border rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>
        <button
          onClick={run}
          disabled={loading || !q.trim()}
          className="bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg px-4 py-2.5 text-sm font-medium"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="space-y-3">
        {results.map((r, i) => (
          <div key={r.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted">
                #{i + 1} · {r.documentName} · chunk {r.chunkIndex}
              </span>
              <span className="text-xs font-mono text-accent">
                {r.score.toFixed(3)}
              </span>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.text}</p>
          </div>
        ))}
        {!loading && q && results.length === 0 && !error && (
          <p className="text-sm text-muted text-center py-8">
            No results. Try a different query or upload more notes.
          </p>
        )}
      </div>
    </div>
  );
}
