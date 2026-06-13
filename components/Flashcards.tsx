"use client";

import { Loader2, RotateCw, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useState } from "react";

type Card = { front: string; back: string };

export function Flashcards({ documentId }: { documentId: string | null }) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(8);
  const [cards, setCards] = useState<Card[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setCards([]);
    setIdx(0);
    setFlipped(false);
    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, documentId, count }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed");
      setCards(j.flashcards || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function next() {
    setFlipped(false);
    setIdx((i) => Math.min(i + 1, cards.length - 1));
  }
  function prev() {
    setFlipped(false);
    setIdx((i) => Math.max(i - 1, 0));
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-1">Flashcards</h2>
      <p className="text-sm text-muted mb-5">
        Generate spaced-repetition cards from your notes.
      </p>

      <div className="flex flex-wrap gap-2 items-center mb-6">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic focus (optional, e.g. 'cell biology')"
          className="flex-1 min-w-[200px] bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <select
          value={count}
          onChange={(e) => setCount(parseInt(e.target.value))}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm"
        >
          {[5, 8, 10, 15, 20].map((n) => (
            <option key={n} value={n}>
              {n} cards
            </option>
          ))}
        </select>
        <button
          onClick={generate}
          disabled={loading}
          className="bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Generate
        </button>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {cards.length > 0 && (
        <div>
          <div
            className={`flip-card ${flipped ? "flipped" : ""} relative w-full h-80 cursor-pointer mb-4`}
            onClick={() => setFlipped((f) => !f)}
          >
            <div className="flip-card-inner">
              <div className="flip-card-front bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <span className="text-xs uppercase tracking-wider text-muted mb-3">
                  Question · {idx + 1} / {cards.length}
                </span>
                <p className="text-xl font-medium">{cards[idx].front}</p>
                <p className="text-xs text-muted mt-6 flex items-center gap-1">
                  <RotateCw className="w-3 h-3" /> Click to flip
                </p>
              </div>
              <div className="flip-card-back bg-accent/10 border border-accent/40 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <span className="text-xs uppercase tracking-wider text-accent mb-3">
                  Answer
                </span>
                <p className="text-base leading-relaxed">{cards[idx].back}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={prev}
              disabled={idx === 0}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-card border border-border disabled:opacity-30 hover:bg-border text-sm"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <div className="flex gap-1">
              {cards.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setIdx(i);
                    setFlipped(false);
                  }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === idx ? "bg-accent" : "bg-border"
                  }`}
                  aria-label={`Card ${i + 1}`}
                />
              ))}
            </div>
            <button
              onClick={next}
              disabled={idx === cards.length - 1}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-card border border-border disabled:opacity-30 hover:bg-border text-sm"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {!loading && cards.length === 0 && (
        <p className="text-sm text-muted text-center py-12">
          Hit Generate to create flashcards from your notes.
        </p>
      )}
    </div>
  );
}
