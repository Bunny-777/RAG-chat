import React from "react";
import { Sparkles, Cpu, Activity, ExternalLink } from "lucide-react";
import type { HealthStatus } from "../types";

interface HeaderProps {
  health: HealthStatus | null;
  loading: boolean;
}

export const Header: React.FC<HeaderProps> = ({ health, loading }) => {
  return (
    <header className="h-16 border-b border-white/10 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 ring-1 ring-white/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              AI Research <span className="gradient-text">Analyst</span>
            </h1>
            <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              v1.0
            </span>
          </div>
          <p className="text-xs text-slate-400">Multi-source grounded research engine</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Backend Status Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
          <span
            className={`w-2 h-2 rounded-full ${
              health?.status === "ok" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
            }`}
          />
          <span className="font-medium text-slate-400">Backend:</span>
          <span>{loading ? "Connecting..." : health?.status === "ok" ? "Connected" : "Offline"}</span>
        </div>

        {/* Model Badge */}
        {health && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-300">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-mono text-[11px] font-semibold">{health.llm_model}</span>
          </div>
        )}

        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-900/50 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all duration-150"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>API Docs</span>
          <ExternalLink className="w-3 h-3 text-slate-500" />
        </a>
      </div>
    </header>
  );
};
