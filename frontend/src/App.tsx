import { useState, useEffect, useCallback } from "react";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { ResearchPromptBar } from "./components/ResearchPromptBar";
import { LiveProgressFeed } from "./components/LiveProgressFeed";
import { ReportViewer } from "./components/ReportViewer";
import { ToastContainer } from "./components/Toast";
import type {
  HealthStatus,
  SourceInfo,
  ResearchMode,
  ResearchReport,
  SSEEvent,
  ToastMessage,
} from "./types";
import {
  fetchHealth,
  fetchSources,
  uploadSource,
  executeResearchStream,
} from "./lib/api";
import { Sparkles, Video, Layers, ShieldCheck } from "lucide-react";

export function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [researchMode, setResearchMode] = useState<ResearchMode>("standard");
  const [webSearch, setWebSearch] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [streamEvents, setStreamEvents] = useState<SSEEvent[]>([]);
  const [currentReport, setCurrentReport] = useState<ResearchReport | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: "error" | "success" | "info", message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Load initial backend health and sources
  const loadInitialData = useCallback(async () => {
    try {
      setHealthLoading(true);
      const h = await fetchHealth();
      setHealth(h);
    } catch {
      addToast("error", "Could not connect to FastAPI backend at http://localhost:8000. Ensure the server is running.");
    } finally {
      setHealthLoading(false);
    }

    try {
      const srcList = await fetchSources();
      setSources(srcList);
      if (srcList.length > 0) {
        setSelectedSourceIds(srcList.map((s) => s.source_id));
      }
    } catch (err) {
      console.warn("Could not fetch sources:", err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle uploading YouTube source
  const handleUpload = async (payload: {
    url: string;
    manual_transcript?: string;
    chunk_size: number;
    chunk_overlap: number;
    k: number;
  }) => {
    setIsUploading(true);
    try {
      const res = await uploadSource(payload);
      addToast("success", res.message || "Source successfully indexed!");
      setSources((prev) => {
        const filtered = prev.filter((s) => s.source_id !== res.source.source_id);
        return [...filtered, res.source];
      });
      setSelectedSourceIds((prev) =>
        prev.includes(res.source.source_id) ? prev : [...prev, res.source.source_id]
      );
    } catch (err: unknown) {
      addToast("error", (err as Error).message || "Failed to index source.");
    } finally {
      setIsUploading(false);
    }
  };

  // Source selection helpers
  const handleToggleSource = (id: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSelectAllSources = () => {
    setSelectedSourceIds(sources.map((s) => s.source_id));
  };

  const handleClearSourcesSelection = () => {
    setSelectedSourceIds([]);
  };

  // Research Query Trigger
  const handleSearch = async (query: string, inlineYoutubeUrl?: string) => {
    if (!query.trim()) return;

    setIsResearching(true);
    setStreamEvents([]);
    setCurrentReport(null);

    try {
      await executeResearchStream(
        {
          query,
          source_ids: selectedSourceIds,
          youtube_url: inlineYoutubeUrl,
          options: {
            mode: researchMode,
            web_search: webSearch,
          },
        },
        (event) => {
          setStreamEvents((prev) => [...prev, event]);
          if (event.type === "report" && event.data) {
            setCurrentReport(event.data);
          }
        },
        (error) => {
          addToast("error", error.message || "Research stream encountered an error.");
        },
        (finalReport) => {
          setIsResearching(false);
          if (finalReport) {
            setCurrentReport(finalReport);
            addToast("success", "Research report completed!");
          }
          // Refresh sources in case an inline YouTube URL was added
          fetchSources().then((res) => setSources(res)).catch(() => {});
        }
      );
    } catch (err: unknown) {
      setIsResearching(false);
      addToast("error", (err as Error).message || "Failed to execute research query.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#07070c] text-slate-100 font-sans selection:bg-purple-500 selection:text-white">
      <Header health={health} loading={healthLoading} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          sources={sources}
          selectedSourceIds={selectedSourceIds}
          onToggleSource={handleToggleSource}
          onSelectAllSources={handleSelectAllSources}
          onClearSourcesSelection={handleClearSourcesSelection}
          researchMode={researchMode}
          onSelectMode={setResearchMode}
          webSearch={webSearch}
          onToggleWebSearch={() => setWebSearch(!webSearch)}
          onUpload={handleUpload}
          isUploading={isUploading}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col gap-8">
          {/* Top Research Input */}
          <ResearchPromptBar
            onSearch={handleSearch}
            isResearching={isResearching}
            selectedSourcesCount={selectedSourceIds.length}
            researchMode={researchMode}
          />

          {/* Live Progress Timeline */}
          {isResearching && (
            <LiveProgressFeed
              events={streamEvents}
              isResearching={isResearching}
            />
          )}

          {/* Report Viewer */}
          {currentReport ? (
            <ReportViewer report={currentReport} />
          ) : !isResearching ? (
            /* Empty State / Welcome Hero */
            <div className="flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-12 px-4 gap-6 animate-fade-in-up">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600/30 to-indigo-600/30 border border-purple-500/30 flex items-center justify-center shadow-xl shadow-purple-950/40">
                <Sparkles className="w-8 h-8 text-purple-400" />
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Intelligent Multi-Source Research
                </h2>
                <p className="text-sm text-slate-400 max-w-lg leading-relaxed">
                  Extract deep insights from YouTube videos, compare evidence across
                  transcripts, and generate grounded research reports with citations.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-4">
                <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-col items-center text-center gap-2">
                  <Video className="w-5 h-5 text-red-400" />
                  <div className="text-xs font-semibold text-slate-200">1. Add Source</div>
                  <p className="text-[11px] text-slate-500">
                    Paste any YouTube URL in the sidebar to index its transcript.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-col items-center text-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  <div className="text-xs font-semibold text-slate-200">2. Ask Question</div>
                  <p className="text-[11px] text-slate-500">
                    Inquire about specific arguments, comparisons, or summaries.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-col items-center text-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <div className="text-xs font-semibold text-slate-200">3. Verified Report</div>
                  <p className="text-[11px] text-slate-500">
                    Get a structured report with key findings and citation links.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
