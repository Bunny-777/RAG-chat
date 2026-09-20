import React, { useState } from "react";
import {
  Copy,
  Check,
  Download,
  Clock,
  Award,
  Layers,
  ExternalLink,
  Video,
  Quote,
  CheckCircle,
  FileText,
  Globe,
  Zap,
  Brain,
} from "lucide-react";
import type { ResearchReport } from "../types";
import { formatLatency, reportToMarkdown, downloadMarkdown } from "../lib/utils";

interface ReportViewerProps {
  report: ResearchReport;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ report }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const md = reportToMarkdown({
      title: report.title,
      mode: report.mode,
      latency_ms: report.latency_ms,
      executive_summary: report.executive_summary,
      key_findings: report.key_findings as unknown as Array<Record<string, unknown>>,
      analysis: report.analysis as unknown as Array<Record<string, unknown>>,
      conclusion: report.conclusion,
      sources: report.sources as unknown as Array<Record<string, unknown>>,
    });
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const md = reportToMarkdown({
      title: report.title,
      mode: report.mode,
      latency_ms: report.latency_ms,
      executive_summary: report.executive_summary,
      key_findings: report.key_findings as unknown as Array<Record<string, unknown>>,
      analysis: report.analysis as unknown as Array<Record<string, unknown>>,
      conclusion: report.conclusion,
      sources: report.sources as unknown as Array<Record<string, unknown>>,
    });
    downloadMarkdown(`${report.research_id || "research-report"}.md`, md);
  };

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 border border-white/10 max-w-4xl mx-auto w-full shadow-2xl bg-slate-950/80 animate-fade-in-up flex flex-col gap-8">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${
              report.mode === "quick"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : report.mode === "deep"
                ? "bg-pink-500/10 text-pink-400 border-pink-500/20"
                : "bg-purple-500/10 text-purple-400 border-purple-500/20"
            }`}>
              {report.mode === "quick" && <Zap className="w-3 h-3 text-amber-400" />}
              {report.mode === "deep" && <Brain className="w-3 h-3 text-pink-400" />}
              Mode: {report.mode}
            </span>
            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              {formatLatency(report.latency_ms)}
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              ID: {report.research_id}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
            {report.title}
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition-all active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy MD</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-xs font-medium text-purple-200 transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-purple-300" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* 2. Executive Summary */}
      {report.executive_summary && (
        <div className="relative rounded-2xl p-5 bg-gradient-to-br from-purple-950/30 via-slate-900/40 to-indigo-950/30 border border-purple-500/30 shadow-lg">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-purple-400">
            <Quote className="w-4 h-4 text-purple-400" />
            <span>Executive Summary</span>
          </div>
          <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-sans">
            {report.executive_summary}
          </p>
        </div>
      )}

      {/* 3. Key Findings */}
      {report.key_findings && report.key_findings.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Key Research Findings</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {report.key_findings.map((item, idx) => {
              const text =
                typeof item === "string"
                  ? item
                  : (item.finding as string) || (item.detail as string) || JSON.stringify(item);

              return (
                <div
                  key={idx}
                  className="rounded-2xl p-4 bg-slate-900/60 border border-slate-800 hover:border-purple-500/30 transition-all flex items-start gap-3 shadow-md"
                >
                  <div className="w-6 h-6 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Detailed Analysis */}
      {report.analysis && report.analysis.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <FileText className="w-4 h-4 text-sky-400" />
            <span>Detailed Analysis</span>
          </div>

          <div className="rounded-2xl p-5 bg-slate-900/40 border border-slate-800/80 flex flex-col gap-4 text-xs sm:text-sm text-slate-200 leading-relaxed">
            {report.analysis.map((sec, idx) => {
              const text =
                typeof sec === "string"
                  ? sec
                  : (sec.content as string) || (sec.body as string) || JSON.stringify(sec);

              return (
                <p key={idx} className="whitespace-pre-line">
                  {text}
                </p>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Conclusion */}
      {report.conclusion && (
        <div className="rounded-2xl p-5 bg-slate-900/70 border border-slate-800 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>Conclusion & Synthesis</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
            {report.conclusion}
          </p>
        </div>
      )}

      {/* 6. Cited Sources */}
      {report.sources && report.sources.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-slate-800/80 pt-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Verified Sources ({report.sources.length})</span>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {report.sources.map((src, idx) => {
              const title = (src.title as string) || (src.source_id as string) || `Source ${idx + 1}`;
              const url = (src.url as string) || "";
              const srcId = ((src.source_id as string) || "").toLowerCase();
              const isWeb = srcId.startsWith("web") || (src.source_type as string) === "web";
              const isDoc = (src.source_type as string) === "document" || title.endsWith(".pdf") || title.endsWith(".docx") || title.endsWith(".txt") || title.endsWith(".md");

              return (
                <a
                  key={idx}
                  href={url || "#"}
                  target={url ? "_blank" : undefined}
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 transition-all group"
                >
                  {isWeb ? (
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isDoc ? (
                    <FileText className="w-3.5 h-3.5 text-purple-400" />
                  ) : (
                    <Video className="w-3.5 h-3.5 text-red-500" />
                  )}
                  <span className="font-medium group-hover:text-purple-300 transition-colors truncate max-w-xs">
                    {title}
                  </span>
                  {url && <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
