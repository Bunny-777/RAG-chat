import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isYoutubeUrl(value: string): boolean {
  return /youtu\.?be/i.test(value);
}

export function formatLatency(ms: number): string {
  if (!ms && ms !== 0) return "-";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function reportToMarkdown(report: {
  title: string;
  mode: string;
  latency_ms: number;
  executive_summary: string;
  key_findings: Array<Record<string, unknown>>;
  analysis: Array<Record<string, unknown>>;
  conclusion: string;
  sources: Array<Record<string, unknown>>;
}): string {
  const lines: string[] = [];
  lines.push(`# ${report.title}`);
  lines.push("");
  lines.push(`_Mode: ${report.mode} | Latency: ${formatLatency(report.latency_ms)}_`);
  lines.push("");
  lines.push("## Executive Summary");
  lines.push("");
  lines.push(report.executive_summary || "");
  lines.push("");
  lines.push("## Key Findings");
  lines.push("");
  report.key_findings?.forEach((f, i) => {
    const title = (f.title as string) || (f.finding as string) || `Finding ${i + 1}`;
    const detail = (f.detail as string) || (f.finding as string) || "";
    lines.push(`- **${title}**${detail && detail !== title ? `: ${detail}` : ""}`);
  });
  lines.push("");
  lines.push("## Detailed Analysis");
  lines.push("");
  report.analysis?.forEach((a) => {
    const heading = (a.heading as string) || (a.title as string) || "";
    const content = (a.content as string) || (a.body as string) || "";
    if (heading) lines.push(`### ${heading}`);
    lines.push(content);
    lines.push("");
  });
  lines.push("## Conclusion");
  lines.push("");
  lines.push(report.conclusion || "");
  lines.push("");
  lines.push("## Sources");
  lines.push("");
  report.sources?.forEach((s) => {
    const title = (s.title as string) || (s.url as string) || "Source";
    const url = (s.url as string) || "";
    lines.push(url ? `- [${title}](${url})` : `- ${title}`);
  });
  return lines.join("\n");
}

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
