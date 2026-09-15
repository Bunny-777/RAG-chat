import React from "react";
import { Loader2, Search, Database, FileText, CheckCircle2, Sparkles, Terminal } from "lucide-react";
import type { SSEEvent } from "../types";

interface LiveProgressFeedProps {
  events: SSEEvent[];
  isResearching: boolean;
}

export const LiveProgressFeed: React.FC<LiveProgressFeedProps> = ({
  events,
  isResearching,
}) => {
  if (events.length === 0 && !isResearching) return null;

  return (
    <div className="glass rounded-2xl p-5 border border-purple-500/20 max-w-4xl mx-auto w-full shadow-2xl bg-slate-950/70 animate-fade-in-up">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
            Live Research Execution Timeline
          </h3>
        </div>

        {isResearching && (
          <div className="flex items-center gap-2 text-xs text-purple-400 font-mono">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Processing Query...</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {events.map((evt, idx) => {
          const isLatest = idx === events.length - 1 && isResearching;

          return (
            <div
              key={idx}
              className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all text-xs ${
                isLatest
                  ? "bg-purple-950/40 border-purple-500/40 shadow-sm animate-pulse-glow"
                  : "bg-slate-900/40 border-slate-800/60"
              }`}
            >
              <div className="mt-0.5">
                {evt.type === "status" && <Search className="w-4 h-4 text-sky-400" />}
                {evt.type === "tool_call" && <Database className="w-4 h-4 text-indigo-400" />}
                {evt.type === "source_found" && <FileText className="w-4 h-4 text-amber-400" />}
                {evt.type === "analysis" && <Sparkles className="w-4 h-4 text-pink-400" />}
                {evt.type === "report" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {evt.type === "done" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-slate-400">
                    [{evt.type}]
                  </span>
                  {evt.tool && (
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 border border-indigo-800 text-indigo-300">
                      tool: {evt.tool}
                    </span>
                  )}
                  {evt.source_id && (
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-amber-950 border border-amber-800 text-amber-300">
                      source: {evt.source_id}
                    </span>
                  )}
                </div>

                <div className="text-slate-200 mt-1 font-sans">
                  {evt.message || (evt.type === "report" ? "Structured report generated." : "Event emitted.")}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
