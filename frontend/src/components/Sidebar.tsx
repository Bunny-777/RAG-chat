import React, { useState } from "react";
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
} from "lucide-react";
import type { SourceInfo, ResearchMode } from "../types";

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
  onUpload: (payload: {
    url: string;
    manual_transcript?: string;
    chunk_size: number;
    chunk_overlap: number;
    k: number;
  }) => Promise<void>;
  isUploading: boolean;
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
  onUpload,
  isUploading,
}) => {
  const [url, setUrl] = useState("");
  const [manualTranscript, setManualTranscript] = useState("");
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

  const isAllSelected =
    sources.length > 0 && selectedSourceIds.length === sources.length;

  return (
    <aside className="w-80 md:w-88 border-r border-white/10 bg-slate-950/60 backdrop-blur-xl flex flex-col h-[calc(100vh-4rem)] overflow-y-auto p-4 gap-6 select-none">
      {/* 1. Add Source Card */}
      <div className="glass rounded-2xl p-4 flex flex-col gap-3.5 border border-white/10 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 uppercase tracking-wider">
            <Video className="w-4 h-4 text-red-500" />
            <span>Add YouTube Source</span>
          </div>
        </div>

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

          {/* Advanced Settings Toggle */}
          <div className="flex flex-col gap-2">
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
                    min="500"
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
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 transition-all active:scale-[0.98]"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing & Indexing...</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Index Video Source</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* 2. Indexed Sources List */}
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
            <Video className="w-8 h-8 text-slate-700" />
            <p className="text-xs text-slate-500">No sources indexed yet.</p>
            <p className="text-[10px] text-slate-600">
              Paste a YouTube link above to start researching.
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
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
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
                      <span className="text-xs font-medium text-slate-200 truncate">
                        {src.title || src.source_id}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {src.chunk_count} chunks
                      </span>
                      {src.language && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                          {src.language}
                        </span>
                      )}
                    </div>
                  </div>

                  {src.url && (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-800 transition-colors"
                      title="Open video in YouTube"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
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
