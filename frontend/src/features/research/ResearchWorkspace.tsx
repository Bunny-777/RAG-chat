import {
  Activity,
  BookOpen,
  BrainCircuit,
  Calculator,
  Check,
  ChevronDown,
  CircleStop,
  Clock3,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileText,
  Globe2,
  History,
  Link2,
  LoaderCircle,
  Menu,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Terminal,
  Trash2,
  X,
  Youtube,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { researchApi, streamResearch } from "./api";
import type {
  ChatSessionSummary,
  CitedSource,
  HealthInfo,
  ResearchMode,
  ResearchPayload,
  ResearchReport,
  ResearchStreamEvent,
  SourceInfo,
  TimelineTurn,
} from "./types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const sessionId = (session: ChatSessionSummary) => session.session_id || session.id || "";
const sourceTitle = (source: CitedSource) => source.title || String(source.metadata?.["name"] || "Untitled source");

function relativeDate(value?: string | number) {
  if (!value) return "Recently";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : formatDistanceToNow(date, { addSuffix: true });
}

function modeLabel(mode: string) {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const text = String(children).replace(/\n$/, "");
  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 overflow-hidden rounded-lg border border-border/80 bg-surface/90 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-3.5 py-1.5 text-[11px] font-mono text-muted-foreground">
        <span>{lang || "code"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-background/80 hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? <Check className="size-3 text-signal" /> : <Copy className="size-3" />}
          <span className="text-[10px]">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 text-xs font-mono leading-relaxed text-foreground">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

function MarkdownContent({ content }: { content?: string | null }) {
  if (!content?.trim()) return null;
  return (
    <div className="claude-prose text-sm leading-relaxed text-foreground/90 space-y-2.5 font-sans">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-lg font-semibold tracking-tight text-foreground mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold tracking-tight text-foreground mt-3.5 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-3 mb-1.5">{children}</h3>,
          h4: ({ children }) => <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-2 mb-1">{children}</h4>,
          p: ({ children }) => <p className="leading-relaxed text-foreground/90 my-1.5">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 my-1.5 marker:text-primary/70 text-foreground/90">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 my-1.5 marker:text-primary/70 text-foreground/90">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5 leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic text-foreground/80">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/50 pl-3.5 py-1 text-muted-foreground my-2.5 bg-primary/5 rounded-r-md">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className && typeof children === "string" && !children.includes("\n");
            if (isInline) {
              return (
                <code className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[12px] text-primary border border-border/40 font-medium" {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
          table: ({ children }) => (
            <div className="my-3.5 w-full overflow-x-auto rounded-lg border border-border shadow-sm">
              <table className="w-full text-left text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/40 border-b border-border text-foreground font-semibold">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-border/60">{children}</tbody>,
          tr: ({ children }) => <tr className="transition-colors hover:bg-muted/20">{children}</tr>,
          th: ({ children }) => <th className="px-3 py-2 font-semibold text-foreground">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 text-foreground/90">{children}</td>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium inline-flex items-center gap-0.5">
              {children}
              <ExternalLink className="inline size-3 opacity-70 ml-0.5" />
            </a>
          ),
          hr: () => <hr className="my-4 border-border/60" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function Logo() {
  return (
    <div className="relative grid size-9 place-items-center rounded-md border border-primary/30 bg-primary/10 shadow-glow">
      <BrainCircuit className="size-5 text-primary" />
      <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border border-background bg-signal" />
    </div>
  );
}

function AppHeader({
  health,
  sessionCount,
  activeSession,
  onMenu,
  onNewChat,
}: {
  health: HealthInfo | null;
  sessionCount: number;
  activeSession?: string;
  onMenu: () => void;
  onNewChat: () => void;
}) {
  const online = health?.status === "ok";
  return (
    <header className="z-30 flex h-16 shrink-0 items-center justify-between border-b border-border/70 bg-background/85 px-4 backdrop-blur-xl md:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenu} aria-label="Open navigation">
          <Menu />
        </Button>
        <Logo />
        <div className="min-w-0">
          <h1 className="truncate font-display text-sm font-semibold text-foreground sm:text-base">AI Research Analyst</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">Intelligent multi-tool research & reasoning</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="hidden sm:flex gap-1.5 text-xs" onClick={onNewChat}>
          <Plus className="size-3.5" />
          <span>New Chat</span>
        </Button>
        <div className="hidden items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 lg:flex">
          <span className={cn("size-1.5 rounded-full", online ? "animate-pulse bg-signal" : "bg-destructive")} />
          <span className="text-xs font-medium">{online ? health?.llm_model || "Model online" : "Service offline"}</span>
          {health?.embedding_model && <span className="border-l border-border pl-2 text-xs text-muted-foreground">{health.embedding_model}</span>}
        </div>
        <Badge variant="outline" className="hidden gap-1.5 border-border bg-surface text-muted-foreground sm:flex">
          <History className="size-3" /> {sessionCount} chats
        </Badge>
        <Badge variant="outline" className="max-w-32 gap-1.5 border-border bg-surface text-muted-foreground">
          <Activity className="size-3" /><span className="truncate">{activeSession ? activeSession.slice(0, 8) : "Active"}</span>
        </Badge>
      </div>
    </header>
  );
}

function WorkspaceSidebar(props: {
  open: boolean;
  onClose: () => void;
  sessions: ChatSessionSummary[];
  activeSession?: string;
  onCreateSession: () => void;
  onSelectSession: (id: string) => void;
  onRemoveSession: (session: ChatSessionSummary) => void;
}) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-border bg-sidebar shadow-2xl transition-transform md:static md:z-20 md:shadow-none",
        !props.open && "-translate-x-full md:w-0 md:overflow-hidden"
      )}
    >
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-sm font-semibold">Research Chats</span>
        </div>
        <Button size="icon" variant="ghost" onClick={props.onClose} aria-label="Close sidebar">
          <PanelLeftClose className="size-4" />
        </Button>
      </div>

      {/* New Chat Button */}
      <div className="p-3 border-b border-border/60">
        <Button
          className="w-full justify-start gap-2 text-xs font-medium shadow-sm"
          variant="secondary"
          onClick={props.onCreateSession}
        >
          <Plus className="size-4 text-primary" />
          <span>New Chat</span>
        </Button>
      </div>

      {/* Session Threads Header */}
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent Threads</p>
        <span className="text-[10px] text-muted-foreground">{props.sessions.length}</span>
      </div>

      {/* Sessions List */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {props.sessions.length === 0 ? (
          <div className="mx-2 mt-6 rounded-lg border border-border/60 bg-background/40 p-5 text-center">
            <History className="mx-auto mb-2 size-6 text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground font-medium">No previous chats yet</p>
            <p className="mt-1 text-[11px] text-muted-foreground/60">Start a research query to create a thread</p>
          </div>
        ) : (
          props.sessions.map((session) => {
            const id = sessionId(session);
            const active = props.activeSession === id;
            return (
              <div
                key={id}
                className={cn(
                  "group flex items-center justify-between gap-1.5 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:bg-accent/60",
                  active && "border-primary/20 bg-primary/10 font-medium"
                )}
              >
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => props.onSelectSession(id)}
                >
                  <p className="truncate text-xs text-foreground">
                    {session.title || "Untitled research"}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span>{relativeDate(session.updated_at || session.created_at)}</span>
                    <span>·</span>
                    <span>{session.turn_count ?? session.message_count ?? 0} msgs</span>
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                  onClick={() => props.onRemoveSession(session)}
                  aria-label="Delete session"
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

function ToolIcon({ tool }: { tool?: string | undefined }) {
  const t = (tool || "").toLowerCase();
  if (t === "web_search" || t === "google") return <Globe2 className="size-4 text-cyan" />;
  if (t === "calculator" || t === "math") return <Calculator className="size-4 text-amber" />;
  if (t === "code_interpreter" || t === "code") return <Terminal className="size-4 text-emerald-400" />;
  if (t === "datetime" || t === "clock") return <Clock3 className="size-4 text-blue-400" />;
  if (t === "wikipedia") return <BookOpen className="size-4 text-purple-400" />;
  if (t === "youtube") return <Youtube className="size-4 text-youtube" />;
  if (t === "url_reader") return <Link2 className="size-4 text-teal-400" />;
  if (t === "rag_search" || t === "document") return <FileText className="size-4 text-violet" />;
  return <Database className="size-4 text-violet" />;
}

function LiveProgress({ turn }: { turn: TimelineTurn }) {
  const thinking = turn.events.filter((event) => event.type === "thinking");
  const visible = turn.events.filter(
    (event) => event.type !== "thinking" && event.type !== "report" && event.type !== "done"
  );
  const found = turn.events
    .filter((event) => event.type === "source_found")
    .map((event) => event.source)
    .filter(Boolean) as CitedSource[];

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-panel">
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Sparkles className="size-4 text-primary" />
            {turn.status === "streaming" && (
              <span className="absolute inset-0 animate-ping rounded-full border border-primary/50" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">Research in progress</p>
            <p className="text-[11px] text-muted-foreground">Live tool & reasoning trace</p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5 border-border text-[10px] uppercase",
            turn.status === "streaming" && "border-amber/30 bg-amber/10 text-amber"
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              turn.status === "streaming" ? "animate-pulse bg-amber" : "bg-muted-foreground"
            )}
          />
          {turn.status}
        </Badge>
      </div>

      <div className="space-y-1 p-3">
        {visible.length === 0 && (
          <div className="flex items-center gap-3 rounded-md px-2 py-3 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin text-primary" />
            Initializing query routing and intelligence…
          </div>
        )}
        {visible.map((event, index) => (
          <div key={index} className="flex items-start gap-3 rounded-md px-2 py-2.5 hover:bg-accent/40">
            <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-border bg-background">
              {event.type === "tool_call" ? (
                <ToolIcon tool={event.tool || event.name} />
              ) : event.type === "source_found" ? (
                <Link2 className="size-4 text-signal" />
              ) : (
                <LoaderCircle
                  className={cn("size-4 text-primary", turn.status === "streaming" && "animate-spin")}
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium">
                {event.message ||
                  event.content ||
                  (event.type === "source_found"
                    ? `Found ${sourceTitle(event.source || {})}`
                    : "Synthesizing evidence")}
              </p>
              <p className="mt-1 text-[11px] uppercase text-muted-foreground">
                {event.tool?.replace("_", " ") || event.type.replace("_", " ")}
              </p>
            </div>
          </div>
        ))}
      </div>

      {thinking.length > 0 && (
        <Collapsible className="border-t border-border">
          <CollapsibleTrigger className="group flex w-full items-center justify-between px-4 py-3 text-xs text-muted-foreground hover:bg-accent/30 hover:text-foreground">
            <span className="flex items-center gap-2">
              <BrainCircuit className="size-3.5" />
              Reasoning process · {thinking.length} steps
            </span>
            <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 px-4 pb-4">
            {thinking.map((event, index) => (
              <div
                key={index}
                className="border-l border-primary/30 pl-3 text-xs leading-relaxed text-muted-foreground"
              >
                {event.message || event.content || event.thought}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {found.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-t border-border px-4 py-3">
          {found.map((source, index) => (
            <Badge key={source.url || index} variant="secondary" className="shrink-0 gap-1.5">
              <Globe2 className="size-3" />
              {source.domain || sourceTitle(source)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function sourceKind(source: CitedSource) {
  const type = source.source_type?.toLowerCase() || "";
  if (type.includes("youtube")) return "YouTube";
  if (type.includes("document") || type.includes("file")) return "Document";
  if (type.includes("academic") || source.url?.includes("arxiv")) return "Academic Paper";
  if (type.includes("wikipedia")) return "Wikipedia";
  if (type.includes("google")) return "Google Search";
  return "Web";
}

function reportMarkdown(report: ResearchReport) {
  const parts: string[] = [];
  if (report.title) parts.push(`# ${report.title}`);
  if (report.query) parts.push(`**Query:** ${report.query}`);
  if (report.executive_summary?.trim()) {
    parts.push(report.executive_summary.trim());
  }
  const findings = (report.key_findings || []).filter(
    (item) => item.title?.trim() || item.finding?.trim() || item.detail?.trim()
  );
  if (findings.length > 0) {
    parts.push(
      `## Key Findings\n` +
        findings
          .map((item) => `- **${item.title || "Finding"}:** ${item.finding || item.detail || ""}`)
          .join("\n")
    );
  }
  const analysis = (report.analysis || []).filter(
    (item) => item.content?.trim() || item.body?.trim()
  );
  if (analysis.length > 0) {
    parts.push(
      `## Detailed Analysis\n` +
        analysis
          .map(
            (item) =>
              `### ${item.heading || item.title || "Analysis"}\n${item.content || item.body || ""}`
          )
          .join("\n\n")
    );
  }
  if (report.conclusion?.trim()) {
    parts.push(`## Conclusion & Recommendations\n${report.conclusion.trim()}`);
  }
  if (report.sources?.length) {
    parts.push(
      `## Sources\n` +
        report.sources
          .map((source) => `- [${sourceTitle(source)}](${source.url || "#"})`)
          .join("\n")
    );
  }
  return parts.join("\n\n");
}

function TooltipButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" onClick={onClick} aria-label={label}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ReportViewer({ report, onRegenerate }: { report: ResearchReport; onRegenerate: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(reportMarkdown(report));
    setCopied(true);
    toast.success("Copied full report as Markdown");
    setTimeout(() => setCopied(false), 2000);
  };

  const exportReport = () => {
    const blob = new Blob([reportMarkdown(report)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(report.title || "research-report").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  const hasExecutiveSummary = Boolean(report.executive_summary?.trim());
  const validFindings = useMemo(
    () => (report.key_findings || []).filter((item) => item.finding?.trim() || item.detail?.trim()),
    [report.key_findings]
  );
  const validAnalysis = useMemo(
    () => (report.analysis || []).filter((item) => item.content?.trim() || item.body?.trim()),
    [report.analysis]
  );
  const hasConclusion = Boolean(report.conclusion?.trim());
  const hasSources = Boolean(report.sources?.length);

  const isDirectAnswerOnly =
    hasExecutiveSummary &&
    validFindings.length === 0 &&
    validAnalysis.length === 0 &&
    !hasConclusion;

  return (
    <article className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-panel">
      {/* Top Header */}
      <div className="border-b border-border/70 bg-surface/70 px-5 py-4 sm:px-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary/15 text-primary text-[11px] hover:bg-primary/15">
                {modeLabel(report.mode)} research
              </Badge>
              {typeof report.latency_ms === "number" && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock3 className="size-3" />
                  {report.latency_ms.toLocaleString()} ms
                </span>
              )}
              {report.session_id && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  {report.session_id.slice(0, 8)}
                </span>
              )}
            </div>
            <h2 className="mt-2 font-display text-lg font-semibold leading-tight text-foreground sm:text-xl">
              {report.title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
            <TooltipButton
              label={copied ? "Copied" : "Copy Markdown"}
              icon={copied ? <Check className="size-3.5 text-signal" /> : <Copy className="size-3.5" />}
              onClick={() => void copy()}
            />
            <TooltipButton label="Export Markdown" icon={<Download className="size-3.5" />} onClick={exportReport} />
            <TooltipButton label="Regenerate" icon={<RefreshCw className="size-3.5" />} onClick={onRegenerate} />
          </div>
        </div>
      </div>

      {/* Body Content */}
      <div className="px-5 py-6 sm:px-7 sm:py-7">
        {isDirectAnswerOnly ? (
          hasExecutiveSummary && <MarkdownContent content={report.executive_summary} />
        ) : (
          <div className="space-y-6">
            {hasExecutiveSummary && (
              <section>
                <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="size-3.5 text-primary" />
                  <span>Summary</span>
                </div>
                <div className="rounded-lg border border-border/60 bg-surface/30 p-4">
                  <MarkdownContent content={report.executive_summary} />
                </div>
              </section>
            )}

            {validFindings.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Key Findings & Evidence</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {validFindings.map((finding, index) => (
                    <div
                      className="rounded-lg border border-border/70 bg-surface/50 p-4 transition-colors hover:border-primary/30"
                      key={index}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                          {index + 1}
                        </span>
                        {finding.title && (
                          <h3 className="text-xs font-semibold text-foreground">
                            {finding.title}
                          </h3>
                        )}
                      </div>
                      <div className="text-xs text-foreground/90">
                        <MarkdownContent content={finding.finding || finding.detail || ""} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {validAnalysis.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Detailed Analysis</span>
                </div>
                <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-surface/30">
                  {validAnalysis.map((item, index) => (
                    <div className="p-4 sm:p-5" key={index}>
                      {(item.heading || item.title) && (
                        <h3 className="mb-2.5 text-sm font-semibold text-foreground">
                          {item.heading || item.title}
                        </h3>
                      )}
                      <MarkdownContent content={item.content || item.body || ""} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {hasConclusion && (
              <section>
                <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Conclusion & Recommendations</span>
                </div>
                <div className="rounded-lg border border-signal/30 bg-signal/5 p-4 sm:p-5">
                  <MarkdownContent content={report.conclusion} />
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Cited Sources Shelf */}
      {hasSources && (
        <div className="border-t border-border/70 bg-surface/40 px-5 py-4 sm:px-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cited sources ({report.sources.length})
            </h3>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {report.sources.map((source, index) => (
              <a
                key={source.url || index}
                href={source.url || "#"}
                target="_blank"
                rel="noreferrer"
                className="group flex w-56 shrink-0 items-center gap-2.5 rounded-lg border border-border/70 bg-background/80 p-2.5 transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-cyan">
                  <ToolIcon tool={source.source_type} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground group-hover:text-primary">
                    {sourceTitle(source)}
                  </p>
                  <p className="text-[10px] uppercase text-muted-foreground">
                    {sourceKind(source)}
                  </p>
                </div>
                <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </a>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function Conversation({
  turns,
  onRegenerate,
  onExample,
}: {
  turns: TimelineTurn[];
  onRegenerate: (turn: TimelineTurn) => void;
  onExample: (text: string) => void;
}) {
  if (!turns.length) {
    return (
      <div className="flex min-h-full items-center justify-center px-5 pb-48 pt-16">
        <div className="max-w-2xl text-center">
          <div className="mx-auto mb-6 grid size-14 place-items-center rounded-xl border border-primary/25 bg-primary/10 shadow-glow">
            <Sparkles className="size-6 text-primary" />
          </div>
          <p className="mb-2 font-mono text-[10px] uppercase text-primary tracking-wider">
            AI Research Assistant Ready
          </p>
          <h2 className="font-display text-2xl font-semibold sm:text-3xl text-foreground">
            What would you like to investigate?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Ask questions, upload documents (PDF/Word/TXT), paste YouTube or web links, or run math and Python logic in real-time.
          </p>
          <div className="mt-7 grid gap-2.5 text-left sm:grid-cols-3">
            {[
              "Compare the latest agentic AI frameworks with citations",
              "What is today's date and time in UTC?",
              "Calculate sqrt(144) * 25 + 18",
            ].map((text) => (
              <button
                key={text}
                onClick={() => onExample(text)}
                className="rounded-lg border border-border bg-surface/80 p-3.5 text-xs leading-relaxed text-muted-foreground transition-all hover:border-primary/40 hover:bg-accent/40 hover:text-foreground"
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 pb-52 pt-8 sm:px-6">
      {turns.map((turn) => (
        <div className="space-y-4" key={turn.id}>
          <div className="ml-auto max-w-2xl">
            <div className="rounded-lg rounded-tr-sm border border-primary/20 bg-primary/10 px-4 py-3">
              <p className="text-sm leading-relaxed text-foreground">{turn.query}</p>
            </div>
            <p className="mt-1.5 text-right text-[10px] text-muted-foreground">
              {new Date(turn.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          {turn.report ? (
            <ReportViewer report={turn.report} onRegenerate={() => onRegenerate(turn)} />
          ) : (
            <LiveProgress turn={turn} />
          )}
          {turn.error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {turn.error}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function PromptDock({
  mode,
  setMode,
  webSearch,
  setWebSearch,
  query,
  setQuery,
  youtubeUrl,
  setYoutubeUrl,
  attachedFiles,
  onAttachFiles,
  onRemoveAttachedFile,
  streaming,
  onSubmit,
  onCancel,
}: {
  mode: ResearchMode;
  setMode: (mode: ResearchMode) => void;
  webSearch: boolean;
  setWebSearch: (value: boolean) => void;
  query: string;
  setQuery: (query: string) => void;
  youtubeUrl: string;
  setYoutubeUrl: (url: string) => void;
  attachedFiles: File[];
  onAttachFiles: (files: File[]) => void;
  onRemoveAttachedFile: (index: number) => void;
  streaming: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const [attachUrlOpen, setAttachUrlOpen] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = "0px";
      textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 160)}px`;
    }
  }, [query]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:left-[var(--workspace-offset,0px)]">
      <div className="prompt-fade mx-auto max-w-5xl px-3 pb-4 pt-12 sm:px-6 sm:pb-6">
        <div className="pointer-events-auto overflow-hidden rounded-xl border border-border bg-dock/95 shadow-dock backdrop-blur-xl">
          {/* File Attachment Badges */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b border-border/60 bg-muted/20 px-3.5 py-2">
              {attachedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs shadow-sm"
                >
                  <FileText className="size-3.5 text-primary" />
                  <span className="max-w-[180px] truncate font-medium text-foreground">{file.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    ({Math.round(file.size / 1024)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachedFile(idx)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    aria-label="Remove attachment"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* YouTube / Direct Link Input Header */}
          {attachUrlOpen && (
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Youtube className="size-4 shrink-0 text-youtube" />
              <Input
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="Attach YouTube link (or just paste directly in prompt)"
                className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0 text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => {
                  setAttachUrlOpen(false);
                  setYoutubeUrl("");
                }}
                aria-label="Remove URL attachment"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          )}

          {/* Prompt Area with Paperclip & Send */}
          <div className="flex items-end gap-2 px-3 pt-3">
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,.csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  onAttachFiles(Array.from(e.target.files));
                  e.target.value = "";
                }
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mb-1 size-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach file (PDF, DOCX, TXT, MD, CSV)"
              title="Attach documents"
            >
              <Paperclip className="size-4" />
            </Button>

            <Textarea
              ref={textarea}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              placeholder="Ask anything, attach files, or paste YouTube/web links…"
              className="max-h-40 min-h-11 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm shadow-none focus-visible:ring-0"
            />

            <Button
              size="icon"
              className={cn(
                "mb-1 shrink-0",
                streaming && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
              disabled={!streaming && !query.trim() && attachedFiles.length === 0}
              onClick={streaming ? onCancel : onSubmit}
              aria-label={streaming ? "Stop research" : "Send research query"}
            >
              {streaming ? <CircleStop /> : <Send />}
            </Button>
          </div>

          {/* Bottom Toolbar: Modes & Switches */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-md bg-background p-0.5 border border-border/60">
                {(["quick", "standard", "deep"] as ResearchMode[]).map((item) => (
                  <button
                    key={item}
                    onClick={() => setMode(item)}
                    className={cn(
                      "rounded-sm px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors",
                      mode === item && "bg-secondary text-foreground shadow-sm"
                    )}
                  >
                    {modeLabel(item)}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                <Globe2 className="size-3 text-cyan" />
                <span className="hidden sm:inline">Web Search</span>
                <Switch checked={webSearch} onCheckedChange={setWebSearch} className="scale-75" />
              </label>

              {attachedFiles.length > 0 && (
                <Badge variant="outline" className="h-7 gap-1.5 border-border bg-background text-[11px] text-primary">
                  <FileText className="size-3" />
                  {attachedFiles.length} file{attachedFiles.length > 1 ? "s" : ""} attached
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-7 px-2 text-xs text-muted-foreground", attachUrlOpen && "text-youtube")}
                onClick={() => setAttachUrlOpen(!attachUrlOpen)}
              >
                <Youtube className="size-3.5" />
                <span className="hidden sm:inline">Attach Link</span>
              </Button>
            </div>
          </div>
        </div>
        <p className="pointer-events-auto mt-2 text-center text-[10px] text-muted-foreground">
          Enter to send · Shift+Enter for a new line · Attach PDFs, DOCX, or paste YouTube URLs directly
        </p>
      </div>
    </div>
  );
}

const LOCAL_STORAGE_SESSION_KEY = "rag_chat_active_session_id";
const LOCAL_STORAGE_TURNS_PREFIX = "rag_chat_turns_";

export function ResearchWorkspace() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<string | undefined>(() => {
    return localStorage.getItem(LOCAL_STORAGE_SESSION_KEY) || undefined;
  });
  const [turns, setTurns] = useState<TimelineTurn[]>(() => {
    const savedSession = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    if (savedSession) {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_TURNS_PREFIX}${savedSession}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [];
        }
      }
    }
    return [];
  });
  const [query, setQuery] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<ResearchMode>("standard");
  const [webSearch, setWebSearch] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ChatSessionSummary | undefined>(undefined);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const streaming = turns.some((turn) => turn.status === "streaming");

  // Save activeSession and turns to localStorage
  useEffect(() => {
    if (activeSession) {
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, activeSession);
      localStorage.setItem(`${LOCAL_STORAGE_TURNS_PREFIX}${activeSession}`, JSON.stringify(turns));
    }
  }, [activeSession, turns]);

  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setSidebarOpen(false);
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const data = await researchApi.sessions();
      setSessions(data);
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    void researchApi.health().then(setHealth).catch(() => setHealth(null));
    void loadSessions();
  }, [loadSessions]);

  const createSession = async () => {
    try {
      const session = await researchApi.createSession();
      const id = sessionId(session);
      setActiveSession(id || undefined);
      setTurns([]);
      await loadSessions();
      toast.success("New research session created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create session");
    }
  };

  const selectSession = async (id: string) => {
    try {
      setActiveSession(id);
      // First check local cache for immediate feedback
      const local = localStorage.getItem(`${LOCAL_STORAGE_TURNS_PREFIX}${id}`);
      if (local) {
        try {
          setTurns(JSON.parse(local));
        } catch {
          // ignore
        }
      }
      const detail = await researchApi.session(id);
      const history = detail.turns || detail.messages || [];
      const remoteTurns = history.reduce<TimelineTurn[]>((acc, item, index) => {
        if (item.role === "user") {
          acc.push({
            id: item.id || `${id}-${index}`,
            query: item.query || item.content || "Research query",
            createdAt: item.created_at || item.timestamp || new Date().toISOString(),
            status: "complete",
            events: [],
          });
        } else {
          const last = acc.at(-1);
          if (last && item.report) last.report = item.report;
          else if (last && item.content) last.events.push({ type: "analysis", content: item.content });
        }
        return acc;
      }, []);
      setTurns(remoteTurns);
      if (window.innerWidth < 768) setSidebarOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load session");
    }
  };

  const handleAttachFiles = (files: File[]) => {
    const valid = files.filter((file) => /\.(pdf|docx|txt|md|csv)$/i.test(file.name));
    if (!valid.length) {
      toast.error("Please select a PDF, Word DOCX, TXT, Markdown, or CSV file.");
      return;
    }
    setAttachedFiles((prev) => [...prev, ...valid]);
    toast.success(`Attached ${valid.length} document${valid.length > 1 ? "s" : ""}`);
  };

  const handleRemoveAttachedFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = useCallback(
    async (override?: string) => {
      const text = (override || query).trim();
      if ((!text && attachedFiles.length === 0) || streaming) return;

      const finalText = text || "Please summarize and analyze the attached document(s).";

      let currentSession = activeSession;
      if (!currentSession) {
        try {
          const created = await researchApi.createSession(finalText.slice(0, 64));
          currentSession = sessionId(created) || undefined;
          setActiveSession(currentSession);
          await loadSessions();
        } catch {
          /* Fallback */
        }
      }

      // 1. Upload any attached files first
      let uploadedSourceIds: string[] = [];
      if (attachedFiles.length > 0) {
        toast.info(`Indexing ${attachedFiles.length} attached document(s)...`);
        for (const file of attachedFiles) {
          try {
            const src = await researchApi.uploadFile(file);
            const sid = src.source_id || src.id;
            if (sid) uploadedSourceIds.push(sid);
          } catch (uploadErr) {
            toast.error(`Failed to index file '${file.name}': ${uploadErr instanceof Error ? uploadErr.message : "Upload error"}`);
          }
        }
        setAttachedFiles([]);
      }

      const id = crypto.randomUUID();
      const turn: TimelineTurn = {
        id,
        query: finalText,
        createdAt: new Date().toISOString(),
        status: "streaming",
        events: [],
      };

      setTurns((current) => [...current, turn]);
      setQuery("");

      const controller = new AbortController();
      abortRef.current = controller;

      const payload: ResearchPayload = {
        query: finalText,
        session_id: currentSession,
        source_ids: uploadedSourceIds.length > 0 ? uploadedSourceIds : undefined,
        options: { mode, web_search: webSearch },
        youtube_url: youtubeUrl.trim() || undefined,
      };

      try {
        await streamResearch(
          payload,
          (event: ResearchStreamEvent) =>
            setTurns((current) =>
              current.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      events: [...item.events, event],
                      report:
                        event.report ||
                        (event.type === "report" ? (event.data as ResearchReport) : undefined) ||
                        item.report,
                      status: event.type === "done" ? "complete" : item.status,
                    }
                  : item
              )
            ),
          controller.signal
        );
        setTurns((current) =>
          current.map((item) => (item.id === id ? { ...item, status: "complete" } : item))
        );
        setYoutubeUrl("");
        void loadSessions();
      } catch (error) {
        const cancelled = error instanceof DOMException && error.name === "AbortError";
        setTurns((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: cancelled ? "cancelled" : "error",
                  error: cancelled ? undefined : error instanceof Error ? error.message : "Research failed",
                }
              : item
          )
        );
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Research failed");
      } finally {
        abortRef.current = undefined;
      }
    },
    [activeSession, attachedFiles, loadSessions, mode, query, streaming, webSearch, youtubeUrl]
  );

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const id = sessionId(deleteTarget);
      await researchApi.removeSession(id);
      if (activeSession === id) {
        setActiveSession(undefined);
        setTurns([]);
        localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
      }
      await loadSessions();
      toast.success("Session deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeleteTarget(undefined);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="flex h-svh overflow-hidden bg-background text-foreground"
        style={{ "--workspace-offset": sidebarOpen ? "280px" : "0px" } as React.CSSProperties}
      >
        {sidebarOpen && (
          <button
            className="fixed inset-0 z-40 bg-overlay md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation overlay"
          />
        )}

        {/* ChatGPT-style Unified History Sidebar */}
        <WorkspaceSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          sessions={sessions}
          {...(activeSession ? { activeSession } : {})}
          onCreateSession={() => void createSession()}
          onSelectSession={(id) => void selectSession(id)}
          onRemoveSession={(session) => setDeleteTarget(session)}
        />

        {/* Main Workspace */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <AppHeader
            health={health}
            sessionCount={sessions.length}
            {...(activeSession ? { activeSession } : {})}
            onMenu={() => setSidebarOpen(true)}
            onNewChat={() => void createSession()}
          />

          <Button
            variant="outline"
            size="icon"
            className={cn(
              "absolute left-3 top-20 z-20 hidden bg-background md:flex",
              sidebarOpen && "hidden"
            )}
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <PanelLeftOpen className="size-4" />
          </Button>

          <main className="min-h-0 flex-1 overflow-y-auto">
            <Conversation
              turns={turns}
              onRegenerate={(turn) => void submit(turn.query)}
              onExample={setQuery}
            />
          </main>

          <PromptDock
            mode={mode}
            setMode={setMode}
            webSearch={webSearch}
            setWebSearch={setWebSearch}
            query={query}
            setQuery={setQuery}
            youtubeUrl={youtubeUrl}
            setYoutubeUrl={setYoutubeUrl}
            attachedFiles={attachedFiles}
            onAttachFiles={handleAttachFiles}
            onRemoveAttachedFile={handleRemoveAttachedFile}
            streaming={streaming}
            onSubmit={() => void submit()}
            onCancel={() => abortRef.current?.abort()}
          />
        </div>

        {/* Confirmation Dialog */}
        <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(undefined)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete session?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove this research conversation and its history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void confirmDelete()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
