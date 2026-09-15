import React, { useState, useRef } from "react";
import { Search, Sparkles, CornerDownLeft, Video, ArrowRight } from "lucide-react";
import type { ResearchMode } from "../types";

interface ResearchPromptBarProps {
  onSearch: (query: string, inlineYoutubeUrl?: string) => void;
  isResearching: boolean;
  selectedSourcesCount: number;
  researchMode: ResearchMode;
}

const SAMPLE_QUERIES = [
  "Summarize the key takeaways and main arguments",
  "Compare the methodology discussed with industry standards",
  "What are the core technical limitations mentioned?",
  "Extract the important statistics and data points",
];

export const ResearchPromptBar: React.FC<ResearchPromptBarProps> = ({
  onSearch,
  isResearching,
  selectedSourcesCount,
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
      <div className="relative glass rounded-2xl p-2 border border-white/10 shadow-2xl focus-within:border-purple-500/50 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
        {showDirectUrl && (
          <div className="px-3 pt-2 pb-1 border-b border-slate-800/80 flex items-center gap-2 animate-fade-in-up">
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

        <div className="flex items-end gap-2 p-1.5">
          <div className="pl-2.5 pb-2.5 text-slate-400">
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
                ? `Ask a research question across ${selectedSourcesCount} selected source(s)... (Enter to submit)`
                : "Enter a research prompt or question... (Add a YouTube video from sidebar)"
            }
            className="w-full bg-transparent border-none text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none resize-none leading-relaxed py-1"
          />

          <div className="flex items-center gap-2 pr-1 pb-1">
            <button
              type="button"
              onClick={() => setShowDirectUrl(!showDirectUrl)}
              className={`p-2 rounded-xl text-xs transition-colors border ${
                showDirectUrl
                  ? "bg-red-950/50 text-red-400 border-red-500/30"
                  : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200"
              }`}
              title="Add one-shot direct YouTube URL"
            >
              <Video className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={!query.trim() || isResearching}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all active:scale-[0.98]"
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
