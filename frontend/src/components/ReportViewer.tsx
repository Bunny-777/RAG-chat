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
  Scale,
  Sparkles,
  BookOpen,
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

  const renderSourceChip = (src: Record<string, unknown>, idx: number) => {
    const title = (src.title as string) || (src.source_id as string) || `Source ${idx + 1}`;
    const url = (src.url as string) || "";
    const srcType = ((src.source_type as string) || "").toLowerCase();
    const isPaper = srcType === "research_paper" || srcType === "arxiv" || url.includes("arxiv.org") || title.toLowerCase().includes("arxiv");
    const isDoc = srcType === "document" || title.endsWith(".pdf") || title.endsWith(".docx") || title.endsWith(".txt") || title.endsWith(".md");
    const isWeb = srcType === "web" || srcType === "wikipedia" || (!isPaper && !isDoc && url.startsWith("http"));

    let domain = "";
    if (url) {
      try {
        domain = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        domain = "";
      }
    }

    return (
      <a
        key={idx}
        href={url || "#"}
        target={url ? "_blank" : undefined}
        rel="noreferrer"
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 transition-all group shadow-sm hover:scale-[1.02]"
        title={url ? `Open external link: ${url}` : title}
      >
        {isPaper ? (
          <BookOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        ) : isWeb ? (
          <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        ) : isDoc ? (
          <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
        ) : (
          <Video className="w-3.5 h-3.5 text-red-500 shrink-0" />
        )}
        
        {domain && (
          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-semibold shrink-0">
            {domain}
          </span>
        )}

        <span className="font-medium group-hover:text-purple-300 transition-colors truncate max-w-[220px]">
          {title}
        </span>
        {url && <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-300 shrink-0" />}
      </a>
    );
  };

  // =========================================================================
  // LEVEL 1: QUICK MODE - FAST FLASH RESPONSE
  // =========================================================================
  if (report.mode === "quick") {
    return (
      <div className="glass rounded-2xl p-5 border border-amber-500/30 max-w-4xl mx-auto w-full shadow-2xl bg-slate-950/80 animate-fade-in-up flex flex-col gap-4">
        {/* Quick Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-semibold flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              Quick Flash
            </span>
            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              {formatLatency(report.latency_ms)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-300 transition-all active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Direct Answer Content */}
        <div className="text-slate-100 text-sm sm:text-base leading-relaxed whitespace-pre-line py-1 font-sans">
          {report.executive_summary || report.conclusion || "No answer generated."}
        </div>

        {/* Sources footer if available */}
        {report.sources && report.sources.length > 0 && (
          <div className="flex items-center gap-2 pt-3 border-t border-slate-800/60 flex-wrap">
            <span className="text-[10px] uppercase font-mono text-slate-500 font-semibold">
              Source:
            </span>
            {report.sources.map((src, i) => renderSourceChip(src as unknown as Record<string, unknown>, i))}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // LEVEL 3: DEEP MODE - EXHAUSTIVE COMPARATIVE INVESTIGATION
  // =========================================================================
  if (report.mode === "deep") {
    return (
      <div className="glass rounded-3xl p-6 sm:p-8 border border-pink-500/30 max-w-4xl mx-auto w-full shadow-2xl bg-slate-950/85 animate-fade-in-up flex flex-col gap-7">
        {/* Deep Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[11px] uppercase font-mono px-3 py-0.5 rounded-full bg-pink-500/15 text-pink-400 border border-pink-500/30 font-bold flex items-center gap-1.5 shadow-sm">
                <Brain className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
                Deep Investigation
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/30 text-xs font-medium text-pink-200 transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-pink-300" />
              <span>Dossier</span>
            </button>
          </div>
        </div>

        {/* 1. Deep Executive Framing */}
        {report.executive_summary && (
          <div className="relative rounded-2xl p-5 bg-gradient-to-br from-pink-950/25 via-slate-900/50 to-purple-950/30 border border-pink-500/30 shadow-lg">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-pink-400">
              <Quote className="w-4 h-4 text-pink-400" />
              <span>Executive Problem Framing & Hypothesis</span>
            </div>
            <p className="text-sm sm:text-base text-slate-100 leading-relaxed font-sans">
              {report.executive_summary}
            </p>
          </div>
        )}

        {/* 2. Comparative Matrix & In-Depth Analytical Points */}
        {report.analysis && report.analysis.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-pink-300">
              <Scale className="w-4 h-4 text-pink-400" />
              <span>Comparative Analysis & Multi-Perspective Synthesis</span>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              {report.analysis.map((sec, idx) => {
                const text = typeof sec === "string" ? sec : (sec.content as string) || (sec.body as string) || JSON.stringify(sec);
                return (
                  <div
                    key={idx}
                    className="rounded-2xl p-4 sm:p-5 bg-slate-900/60 border border-slate-800/80 hover:border-pink-500/30 transition-all text-xs sm:text-sm text-slate-200 leading-relaxed"
                  >
                    <div className="flex items-center gap-2 text-pink-400/80 text-[11px] font-mono font-bold mb-2">
                      <span>DIMENSION {idx + 1}</span>
                    </div>
                    <div className="whitespace-pre-line text-slate-100">
                      {text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Deep Key Findings */}
        {report.key_findings && report.key_findings.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Critical Evidence Findings</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {report.key_findings.map((item, idx) => {
                const text = typeof item === "string" ? item : (item.finding as string) || (item.detail as string) || JSON.stringify(item);
                return (
                  <div
                    key={idx}
                    className="rounded-2xl p-4 bg-slate-900/50 border border-slate-800 hover:border-amber-500/30 transition-all flex items-start gap-3 shadow-md"
                  >
                    <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. Strategic Conclusion & Next Steps */}
        {report.conclusion && (
          <div className="rounded-2xl p-5 bg-gradient-to-r from-slate-900/90 to-slate-900/60 border border-emerald-500/30 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Strategic Conclusions & Actionable Directives</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
              {report.conclusion}
            </p>
          </div>
        )}

        {/* 5. Complete Sources Index */}
        {report.sources && report.sources.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-800/80 pt-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Verified Research Sources ({report.sources.length})</span>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {report.sources.map((src, idx) => renderSourceChip(src as unknown as Record<string, unknown>, idx))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // LEVEL 2: STANDARD MODE - BALANCED RESEARCH BRIEF
  // =========================================================================
  return (
    <div className="glass rounded-3xl p-6 sm:p-8 border border-indigo-500/20 max-w-4xl mx-auto w-full shadow-2xl bg-slate-950/80 animate-fade-in-up flex flex-col gap-7">
      {/* Standard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Standard Brief
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-xs font-medium text-indigo-200 transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-indigo-300" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* 1. Executive Summary */}
      {report.executive_summary && (
        <div className="relative rounded-2xl p-5 bg-gradient-to-br from-indigo-950/25 via-slate-900/40 to-purple-950/25 border border-indigo-500/30 shadow-lg">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
            <Quote className="w-4 h-4 text-indigo-400" />
            <span>Executive Summary</span>
          </div>
          <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-sans">
            {report.executive_summary}
          </p>
        </div>
      )}

      {/* 2. Key Findings */}
      {report.key_findings && report.key_findings.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Key Research Findings</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {report.key_findings.map((item, idx) => {
              const text = typeof item === "string" ? item : (item.finding as string) || (item.detail as string) || JSON.stringify(item);
              return (
                <div
                  key={idx}
                  className="rounded-2xl p-4 bg-slate-900/60 border border-slate-800 hover:border-indigo-500/30 transition-all flex items-start gap-3 shadow-md"
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Detailed Analysis */}
      {report.analysis && report.analysis.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <FileText className="w-4 h-4 text-sky-400" />
            <span>Detailed Synthesis</span>
          </div>

          <div className="rounded-2xl p-5 bg-slate-900/40 border border-slate-800/80 flex flex-col gap-4 text-xs sm:text-sm text-slate-200 leading-relaxed">
            {report.analysis.map((sec, idx) => {
              const text = typeof sec === "string" ? sec : (sec.content as string) || (sec.body as string) || JSON.stringify(sec);
              return (
                <p key={idx} className="whitespace-pre-line">
                  {text}
                </p>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Conclusion */}
      {report.conclusion && (
        <div className="rounded-2xl p-5 bg-slate-900/70 border border-slate-800 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>Conclusion</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
            {report.conclusion}
          </p>
        </div>
      )}

      {/* 5. Cited Sources */}
      {report.sources && report.sources.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-slate-800/80 pt-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Verified Sources ({report.sources.length})</span>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {report.sources.map((src, idx) => renderSourceChip(src as unknown as Record<string, unknown>, idx))}
          </div>
        </div>
      )}
    </div>
  );
};
