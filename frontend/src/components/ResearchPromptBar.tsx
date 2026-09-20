import React, { useState, useRef } from "react";
import { Search, Sparkles, CornerDownLeft, Video, ArrowRight, Zap, BookOpen, Brain, Globe, FileText } from "lucide-react";
import type { ResearchMode } from "../types";

interface ResearchPromptBarProps {
  onSearch: (query: string, inlineYoutubeUrl?: string) => void;
  isResearching: boolean;
  selectedSourcesCount: number;
  researchMode: ResearchMode;
  onChangeMode?: (mode: ResearchMode) => void;
  webSearch?: boolean;
  onToggleWebSearch?: () => void;
  onClearSourcesSelection?: () => void;
}

const SAMPLE_QUERIES = [
  "Summarize key takeaways and methodology",
  "Compare findings across sources and contrast viewpoints",
  "What are the core technical limitations and trade-offs?",
  "Extract important metrics, data points, and conclusions",
];

const MODES: { id: ResearchMode; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
  {
    id: "quick",
    label: "Quick",
    icon: <Zap className="w-3.5 h-3.5" />,
    desc: "Rapid, direct answer",
    color: "text-amber-400 border-amber-500/40 bg-amber-950/40",
  },
  {
    id: "standard",
    label: "Standard",
    icon: <BookOpen className="w-3.5 h-3.5" />,
    desc: "Multi-source synthesis",
    color: "text-indigo-300 border-indigo-500/40 bg-indigo-950/40",
  },
  {
    id: "deep",
    label: "Deep",
    icon: <Brain className="w-3.5 h-3.5" />,
    desc: "Deep comparative thinking",
    color: "text-pink-300 border-pink-500/40 bg-pink-950/40",
  },
];

export const ResearchPromptBar: React.FC<ResearchPromptBarProps> = ({
  onSearch,
  isResearching,
  selectedSourcesCount,
  researchMode,
  onChangeMode,
  webSearch = true,
  onToggleWebSearch,
  onClearSourcesSelection,
}) => {
  const [query, setQuery] = useState("");
  const [inlineYoutubeUrl, setInlineYoutubeUrl] = useState("");
  const [showDirectUrl, setShowDirectUrl] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isResearching) return;
    onSearch(query.trim(), inlineYoutubeUrl.trim() || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSampleClick = (sample: string) => {
    setQuery(sample);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="flex flex-col gap-3 max-w-4xl mx-auto w-full">
      <div className="relative glass rounded-2xl p-2.5 border border-white/10 shadow-2xl focus-within:border-purple-500/50 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all bg-slate-950/70 overflow-hidden">
        {/* Active Context Banner */}
        <div className="px-3 py-1.5 -mx-2.5 -mt-2.5 mb-2 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between text-xs">
          {selectedSourcesCount > 0 ? (
            <div className="flex items-center gap-2 text-purple-300">
              <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="font-medium">
                {selectedSourcesCount} document source{selectedSourcesCount > 1 ? "s" : ""} selected
              </span>
              {onClearSourcesSelection && (
                <button
                  type="button"
                  onClick={onClearSourcesSelection}
                  className="ml-2 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 transition-colors"
                >
                  ✕ Deselect all (Pure Web/AI)
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-400">
              <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-medium">Live Web & AI Knowledge</span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">(No local files attached)</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[11px]">
            <span className={`w-2 h-2 rounded-full ${webSearch ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
            <span className={webSearch ? "text-emerald-400 font-medium" : "text-slate-500"}>
              {webSearch ? "Internet Search Enabled" : "Internet Search Disabled"}
            </span>
          </div>
        </div>

        {showDirectUrl && (
          <div className="px-3 pt-1 pb-2 border-b border-slate-800/80 flex items-center gap-2 animate-fade-in-up">
            <Video className="w-4 h-4 text-red-400 shrink-0" />
            <input
              type="text"
              placeholder="Direct YouTube URL (optional for 1-click research)..."
              value={inlineYoutubeUrl}
              onChange={(e) => setInlineYoutubeUrl(e.target.value)}
              className="w-full text-xs bg-transparent border-none focus:outline-none text-slate-200 placeholder:text-slate-500 font-mono"
            />
          </div>
        )}

        <div className="flex items-start sm:items-end gap-2 p-1.5">
          <div className="pl-2 pb-2.5 text-slate-400 mt-1 sm:mt-0">
            <Search className="w-5 h-5" />
          </div>

          <textarea
            ref={textareaRef}
            rows={2}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isResearching}
            placeholder={
              selectedSourcesCount > 0
                ? `Ask across ${selectedSourcesCount} selected source(s)... (Enter to submit)`
                : "Ask anything, get live web prices, research papers, or calculate... (Enter to submit)"
            }
            className="w-full bg-transparent border-none text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none resize-none leading-relaxed py-1"
          />
        </div>

        {/* Action Bar along with Mode Selector & Analyze Button */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-2 border-t border-slate-800/70">
          {/* Left tools: Direct URL Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDirectUrl(!showDirectUrl)}
              className={`px-2.5 py-1.5 rounded-xl text-xs transition-all border flex items-center gap-1.5 ${
                showDirectUrl
                  ? "bg-red-950/50 text-red-400 border-red-500/30 shadow-sm"
                  : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
              title="Add one-shot direct YouTube URL"
            >
              <Video className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[11px] hidden sm:inline">Add URL</span>
            </button>

            {/* Web Search Quick Toggle Button */}
            {onToggleWebSearch && (
              <button
                type="button"
                onClick={onToggleWebSearch}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all border flex items-center gap-1.5 ${
                  webSearch
                    ? "bg-emerald-950/50 text-emerald-300 border-emerald-500/40 shadow-sm"
                    : "bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-300"
                }`}
                title={webSearch ? "Internet Search is ON: Click to disable" : "Internet Search is OFF: Click to enable"}
              >
                <Globe className={`w-3.5 h-3.5 ${webSearch ? "text-emerald-400" : "text-slate-500"}`} />
                <span className="text-[11px]">{webSearch ? "Web Search: ON" : "Web Search: OFF"}</span>
              </button>
            )}
          </div>

          {/* Right Action: Mode Switcher + Analyze Button */}
          <div className="flex items-center gap-2.5">
            {/* Mode Selector Pill Group */}
            <div className="flex items-center bg-slate-900/90 rounded-xl p-0.5 border border-slate-800/90 shadow-inner">
              {MODES.map((m) => {
                const isActive = researchMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onChangeMode && onChangeMode(m.id)}
                    title={`${m.label} Mode: ${m.desc}`}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? `${m.color} border shadow-md font-semibold`
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                    }`}
                  >
                    {m.icon}
                    <span className="text-[11px]">{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Analyze Button */}
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!query.trim() || isResearching}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isResearching ? "Researching..." : "Analyze"}</span>
              <CornerDownLeft className="w-3.5 h-3.5 opacity-60 hidden sm:inline" />
            </button>
          </div>
        </div>
      </div>

      {/* Suggested Queries */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
          Suggestions:
        </span>
        {SAMPLE_QUERIES.map((sample, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSampleClick(sample)}
            className="text-[11px] text-slate-400 hover:text-purple-300 bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-purple-500/30 rounded-lg px-2.5 py-1 transition-all flex items-center gap-1.5"
          >
            <span>{sample}</span>
            <ArrowRight className="w-2.5 h-2.5 opacity-50" />
          </button>
        ))}
      </div>
    </div>
  );
};
