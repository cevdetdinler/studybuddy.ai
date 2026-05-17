"use client";

import { Upload, FileText, Trash2, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

export type Doc = {
  documentId: string;
  documentName: string;
  chunks: number;
};

type Props = {
  documents: Doc[];
  activeDocId: string | null;
  onSelect: (id: string | null) => void;
  onUploaded: () => void;
  onDelete: (id: string) => void;
};

export function Sidebar({ documents, activeDocId, onSelect, onUploaded, onDelete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `Upload failed (${res.status})`);
        }
      }
      onUploaded();
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <aside className="w-72 shrink-0 border-r border-border bg-card/40 flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <span className="text-accent">📚</span> StudyBuddy AI
        </h1>
        <p className="text-xs text-muted mt-1">Chat with your notes.</p>
      </div>

      <div className="p-4 border-b border-border">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-md bg-accent hover:bg-accent-hover transition-colors text-white font-medium py-2.5 px-3 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" /> Upload PDF / Notes
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
        />
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <button
          onClick={() => onSelect(null)}
          className={`w-full text-left px-3 py-2 rounded-md text-sm mb-1 transition-colors ${
            activeDocId === null
              ? "bg-accent/20 text-white"
              : "hover:bg-card text-muted"
          }`}
        >
          All documents
        </button>
        {documents.length === 0 && (
          <p className="text-xs text-muted px-3 py-4 text-center">
            No documents yet. Upload to get started.
          </p>
        )}
        {documents.map((d) => (
          <div
            key={d.documentId}
            className={`group flex items-center gap-2 px-2 py-2 rounded-md mb-1 transition-colors ${
              activeDocId === d.documentId
                ? "bg-accent/20"
                : "hover:bg-card"
            }`}
          >
            <button
              onClick={() => onSelect(d.documentId)}
              className="flex-1 min-w-0 text-left flex items-center gap-2"
            >
              <FileText className="w-4 h-4 shrink-0 text-muted" />
              <div className="min-w-0">
                <div className="text-sm truncate">{d.documentName}</div>
                <div className="text-xs text-muted">{d.chunks} chunks</div>
              </div>
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete "${d.documentName}"?`)) {
                  onDelete(d.documentId);
                }
              }}
              className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-opacity"
              aria-label="Delete document"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

    </aside>
  );
}
