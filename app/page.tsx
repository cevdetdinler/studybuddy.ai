"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar, type Doc } from "@/components/Sidebar";
import { Chat } from "@/components/Chat";
import { SearchPanel } from "@/components/SearchPanel";
import { Flashcards } from "@/components/Flashcards";
import { Quiz } from "@/components/Quiz";
import { Eli12 } from "@/components/Eli12";
import { MessageSquare, Search, Layers, ListChecks, Baby } from "lucide-react";

type Tab = "chat" | "search" | "flashcards" | "quiz" | "eli12";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "search", label: "Search", icon: Search },
  { id: "flashcards", label: "Flashcards", icon: Layers },
  { id: "quiz", label: "Quiz", icon: ListChecks },
  { id: "eli12", label: "ELI12", icon: Baby },
];

export default function Home() {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("chat");

  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      const j = await res.json();
      if (res.ok) setDocuments(j.documents || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  async function handleDelete(id: string) {
    await fetch(`/api/documents?documentId=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (activeDocId === id) setActiveDocId(null);
    loadDocs();
  }

  const activeDoc = documents.find((d) => d.documentId === activeDocId) || null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        documents={documents}
        activeDocId={activeDocId}
        onSelect={setActiveDocId}
        onUploaded={loadDocs}
        onDelete={handleDelete}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border bg-card/30 px-4 flex items-center gap-1 h-14 shrink-0 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  tab === t.id
                    ? "bg-accent text-white"
                    : "text-muted hover:text-foreground hover:bg-card"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
          <div className="ml-auto text-xs text-muted whitespace-nowrap pl-4">
            {activeDoc ? (
              <>
                Scoped to <span className="text-foreground font-medium">{activeDoc.documentName}</span>
              </>
            ) : (
              "All documents"
            )}
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {tab === "chat" && <Chat key={activeDocId || "all"} documentId={activeDocId} />}
          {tab === "search" && (
            <div className="h-full overflow-y-auto">
              <SearchPanel documentId={activeDocId} />
            </div>
          )}
          {tab === "flashcards" && (
            <div className="h-full overflow-y-auto">
              <Flashcards documentId={activeDocId} />
            </div>
          )}
          {tab === "quiz" && (
            <div className="h-full overflow-y-auto">
              <Quiz documentId={activeDocId} />
            </div>
          )}
          {tab === "eli12" && (
            <div className="h-full overflow-y-auto">
              <Eli12 documentId={activeDocId} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
