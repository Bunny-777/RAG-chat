import React, { useState, useRef } from "react";
import {
  Video,
  Plus,
  Sliders,
  FileText,
  CheckSquare,
  Square,
  Globe,
  Zap,
  Sparkles,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Layers,
  Loader2,
  ExternalLink,
  UploadCloud,
  Trash2,
  FileCode,
  MessageSquare,
} from "lucide-react";
import type { SourceInfo, ResearchMode, ChatSessionSummary } from "../types";

interface SidebarProps {
  sources: SourceInfo[];
  selectedSourceIds: string[];
  onToggleSource: (id: string) => void;
  onSelectAllSources: () => void;
  onClearSourcesSelection: () => void;
  researchMode: ResearchMode;
  onSelectMode: (mode: ResearchMode) => void;
  webSearch: boolean;
  onToggleWebSearch: () => void;
  sessions?: ChatSessionSummary[];
  currentSessionId?: string | null;
  onNewChat?: () => void;
  onSelectSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onUpload: (payload: {
    url: string;
    manual_transcript?: string;
    chunk_size: number;
    chunk_overlap: number;
    k: number;
  }) => Promise<void>;
  onUploadDocument?: (
    file: File,
    options?: {
      chunk_size?: number;
      chunk_overlap?: number;
      k?: number;
    }
  ) => Promise<void>;
  onDeleteSource?: (sourceId: string) => Promise<void>;
  isUploading: boolean;
  isUploadingDocument?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sources,
  selectedSourceIds,
  onToggleSource,
  onSelectAllSources,
  onClearSourcesSelection,
  researchMode,
  onSelectMode,
  webSearch,
  onToggleWebSearch,
  sessions = [],
  currentSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onUpload,
  onUploadDocument,
  onDeleteSource,
  isUploading,
  isUploadingDocument = false,
}) => {
  const [activeTab, setActiveTab] = useState<"youtube" | "document">("youtube");
  const [url, setUrl] = useState("");
  const [manualTranscript, setManualTranscript] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);
  const [k, setK] = useState(4);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    await onUpload({
      url: url.trim(),
      manual_transcript: manualTranscript.trim() || undefined,
      chunk_size: chunkSize,
      chunk_overlap: chunkOverlap,
      k,
    });
    setUrl("");
    setManualTranscript("");
  };

  const handleDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !onUploadDocument) return;
    await onUploadDocument(selectedFile, {
      chunk_size: chunkSize,
      chunk_overlap: chunkOverlap,
      k,
    });
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const isAllSelected =
    sources.length > 0 && selectedSourceIds.length === sources.length;

  const getSourceIcon = (src: SourceInfo) => {
    if (src.source_type === "document") {
      const titleLower = (src.title || "").toLowerCase();
      if (titleLower.endsWith(".pdf")) {
        return <FileText className="w-4 h-4 text-red-400" />;
      }
      if (titleLower.endsWith(".docx") || titleLower.endsWith(".doc")) {
        return <FileText className="w-4 h-4 text-blue-400" />;
      }
      return <FileCode className="w-4 h-4 text-emerald-400" />;
    }
    return <Video className="w-4 h-4 text-red-500" />;
  };

  return (
    <aside className="w-80 md:w-88 border-r border-white/10 bg-slate-950/60 backdrop-blur-xl flex flex-col h-[calc(100vh-4rem)] overflow-y-auto p-4 gap-5 select-none">
      {/* 0. New Chat & Sessions Header */}
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600/30 via-indigo-600/30 to-pink-600/30 hover:from-purple-600/45 hover:to-pink-600/45 border border-purple-500/40 text-purple-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-purple-950/40 group"
        >
          <Plus className="w-4 h-4 text-purple-400 group-hover:rotate-90 transition-transform" />
          <span>New Chat</span>
        </button>

        {sessions && sessions.length > 0 && (
          <div className="flex flex-col gap-1.5 bg-slate-900/40 rounded-xl p-2.5 border border-slate-800/80">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3 text-purple-400" />
                Conversations
              </span>
              <span className="text-[10px] text-slate-600 font-mono">{sessions.length}</span>
            </div>

            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
              {sessions.map((s) => {
                const isActive = currentSessionId === s.session_id;
                return (
                  <div
                    key={s.session_id}
                    onClick={() => onSelectSession && onSelectSession(s.session_id)}
                    className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all group ${
                      isActive
                        ? "bg-purple-950/70 border-purple-500/50 text-white font-medium shadow-sm"
                        : "bg-slate-900/60 border-slate-800/70 hover:border-slate-700 text-slate-300 hover:text-white"
                    }`}
                  >
                    <span className="truncate flex-1 text-[11px]">{s.title || "Research Session"}</span>
                    {onDeleteSession && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(s.session_id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-0.5 rounded transition-all"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 1. Add Source Card with Tabs */}
      <div className="glass rounded-2xl p-4 flex flex-col gap-3.5 border border-white/10 shadow-xl">
        {/* Source Mode Tabs */}
        <div className="flex rounded-xl bg-slate-900/90 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("youtube")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "youtube"
                ? "bg-red-950/70 text-red-300 border border-red-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Video className="w-3.5 h-3.5 text-red-500" />
            <span>YouTube</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("document")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "document"
                ? "bg-purple-950/70 text-purple-300 border border-purple-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 text-purple-400" />
            <span>Document</span>
          </button>
        </div>

        {/* Tab 1: YouTube Form */}
        {activeTab === "youtube" ? (
          <form onSubmit={handleUploadSubmit} className="flex flex-col gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isUploading}
                className="w-full text-xs bg-slate-900/90 border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all font-mono"
              />
            </div>

            {/* Manual Transcript Toggle */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowManual(!showManual)}
                className="flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-200 transition-colors py-1 px-1"
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-amber-400" />
                  Paste Manual Transcript Fallback
                </span>
                {showManual ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              {showManual && (
                <textarea
                  placeholder="Paste transcript text here if YouTube captions are unavailable..."
                  value={manualTranscript}
                  onChange={(e) => setManualTranscript(e.target.value)}
                  rows={3}
                  className="w-full text-[11px] bg-slate-900/90 border border-slate-800 focus:border-amber-500 rounded-xl p-2.5 text-slate-100 placeholder:text-slate-600 focus:outline-none font-mono resize-none animate-fade-in-up"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={isUploading || !url.trim()}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 transition-all active:scale-[0.98]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Indexing Video...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Index Video Source</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* Tab 2: Document Upload Form */
          <form onSubmit={handleDocumentSubmit} className="flex flex-col gap-3">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive
                  ? "border-purple-400 bg-purple-950/40"
                  : selectedFile
                  ? "border-emerald-500/50 bg-emerald-950/20"
                  : "border-slate-800 hover:border-purple-500/50 bg-slate-900/40 hover:bg-slate-900/70"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md,.markdown,.json,.csv"
                onChange={handleFileChange}
                className="hidden"
                disabled={isUploadingDocument}
              />
              <UploadCloud className={`w-6 h-6 mb-1.5 ${selectedFile ? "text-emerald-400" : "text-purple-400"}`} />
              {selectedFile ? (
                <div className="flex flex-col items-center">
                  <span className="text-xs font-medium text-emerald-300 truncate max-w-[220px]">
                    {selectedFile.name}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB • Click to change
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="text-xs font-medium text-slate-200">
                    Choose or drop document
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">
                    PDF, DOCX, TXT, MD
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isUploadingDocument || !selectedFile}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 transition-all active:scale-[0.98]"
            >
              {isUploadingDocument ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Parsing & Chunking Document...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Index Document for RAG</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Shared Advanced Settings Toggle */}
        <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-200 transition-colors py-1 px-1"
          >
            <span className="flex items-center gap-1.5">
              <Sliders className="w-3 h-3 text-purple-400" />
              Advanced Indexing Settings
            </span>
            {showAdvanced ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {showAdvanced && (
            <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800 flex flex-col gap-2.5 animate-fade-in-up">
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono">
                  <span>Chunk Size</span>
                  <span className="text-purple-400 font-bold">{chunkSize}</span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="2000"
                  step="100"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono">
                  <span>Overlap</span>
                  <span className="text-purple-400 font-bold">{chunkOverlap}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="400"
                  step="50"
                  value={chunkOverlap}
                  onChange={(e) => setChunkOverlap(Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono">
                  <span>Retrieval Top-K</span>
                  <span className="text-purple-400 font-bold">{k}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                  value={k}
                  onChange={(e) => setK(Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Active Indexed Sources List */}
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 uppercase tracking-wider">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Active Sources ({sources.length})</span>
          </div>

          {sources.length > 0 && (
            <button
              onClick={isAllSelected ? onClearSourcesSelection : onSelectAllSources}
              className="text-[10px] text-purple-400 hover:text-purple-300 font-medium transition-colors"
            >
              {isAllSelected ? "Deselect all" : "Select all"}
            </button>
          )}
        </div>

        {sources.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 p-6 flex flex-col items-center justify-center text-center gap-2 bg-slate-900/20">
            <Layers className="w-8 h-8 text-slate-700" />
            <p className="text-xs text-slate-500">No sources indexed yet.</p>
            <p className="text-[10px] text-slate-600">
              Paste a YouTube link or upload a document to begin.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {sources.map((src) => {
              const isSelected = selectedSourceIds.includes(src.source_id);
              return (
                <div
                  key={src.source_id}
                  onClick={() => onToggleSource(src.source_id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 group ${
                    isSelected
                      ? "bg-purple-950/40 border-purple-500/40 shadow-sm"
                      : "bg-slate-900/40 border-slate-800/80 hover:border-slate-700"
                  }`}
                >
                  <div className="mt-0.5 text-purple-400">
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-purple-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {getSourceIcon(src)}
                      <span className="text-xs font-medium text-slate-200 truncate">
                        {src.title || src.source_id}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {src.chunk_count} chunks
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 uppercase">
                        {src.source_type}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {src.url && (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-800 transition-colors"
                        title="Open external source"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {onDeleteSource && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSource(src.source_id);
                        }}
                        className="text-slate-600 hover:text-red-400 p-1 rounded hover:bg-red-950/30 transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove source"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Research Mode & Search Configuration */}
      <div className="glass rounded-2xl p-4 flex flex-col gap-3.5 border border-white/10 mt-auto">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-200 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Research Mode
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800">
          {(["quick", "standard", "deep"] as ResearchMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onSelectMode(mode)}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-medium capitalize transition-all ${
                researchMode === mode
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              {mode === "quick" && <Zap className="w-3 h-3 inline mr-1" />}
              {mode === "standard" && <BookOpen className="w-3 h-3 inline mr-1" />}
              {mode === "deep" && <Sparkles className="w-3 h-3 inline mr-1" />}
              {mode}
            </button>
          ))}
        </div>

        {/* Web Search Toggle */}
        <div
          onClick={onToggleWebSearch}
          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-all"
        >
          <div className="flex items-center gap-2">
            <Globe className={`w-4 h-4 ${webSearch ? "text-emerald-400" : "text-slate-500"}`} />
            <div>
              <div className="text-xs font-medium text-slate-200">Web Search</div>
              <div className="text-[10px] text-slate-500">Augment with live web results</div>
            </div>
          </div>

          <div
            className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
              webSearch ? "bg-emerald-600" : "bg-slate-800"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                webSearch ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </div>
        </div>
      </div>
    </aside>
  );
};
