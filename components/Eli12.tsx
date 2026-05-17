"use client";

import { Loader2, Sparkles, Baby } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";

export function Eli12({ documentId }: { documentId: string | null }) {
  const [topic, setTopic] = useState("");
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!topic.trim()) return;
    setError(null);
    setOutput("");
    setStreaming(true);
    try {
      const res = await fetch("/api/eli12", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, documentId }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Request failed");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setOutput((s) => s + decoder.decode(value, { stream: true }));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
        <Baby className="w-5 h-5 text-accent" /> Explain Like I'm 12
      </h2>
      <p className="text-sm text-muted mb-5">
        Get a plain-English explanation grounded in your notes.
      </p>

      <div className="flex gap-2 mb-5">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="What concept do you want explained?"
          className="flex-1 bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <button
          onClick={run}
          disabled={streaming || !topic.trim()}
          className="bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg px-4 py-2.5 text-sm font-medium flex items-center gap-2"
        >
          {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Explain
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {output && (
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="prose-chat text-sm leading-relaxed">
            <ReactMarkdown>{output}</ReactMarkdown>
          </div>
        </div>
      )}

      {!output && !streaming && !error && (
        <p className="text-sm text-muted text-center py-12">
          Type a topic and we'll explain it like you're 12.
        </p>
      )}
    </div>
  );
}
