"use client";

import { CheckCircle2, XCircle, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { useState } from "react";

type Q = {
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
};

export function Quiz({ documentId }: { documentId: string | null }) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, documentId, count }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed");
      setQuestions(j.questions || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const score = submitted
    ? questions.reduce(
        (acc, q, i) => acc + (answers[i] === q.correctIndex ? 1 : 0),
        0,
      )
    : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold mb-1">Quiz mode</h2>
      <p className="text-sm text-muted mb-5">
        Test your understanding with multiple-choice questions.
      </p>

      <div className="flex flex-wrap gap-2 items-center mb-6">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic focus (optional)"
          className="flex-1 min-w-[200px] bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <select
          value={count}
          onChange={(e) => setCount(parseInt(e.target.value))}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm"
        >
          {[3, 5, 8, 10, 15].map((n) => (
            <option key={n} value={n}>
              {n} questions
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

      {questions.length > 0 && (
        <div className="space-y-6">
          {questions.map((q, qi) => {
            const picked = answers[qi];
            return (
              <div key={qi} className="bg-card border border-border rounded-lg p-5">
                <p className="font-medium mb-3">
                  {qi + 1}. {q.question}
                </p>
                <div className="space-y-2">
                  {q.choices.map((c, ci) => {
                    const isPicked = picked === ci;
                    const isCorrect = q.correctIndex === ci;
                    let cls = "border-border bg-background hover:bg-card";
                    if (submitted) {
                      if (isCorrect) cls = "border-green-500/60 bg-green-500/10";
                      else if (isPicked) cls = "border-red-500/60 bg-red-500/10";
                      else cls = "border-border bg-background opacity-60";
                    } else if (isPicked) {
                      cls = "border-accent bg-accent/10";
                    }
                    return (
                      <button
                        key={ci}
                        disabled={submitted}
                        onClick={() => setAnswers((a) => ({ ...a, [qi]: ci }))}
                        className={`w-full text-left text-sm border rounded-md px-3 py-2 transition-colors flex items-center gap-2 ${cls}`}
                      >
                        <span className="font-mono text-xs text-muted w-5">
                          {String.fromCharCode(65 + ci)}.
                        </span>
                        <span className="flex-1">{c}</span>
                        {submitted && isCorrect && (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        )}
                        {submitted && isPicked && !isCorrect && (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {submitted && (
                  <p className="text-xs text-muted mt-3 leading-relaxed">
                    <span className="font-medium text-foreground">Why:</span> {q.explanation}
                  </p>
                )}
              </div>
            );
          })}

          <div className="flex items-center justify-between border-t border-border pt-4">
            {!submitted ? (
              <button
                onClick={() => setSubmitted(true)}
                disabled={Object.keys(answers).length < questions.length}
                className="bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg px-5 py-2 text-sm font-medium"
              >
                Submit ({Object.keys(answers).length}/{questions.length} answered)
              </button>
            ) : (
              <>
                <div className="text-lg font-semibold">
                  Score: {score} / {questions.length}{" "}
                  <span className="text-muted text-sm font-normal">
                    ({Math.round((score / questions.length) * 100)}%)
                  </span>
                </div>
                <button
                  onClick={generate}
                  className="flex items-center gap-2 bg-card border border-border hover:bg-border rounded-lg px-4 py-2 text-sm"
                >
                  <RotateCcw className="w-4 h-4" /> New quiz
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {!loading && questions.length === 0 && (
        <p className="text-sm text-muted text-center py-12">
          Hit Generate to create a quiz from your notes.
        </p>
      )}
    </div>
  );
}
