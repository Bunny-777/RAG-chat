import {
  Activity,
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
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  UploadCloud,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const sourceId = (source: SourceInfo) => source.source_id || source.id || "";
const sessionId = (session: ChatSessionSummary) => session.session_id || session.id || "";
const sourceTitle = (source: CitedSource) => source.title || String(source.metadata?.["name"] || "Untitled source");

function relativeDate(value?: string) {
  if (!value) return "Recently";
  const date = new Date(value);
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

function AppHeader({ health, sourceCount, activeSession, onMenu }: {
  health: HealthInfo | null;
  sourceCount: number;
  activeSession?: string;
  onMenu: () => void;
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
          <p className="hidden text-xs text-muted-foreground sm:block">Multi-source intelligence workspace</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 lg:flex">
          <span className={cn("size-1.5 rounded-full", online ? "animate-pulse bg-signal" : "bg-destructive")} />
          <span className="text-xs font-medium">{online ? health?.llm_model || "Model online" : "Service offline"}</span>
          {health?.embedding_model && <span className="border-l border-border pl-2 text-xs text-muted-foreground">{health.embedding_model}</span>}
        </div>
        <Badge variant="outline" className="hidden gap-1.5 border-border bg-surface text-muted-foreground sm:flex">
          <Database className="size-3" /> {sourceCount} sources
        </Badge>
        <Badge variant="outline" className="max-w-32 gap-1.5 border-border bg-surface text-muted-foreground">
          <Activity className="size-3" /><span className="truncate">{activeSession ? activeSession.slice(0, 8) : "No session"}</span>
        </Badge>
      </div>
    </header>
  );
}

function RagSettings({ chunkSize, setChunkSize, overlap, setOverlap, topK, setTopK }: {
  chunkSize: number; setChunkSize: (n: number) => void;
  overlap: number; setOverlap: (n: number) => void;
  topK: number; setTopK: (n: number) => void;
}) {
  const settings: Array<[string, number, number, number, number, (value: number) => void]> = [
    ["Chunk size", chunkSize, 200, 2000, 50, setChunkSize],
    ["Overlap", overlap, 0, 500, 10, setOverlap],
    ["Top-K", topK, 1, 20, 1, setTopK],
  ];
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex w-full items-center justify-between py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
        <span className="flex items-center gap-2"><Settings2 className="size-3.5" />Advanced chunking</span>
        <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pb-1 pt-2">
        {settings.map(([label, value, min, max, step, setter]) => (
          <div className="space-y-2" key={String(label)}>
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-mono text-foreground">{value}</span></div>
            <Slider value={[value]} min={min} max={max} step={step} onValueChange={([next]) => { if (next !== undefined) setter(next); }} />
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SourcesPanel({ sources, selected, onToggle, onRefresh, onRemove }: {
  sources: SourceInfo[];
  selected: string[];
  onToggle: (id: string) => void;
  onRefresh: () => void;
  onRemove: (source: SourceInfo) => void;
}) {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [chunkSize, setChunkSize] = useState(800);
  const [overlap, setOverlap] = useState(120);
  const [topK, setTopK] = useState(5);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const ingestYoutube = async () => {
    if (!youtubeUrl.trim()) return;
    setUploading(true);
    try {
      await researchApi.uploadYouTube({ url: youtubeUrl.trim(), ...(transcript.trim() ? { manual_transcript: transcript.trim() } : {}), chunk_size: chunkSize, chunk_overlap: overlap, k: topK });
      setYoutubeUrl(""); setTranscript(""); onRefresh(); toast.success("YouTube source indexed");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed"); }
    finally { setUploading(false); }
  };
  const uploadFiles = async (files: FileList | File[]) => {
    const valid = Array.from(files).filter((file) => /\.(pdf|docx|txt|md)$/i.test(file.name));
    if (!valid.length) { toast.error("Choose a PDF, DOCX, TXT, or Markdown file"); return; }
    setUploading(true);
    try {
      for (const file of valid) await researchApi.uploadFile(file, { chunk_size: chunkSize, chunk_overlap: overlap, k: topK });
      onRefresh(); toast.success(`${valid.length} document${valid.length > 1 ? "s" : ""} indexed`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed"); }
    finally { setUploading(false); }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-4 border-b border-border p-4">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><Youtube className="size-3.5 text-youtube" />YouTube importer</label>
          <div className="flex gap-2">
            <Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="Paste video URL" className="h-9 bg-background" />
            <Button size="icon" variant="secondary" disabled={!youtubeUrl.trim() || uploading} onClick={ingestYoutube} aria-label="Import YouTube video">
              {uploading ? <LoaderCircle className="animate-spin" /> : <Plus />}
            </Button>
          </div>
          <Textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Optional transcript override" className="min-h-16 resize-none bg-background text-xs" />
        </div>
        <button type="button" onClick={() => fileInput.current?.click()} onDragOver={(e) => {e.preventDefault(); setDragging(true);}} onDragLeave={() => setDragging(false)} onDrop={(e) => {e.preventDefault(); setDragging(false); void uploadFiles(e.dataTransfer.files);}} className={cn("group flex w-full flex-col items-center justify-center rounded-md border border-dashed border-border bg-background/60 px-3 py-5 text-center transition-all hover:border-primary/50 hover:bg-primary/5", dragging && "border-primary bg-primary/10")}>
          <UploadCloud className="mb-2 size-5 text-muted-foreground group-hover:text-primary" />
          <span className="text-xs font-medium">Drop documents or browse</span>
          <span className="mt-1 text-[11px] text-muted-foreground">PDF · DOCX · TXT · MD</span>
        </button>
        <input ref={fileInput} type="file" multiple accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => e.target.files && void uploadFiles(e.target.files)} />
        <RagSettings chunkSize={chunkSize} setChunkSize={setChunkSize} overlap={overlap} setOverlap={setOverlap} topK={topK} setTopK={setTopK} />
      </div>
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Knowledge base</p>
        <span className="text-[11px] text-muted-foreground">{selected.length}/{sources.length} active</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {sources.length === 0 ? (
          <div className="mx-2 mt-3 rounded-md border border-border/70 bg-background/40 p-4 text-center"><Database className="mx-auto mb-2 size-5 text-muted-foreground" /><p className="text-xs text-muted-foreground">No indexed sources yet</p></div>
        ) : sources.map((source) => {
          const id = sourceId(source); const isVideo = source.source_type?.toLowerCase().includes("youtube") || source.url?.includes("youtu");
          return <div key={id} className="group flex items-start gap-2 rounded-md px-2 py-2.5 hover:bg-accent/60">
            <Checkbox checked={selected.includes(id)} onCheckedChange={() => onToggle(id)} aria-label={`Select ${sourceTitle(source)}`} className="mt-1" />
            <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-secondary">{isVideo ? <Youtube className="size-3.5 text-youtube" /> : <FileText className="size-3.5 text-cyan" />}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{sourceTitle(source)}</p><p className="mt-1 text-[11px] text-muted-foreground">{source.chunk_count ?? source.chunks ?? 0} chunks</p></div>
            <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
              {source.url && <Button asChild variant="ghost" size="icon" className="size-7"><a href={source.url} target="_blank" rel="noreferrer" aria-label="Open source"><ExternalLink className="size-3" /></a></Button>}
              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => onRemove(source)} aria-label="Delete source"><Trash2 className="size-3" /></Button>
            </div>
          </div>;
        })}
      </div>
    </div>
  );
}

function SessionsPanel({ sessions, activeId, onCreate, onSelect, onRemove }: {
  sessions: ChatSessionSummary[]; activeId?: string;
  onCreate: () => void; onSelect: (id: string) => void; onRemove: (session: ChatSessionSummary) => void;
}) {
  return <div className="flex h-full flex-col">
    <div className="border-b border-border p-4"><Button className="w-full" variant="secondary" onClick={onCreate}><MessageSquarePlus />New research chat</Button></div>
    <div className="flex items-center justify-between px-4 pb-2 pt-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Recent threads</p><span className="text-[11px] text-muted-foreground">{sessions.length}</span></div>
    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
      {sessions.length === 0 ? <div className="mx-2 mt-3 rounded-md border border-border/70 bg-background/40 p-4 text-center"><History className="mx-auto mb-2 size-5 text-muted-foreground" /><p className="text-xs text-muted-foreground">No previous sessions</p></div> : sessions.map((session) => {
        const id = sessionId(session); const active = activeId === id;
        return <div key={id} className={cn("group mb-1 flex items-start gap-2 rounded-md border border-transparent px-3 py-3 hover:bg-accent/60", active && "border-primary/20 bg-primary/10")}>
          <button className="min-w-0 flex-1 text-left" onClick={() => onSelect(id)}><p className="truncate text-xs font-medium">{session.title || "Untitled research"}</p><div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground"><span>{relativeDate(session.updated_at || session.created_at)}</span><span>·</span><span>{session.message_count ?? session.turn_count ?? 0} messages</span></div></button>
          <Button variant="ghost" size="icon" className="size-7 opacity-0 group-hover:opacity-100" onClick={() => onRemove(session)} aria-label="Delete session"><Trash2 className="size-3 text-muted-foreground" /></Button>
        </div>;
      })}
    </div>
  </div>;
}

function WorkspaceSidebar(props: {
  open: boolean; onClose: () => void; sources: SourceInfo[]; selected: string[]; sessions: ChatSessionSummary[]; activeSession?: string;
  onToggleSource: (id: string) => void; onRefreshSources: () => void; onRemoveSource: (source: SourceInfo) => void;
  onCreateSession: () => void; onSelectSession: (id: string) => void; onRemoveSession: (session: ChatSessionSummary) => void;
}) {
  return <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[310px] flex-col border-r border-border bg-sidebar shadow-2xl transition-transform md:static md:z-20 md:shadow-none", !props.open && "-translate-x-full md:w-0")}>
    <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4"><div className="flex items-center gap-2"><Logo /><span className="text-sm font-semibold md:hidden">Research Analyst</span></div><Button size="icon" variant="ghost" onClick={props.onClose} aria-label="Close sidebar"><PanelLeftClose /></Button></div>
    <Tabs defaultValue="sources" className="flex min-h-0 flex-1 flex-col">
      <TabsList className="mx-3 mt-3 grid h-9 grid-cols-2 bg-background"><TabsTrigger value="sources" className="text-xs"><Database className="size-3.5" />Sources</TabsTrigger><TabsTrigger value="sessions" className="text-xs"><History className="size-3.5" />History</TabsTrigger></TabsList>
      <TabsContent value="sources" className="mt-1 min-h-0 flex-1"><SourcesPanel sources={props.sources} selected={props.selected} onToggle={props.onToggleSource} onRefresh={props.onRefreshSources} onRemove={props.onRemoveSource} /></TabsContent>
      <TabsContent value="sessions" className="mt-1 min-h-0 flex-1"><SessionsPanel sessions={props.sessions} {...(props.activeSession ? { activeId: props.activeSession } : {})} onCreate={props.onCreateSession} onSelect={props.onSelectSession} onRemove={props.onRemoveSession} /></TabsContent>
    </Tabs>
  </aside>;
}

function ToolIcon({ tool }: { tool?: string | undefined }) {
  if (tool === "web_search") return <Globe2 className="size-4 text-cyan" />;
  if (tool === "calculator") return <Calculator className="size-4 text-amber" />;
  return <Database className="size-4 text-violet" />;
}

function LiveProgress({ turn }: { turn: TimelineTurn }) {
  const thinking = turn.events.filter((event) => event.type === "thinking");
  const visible = turn.events.filter((event) => event.type !== "thinking" && event.type !== "report" && event.type !== "done");
  const found = turn.events.filter((event) => event.type === "source_found").map((event) => event.source).filter(Boolean) as CitedSource[];
  return <div className="overflow-hidden rounded-lg border border-border bg-card shadow-panel">
    <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3"><div className="flex items-center gap-2.5"><div className="relative"><Sparkles className="size-4 text-primary" />{turn.status === "streaming" && <span className="absolute inset-0 animate-ping rounded-full border border-primary/50" />}</div><div><p className="text-sm font-medium">Research in progress</p><p className="text-[11px] text-muted-foreground">Live execution trace</p></div></div><Badge variant="outline" className={cn("gap-1.5 border-border text-[10px] uppercase", turn.status === "streaming" && "border-amber/30 bg-amber/10 text-amber")}><span className={cn("size-1.5 rounded-full", turn.status === "streaming" ? "animate-pulse bg-amber" : "bg-muted-foreground")} />{turn.status}</Badge></div>
    <div className="space-y-1 p-3">{visible.length === 0 && <div className="flex items-center gap-3 rounded-md px-2 py-3 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin text-primary" />Initializing query execution…</div>}
      {visible.map((event, index) => <div key={index} className="flex items-start gap-3 rounded-md px-2 py-2.5 hover:bg-accent/40"><div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border border-border bg-background">{event.type === "tool_call" ? <ToolIcon tool={event.tool || event.name} /> : event.type === "source_found" ? <Link2 className="size-4 text-signal" /> : <LoaderCircle className={cn("size-4 text-primary", turn.status === "streaming" && "animate-spin")} />}</div><div className="min-w-0"><p className="text-xs font-medium">{event.message || event.content || (event.type === "source_found" ? `Found ${sourceTitle(event.source || {})}` : "Synthesizing evidence")}</p><p className="mt-1 text-[11px] uppercase text-muted-foreground">{event.tool?.replace("_", " ") || event.type.replace("_", " ")}</p></div></div>)}
    </div>
    {thinking.length > 0 && <Collapsible className="border-t border-border"><CollapsibleTrigger className="group flex w-full items-center justify-between px-4 py-3 text-xs text-muted-foreground hover:bg-accent/30 hover:text-foreground"><span className="flex items-center gap-2"><BrainCircuit className="size-3.5" />Reasoning process · {thinking.length} steps</span><ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" /></CollapsibleTrigger><CollapsibleContent className="space-y-2 px-4 pb-4">{thinking.map((event, index) => <div key={index} className="border-l border-primary/30 pl-3 text-xs leading-relaxed text-muted-foreground">{event.message || event.content}</div>)}</CollapsibleContent></Collapsible>}
    {found.length > 0 && <div className="flex gap-2 overflow-x-auto border-t border-border px-4 py-3">{found.map((source, index) => <Badge key={source.url || index} variant="secondary" className="shrink-0 gap-1.5"><Globe2 className="size-3" />{source.domain || sourceTitle(source)}</Badge>)}</div>}
  </div>;
}

function sourceKind(source: CitedSource) {
  const type = source.source_type?.toLowerCase() || "";
  if (type.includes("youtube")) return "YouTube";
  if (type.includes("document") || type.includes("file")) return "Document";
  if (type.includes("academic") || source.url?.includes("arxiv")) return "Academic Paper";
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

function ReportViewer({ report, onRegenerate }: { report: ResearchReport; onRegenerate: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(reportMarkdown(report));
    setCopied(true);
    toast.success("Copied full report as Markdown");
    setTimeout(() => setCopied(false), 2000);
  };

  const exportReport = () => {
    const blob = new Blob([reportMarkdown(report)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${report.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "research-report"}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Markdown report exported");
  };

  const hasExecutiveSummary = Boolean(report.executive_summary?.trim());
  const validFindings = (report.key_findings || []).filter(
    (f) => Boolean(f.finding?.trim() || f.detail?.trim() || f.title?.trim())
  );
  const validAnalysis = (report.analysis || []).filter(
    (a) => Boolean(a.content?.trim() || a.body?.trim())
  );
  const hasConclusion = Boolean(report.conclusion?.trim());
  const hasSources = Boolean(report.sources && report.sources.length > 0);

  // If there are no specialized sections, render cleanly and directly like Claude
  const isDirectAnswerOnly = !validFindings.length && !validAnalysis.length && !hasConclusion;

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
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock3 className="size-3" />
                {report.latency_ms.toLocaleString()} ms
              </span>
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

      {/* Cited Sources Shelf - Renders ONLY if sources exist */}
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
                  <Globe2 className="size-3.5" />
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

function TooltipButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) { return <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" onClick={onClick} aria-label={label}>{icon}</Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>; }

function Conversation({ turns, onRegenerate, onExample }: { turns: TimelineTurn[]; onRegenerate: (turn: TimelineTurn) => void; onExample: (text: string) => void }) {
  if (!turns.length) return <div className="flex min-h-full items-center justify-center px-5 pb-48 pt-16"><div className="max-w-2xl text-center"><div className="mx-auto mb-6 grid size-14 place-items-center rounded-lg border border-primary/25 bg-primary/10 shadow-glow"><Sparkles className="size-6 text-primary" /></div><p className="mb-2 font-mono text-[10px] uppercase text-primary">Research workspace ready</p><h2 className="font-display text-2xl font-semibold sm:text-3xl">What should we investigate?</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">Synthesize uploaded knowledge with live web intelligence into a structured, cited research dossier.</p><div className="mt-7 grid gap-2 text-left sm:grid-cols-3">{["Compare the latest agentic AI frameworks", "Summarize key themes across my sources", "Build a market landscape with citations"].map((text) => <button key={text} onClick={() => onExample(text)} className="rounded-md border border-border bg-surface p-3 text-xs leading-relaxed text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground">{text}</button>)}</div></div></div>;
  return <div className="mx-auto w-full max-w-4xl space-y-8 px-4 pb-52 pt-8 sm:px-6">{turns.map((turn) => <div className="space-y-4" key={turn.id}><div className="ml-auto max-w-2xl"><div className="rounded-lg rounded-tr-sm border border-primary/20 bg-primary/10 px-4 py-3"><p className="text-sm leading-relaxed">{turn.query}</p></div><p className="mt-1.5 text-right text-[10px] text-muted-foreground">{new Date(turn.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></div>{turn.report ? <ReportViewer report={turn.report} onRegenerate={() => onRegenerate(turn)} /> : <LiveProgress turn={turn} />}{turn.error && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{turn.error}</p>}</div>)}</div>;
}

function PromptDock({ mode, setMode, webSearch, setWebSearch, selectedCount, query, setQuery, youtubeUrl, setYoutubeUrl, streaming, onSubmit, onCancel }: {
  mode: ResearchMode; setMode: (mode: ResearchMode) => void; webSearch: boolean; setWebSearch: (value: boolean) => void; selectedCount: number;
  query: string; setQuery: (query: string) => void; youtubeUrl: string; setYoutubeUrl: (url: string) => void; streaming: boolean; onSubmit: () => void; onCancel: () => void;
}) {
  const [attachOpen, setAttachOpen] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (textarea.current) { textarea.current.style.height = "0px"; textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 160)}px`; } }, [query]);
  return <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:left-[var(--workspace-offset,0px)]"><div className="prompt-fade mx-auto max-w-5xl px-3 pb-4 pt-12 sm:px-6 sm:pb-6"><div className="pointer-events-auto overflow-hidden rounded-xl border border-border bg-dock/95 shadow-dock backdrop-blur-xl">
    {attachOpen && <div className="flex items-center gap-2 border-b border-border px-3 py-2"><Youtube className="size-4 shrink-0 text-youtube" /><Input value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="Attach a YouTube URL to this query" className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0" /><Button variant="ghost" size="icon" className="size-7" onClick={() => {setAttachOpen(false); setYoutubeUrl("");}} aria-label="Remove YouTube attachment"><X className="size-3.5" /></Button></div>}
    <div className="flex items-end gap-2 px-3 pt-3"><Textarea ref={textarea} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); } }} placeholder="Ask a complex research question…" className="max-h-40 min-h-11 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm shadow-none focus-visible:ring-0" /><Button size="icon" className={cn("mb-1 shrink-0", streaming && "bg-destructive text-destructive-foreground hover:bg-destructive/90")} disabled={!streaming && !query.trim()} onClick={streaming ? onCancel : onSubmit} aria-label={streaming ? "Stop research" : "Send research query"}>{streaming ? <CircleStop /> : <Send />}</Button></div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-3 py-2.5"><div className="flex flex-wrap items-center gap-2"><div className="flex rounded-md bg-background p-0.5">{(["quick", "standard", "deep"] as ResearchMode[]).map((item) => <button key={item} onClick={() => setMode(item)} className={cn("rounded-sm px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors", mode === item && "bg-secondary text-foreground shadow-sm")}>{modeLabel(item)}</button>)}</div><label className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground"><Globe2 className="size-3 text-cyan" /><span className="hidden sm:inline">Web</span><Switch checked={webSearch} onCheckedChange={setWebSearch} className="scale-75" /></label><Badge variant="outline" className="h-7 gap-1.5 border-border bg-background text-[11px] text-muted-foreground"><Database className="size-3" />{selectedCount} selected</Badge></div><Button variant="ghost" size="sm" className={cn("h-7 px-2 text-xs text-muted-foreground", attachOpen && "text-youtube")} onClick={() => setAttachOpen(!attachOpen)}><Youtube className="size-3.5" /><span className="hidden sm:inline">Attach video</span></Button></div>
  </div><p className="pointer-events-auto mt-2 text-center text-[10px] text-muted-foreground">Enter to send · Shift+Enter for a new line</p></div></div>;
}

export function ResearchWorkspace() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [activeSession, setActiveSession] = useState<string>();
  const [turns, setTurns] = useState<TimelineTurn[]>([]);
  const [query, setQuery] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [mode, setMode] = useState<ResearchMode>("standard");
  const [webSearch, setWebSearch] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "source" | "session"; item: SourceInfo | ChatSessionSummary }>();
  const abortRef = useRef<AbortController | undefined>(undefined);
  const streaming = turns.some((turn) => turn.status === "streaming");

  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setSidebarOpen(false);
  }, []);
  const loadSources = useCallback(async () => { try { const data = await researchApi.sources(); setSources(data); setSelectedSources((current) => current.length ? current.filter((id) => data.some((item) => sourceId(item) === id)) : data.map(sourceId).filter(Boolean)); } catch { setSources([]); } }, []);
  const loadSessions = useCallback(async () => { try { setSessions(await researchApi.sessions()); } catch { setSessions([]); } }, []);
  useEffect(() => { void researchApi.health().then(setHealth).catch(() => setHealth(null)); void loadSources(); void loadSessions(); }, [loadSources, loadSessions]);

  const createSession = async () => { try { const session = await researchApi.createSession(); const id = sessionId(session); setActiveSession(id || undefined); setTurns([]); await loadSessions(); toast.success("New research session created"); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create session"); } };
  const selectSession = async (id: string) => {
    try { const detail = await researchApi.session(id); setActiveSession(id); const history = detail.turns || detail.messages || []; setTurns(history.reduce<TimelineTurn[]>((acc, item, index) => { if (item.role === "user") acc.push({ id: item.id || `${id}-${index}`, query: item.query || item.content || "Research query", createdAt: item.created_at || item.timestamp || new Date().toISOString(), status: "complete", events: [] }); else { const last = acc.at(-1); if (last && item.report) last.report = item.report; else if (last && item.content) last.events.push({ type: "analysis", content: item.content }); } return acc; }, [])); setSidebarOpen(false); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load session"); } };

  const submit = useCallback(async (override?: string) => {
    const text = (override || query).trim(); if (!text || streaming) return;
    let currentSession = activeSession;
    if (!currentSession) { try { const created = await researchApi.createSession(text.slice(0, 64)); currentSession = sessionId(created) || undefined; setActiveSession(currentSession); await loadSessions(); } catch { /* Backends may create a session during research. */ } }
    const id = crypto.randomUUID(); const turn: TimelineTurn = { id, query: text, createdAt: new Date().toISOString(), status: "streaming", events: [] };
    setTurns((current) => [...current, turn]); setQuery("");
    const controller = new AbortController(); abortRef.current = controller;
    const payload: ResearchPayload = { query: text, session_id: currentSession, source_ids: selectedSources, options: { mode, web_search: webSearch }, youtube_url: youtubeUrl.trim() || undefined };
    try {
      await streamResearch(payload, (event: ResearchStreamEvent) => setTurns((current) => current.map((item) => item.id === id ? { ...item, events: [...item.events, event], report: event.report || (event.type === "report" ? event.data as ResearchReport : undefined) || item.report, status: event.type === "done" ? "complete" : item.status } : item)), controller.signal);
      setTurns((current) => current.map((item) => item.id === id ? { ...item, status: item.report ? "complete" : "complete" } : item)); setYoutubeUrl(""); void loadSessions();
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "AbortError";
      setTurns((current) => current.map((item) => item.id === id ? { ...item, status: cancelled ? "cancelled" : "error", error: cancelled ? undefined : error instanceof Error ? error.message : "Research failed" } : item));
      if (!cancelled) toast.error(error instanceof Error ? error.message : "Research failed");
    } finally { abortRef.current = undefined; }
  }, [activeSession, loadSessions, mode, query, selectedSources, streaming, webSearch, youtubeUrl]);

  const confirmDelete = async () => { if (!deleteTarget) return; try { if (deleteTarget.kind === "source") { const id = sourceId(deleteTarget.item as SourceInfo); await researchApi.removeSource(id); await loadSources(); toast.success("Source removed"); } else { const id = sessionId(deleteTarget.item as ChatSessionSummary); await researchApi.removeSession(id); if (activeSession === id) {setActiveSession(undefined); setTurns([]);} await loadSessions(); toast.success("Session deleted"); } } catch (error) { toast.error(error instanceof Error ? error.message : "Delete failed"); } finally { setDeleteTarget(undefined); } };

  return <TooltipProvider delayDuration={300}><div className="flex h-svh overflow-hidden bg-background text-foreground" style={{ "--workspace-offset": sidebarOpen ? "310px" : "0px" } as React.CSSProperties}>
    {sidebarOpen && <button className="fixed inset-0 z-40 bg-overlay md:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation overlay" />}
    <WorkspaceSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} sources={sources} selected={selectedSources} sessions={sessions} {...(activeSession ? { activeSession } : {})} onToggleSource={(id) => setSelectedSources((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onRefreshSources={() => void loadSources()} onRemoveSource={(item) => setDeleteTarget({ kind: "source", item })} onCreateSession={() => void createSession()} onSelectSession={(id) => void selectSession(id)} onRemoveSession={(item) => setDeleteTarget({ kind: "session", item })} />
    <div className="relative flex min-w-0 flex-1 flex-col"><AppHeader health={health} sourceCount={sources.length} {...(activeSession ? { activeSession } : {})} onMenu={() => setSidebarOpen(true)} /><Button variant="outline" size="icon" className={cn("absolute left-3 top-20 z-20 hidden bg-background md:flex", sidebarOpen && "hidden")} onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><PanelLeftOpen /></Button><main className="min-h-0 flex-1 overflow-y-auto"><Conversation turns={turns} onRegenerate={(turn) => void submit(turn.query)} onExample={setQuery} /></main><PromptDock mode={mode} setMode={setMode} webSearch={webSearch} setWebSearch={setWebSearch} selectedCount={selectedSources.length} query={query} setQuery={setQuery} youtubeUrl={youtubeUrl} setYoutubeUrl={setYoutubeUrl} streaming={streaming} onSubmit={() => void submit()} onCancel={() => abortRef.current?.abort()} /></div>
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(undefined)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {deleteTarget?.kind}?</AlertDialogTitle><AlertDialogDescription>This permanently removes the {deleteTarget?.kind} and cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void confirmDelete()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div></TooltipProvider>;
}
