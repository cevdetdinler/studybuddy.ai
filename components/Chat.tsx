"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    id: string;
    documentName: string;
    chunkIndex: number;
    preview: string;
    score: number;
  }>;
};

const SOURCES_MARKER_START = "__SOURCES__";
const SOURCES_MARKER_END = "__END_SOURCES__";

export function Chat({
  documentId,
  initialPrompt,
  onInitialPromptConsumed,
}: {
  documentId: string | null;
  initialPrompt?: string;
  onInitialPromptConsumed?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    if (initialPrompt && !sentInitial.current) {
      sentInitial.current = true;
      onInitialPromptConsumed?.();
      send(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || streaming) return;

    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, documentId }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `⚠️ ${err.error || "Request failed"}` },
        ]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sources: Message["sources"];
      let assistantContent = "";

      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        if (!sources && buffer.includes(SOURCES_MARKER_END)) {
          const start = buffer.indexOf(SOURCES_MARKER_START);
          const end = buffer.indexOf(SOURCES_MARKER_END);
          const json = buffer.slice(start + SOURCES_MARKER_START.length, end);
          try {
            sources = JSON.parse(json);
          } catch {
            sources = [];
          }
          buffer = buffer.slice(end + SOURCES_MARKER_END.length);
        }

        if (sources) {
          assistantContent += buffer;
          buffer = "";
          setMessages((m) => {
            const copy = m.slice();
            copy[copy.length - 1] = {
              role: "assistant",
              content: assistantContent,
              sources,
            };
            return copy;
          });
        }
      }
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠️ ${e.message || "Stream error"}` },
      ]);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-center text-muted py-16">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium text-foreground">
              Ask your notes anything
            </p>
            <p className="text-sm mt-1">
              {documentId
                ? "Scoped to the selected document."
                : "Scoped to all uploaded documents."}
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-xl mx-auto">
              {[
                "Summarize the main ideas",
                "What are the key definitions?",
                "Compare X and Y",
                "What's the most important concept?",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-xs bg-card hover:bg-border border border-border rounded-full px-3 py-1.5 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] bg-accent text-white rounded-2xl rounded-br-sm px-4 py-2.5"
                  : "max-w-[85%] bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3"
              }
            >
              <div className="prose-chat text-sm leading-relaxed">
                <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
              </div>
              {m.sources && m.sources.length > 0 && (
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer text-muted hover:text-foreground">
                    {m.sources.length} sources
                  </summary>
                  <div className="mt-2 space-y-2">
                    {m.sources.map((s, idx) => (
                      <div
                        key={s.id}
                        className="bg-background/50 border border-border rounded-md p-2"
                      >
                        <div className="font-medium text-foreground">
                          [Source {idx + 1}] {s.documentName} · chunk #{s.chunkIndex}
                          <span className="text-muted ml-2">
                            ({s.score.toFixed(2)})
                          </span>
                        </div>
                        <div className="text-muted mt-1 line-clamp-3">{s.preview}…</div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        ))}

        {streaming && messages[messages.length - 1]?.content === "" && (
          <div className="flex gap-2 items-center text-muted text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <div className="border-t border-border p-4">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Ask anything about your notes…"
            className="flex-1 bg-card border border-border rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/50"
            style={{ minHeight: "42px", maxHeight: "150px" }}
          />
          <button
            onClick={() => send()}
            disabled={streaming || !input.trim()}
            className="bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg p-2.5 transition-colors"
            aria-label="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
