import { useState, useEffect, useCallback, useRef } from "react";
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
  SSEEvent,
  ToastMessage,
  ChatSessionSummary,
  ChatTurn,
} from "./types";
import {
  fetchHealth,
  fetchSources,
  uploadSource,
  uploadDocumentFile,
  deleteSource,
  executeResearchStream,
  fetchSessions,
  fetchSession,
  deleteSession,
} from "./lib/api";
import { Sparkles, Video, Layers, ShieldCheck, User } from "lucide-react";

export function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [researchMode, setResearchMode] = useState<ResearchMode>("standard");
  const [webSearch, setWebSearch] = useState(false);

  // Chat sessions & conversation memory
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeTurns, setActiveTurns] = useState<ChatTurn[]>([]);

  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [streamEvents, setStreamEvents] = useState<SSEEvent[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeTurns, isResearching]);

  // Load initial backend health, sources, and past sessions
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

    try {
      const sessList = await fetchSessions();
      setSessions(sessList);
    } catch (err) {
      console.warn("Could not fetch sessions:", err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Start a fresh, isolated chat session
  const handleNewChat = () => {
    setCurrentSessionId(null);
    setActiveTurns([]);
    setStreamEvents([]);
    addToast("info", "Started new conversation.");
  };

  // Switch to an existing session
  const handleSelectSession = async (sessionId: string) => {
    try {
      const detail = await fetchSession(sessionId);
      setCurrentSessionId(detail.session_id);
      setActiveTurns(detail.turns);
      setStreamEvents([]);
    } catch (err) {
      addToast("error", (err as Error).message || "Failed to load session history.");
    }
  };

  // Delete a chat session
  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      if (currentSessionId === sessionId) {
        handleNewChat();
      }
      addToast("info", "Conversation deleted.");
    } catch (err) {
      addToast("error", (err as Error).message || "Failed to delete session.");
    }
  };

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

  // Handle uploading document source
  const handleUploadDocument = async (
    file: File,
    options?: {
      chunk_size?: number;
      chunk_overlap?: number;
      k?: number;
    }
  ) => {
    setIsUploadingDoc(true);
    try {
      const res = await uploadDocumentFile(file, options);
      addToast("success", res.message || `Document '${file.name}' indexed successfully!`);
      setSources((prev) => {
        const filtered = prev.filter((s) => s.source_id !== res.source.source_id);
        return [...filtered, res.source];
      });
      setSelectedSourceIds((prev) =>
        prev.includes(res.source.source_id) ? prev : [...prev, res.source.source_id]
      );
    } catch (err: unknown) {
      addToast("error", (err as Error).message || "Failed to index document.");
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Handle removing a source
  const handleDeleteSource = async (sourceId: string) => {
    try {
      await deleteSource(sourceId);
      addToast("info", "Source removed.");
      setSources((prev) => prev.filter((s) => s.source_id !== sourceId));
      setSelectedSourceIds((prev) => prev.filter((id) => id !== sourceId));
    } catch (err: unknown) {
      addToast("error", (err as Error).message || "Failed to delete source.");
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

  // Research Query Trigger (Multi-turn with session memory)
  const handleSearch = async (query: string, inlineYoutubeUrl?: string) => {
    if (!query.trim()) return;

    // Immediately display user turn in thread
    const userTurn: ChatTurn = {
      turn_id: `turn_${Date.now()}`,
      role: "user",
      query,
      content: query,
      timestamp: Date.now(),
    };
    setActiveTurns((prev) => [...prev, userTurn]);

    setIsResearching(true);
    setStreamEvents([]);

    try {
      await executeResearchStream(
        {
          query,
          session_id: currentSessionId || undefined,
          source_ids: selectedSourceIds,
          youtube_url: inlineYoutubeUrl,
          options: {
            mode: researchMode,
            web_search: webSearch,
          },
        },
        (event) => {
          setStreamEvents((prev) => [...prev, event]);
          if (event.session_id && !currentSessionId) {
            setCurrentSessionId(event.session_id);
          }
        },
        (error) => {
          addToast("error", error.message || "Research stream encountered an error.");
        },
        (finalReport) => {
          setIsResearching(false);
          if (finalReport) {
            const assistantTurn: ChatTurn = {
              turn_id: `turn_${Date.now() + 1}`,
              role: "assistant",
              query,
              content: finalReport.executive_summary,
              report: finalReport,
              mode: finalReport.mode,
              timestamp: Date.now(),
            };
            setActiveTurns((prev) => [...prev, assistantTurn]);
            if (finalReport.session_id) {
              setCurrentSessionId(finalReport.session_id);
            }
            addToast("success", "Research report completed!");
          }
          // Refresh sessions & sources list
          fetchSessions().then(setSessions).catch(() => {});
          fetchSources().then(setSources).catch(() => {});
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
          sessions={sessions}
          currentSessionId={currentSessionId}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onUpload={handleUpload}
          onUploadDocument={handleUploadDocument}
          onDeleteSource={handleDeleteSource}
          isUploading={isUploading}
          isUploadingDocument={isUploadingDoc}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col justify-between gap-6">
          {/* Conversation Thread */}
          {activeTurns.length > 0 ? (
            <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full flex-1">
              {activeTurns.map((turn) => {
                if (turn.role === "user") {
                  return (
                    <div key={turn.turn_id} className="flex items-start gap-3 justify-end animate-fade-in-up">
                      <div className="rounded-2xl px-4 py-3 bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/30 text-slate-100 text-sm max-w-xl shadow-lg leading-relaxed font-sans">
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] text-purple-300/80 uppercase font-mono font-semibold">
                          <User className="w-3 h-3 text-purple-400" />
                          <span>Question</span>
                        </div>
                        <p>{turn.content}</p>
                      </div>
                    </div>
                  );
                }
                if (turn.role === "assistant" && turn.report) {
                  return (
                    <div key={turn.turn_id} className="w-full animate-fade-in-up">
                      <ReportViewer report={turn.report} />
                    </div>
                  );
                }
                return null;
              })}
            </div>
          ) : !isResearching ? (
            /* Welcome Hero */
            <div className="flex flex-col items-center justify-center text-center max-w-2xl mx-auto py-12 px-4 gap-6 animate-fade-in-up my-auto">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600/30 to-indigo-600/30 border border-purple-500/30 flex items-center justify-center shadow-xl shadow-purple-950/40">
                <Sparkles className="w-8 h-8 text-purple-400" />
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Intelligent Multi-Source Research
                </h2>
                <p className="text-sm text-slate-400 max-w-lg leading-relaxed">
                  Ask questions across YouTube videos and uploaded documents. Follow-up
                  queries retain context within each separate chat session.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-4">
                <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-col items-center text-center gap-2">
                  <Video className="w-5 h-5 text-red-400" />
                  <div className="text-xs font-semibold text-slate-200">1. Add Sources</div>
                  <p className="text-[11px] text-slate-500">
                    YouTube links, PDF, DOCX, or text documents.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-col items-center text-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  <div className="text-xs font-semibold text-slate-200">2. Select Mode</div>
                  <p className="text-[11px] text-slate-500">
                    Choose Quick Flash, Standard Brief, or Deep Investigation.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 flex flex-col items-center text-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <div className="text-xs font-semibold text-slate-200">3. Chat with Memory</div>
                  <p className="text-[11px] text-slate-500">
                    Ask follow-up questions or click '+ New Chat' for a fresh session.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Live Progress Timeline */}
          {isResearching && (
            <div className="max-w-4xl mx-auto w-full">
              <LiveProgressFeed
                events={streamEvents}
                isResearching={isResearching}
              />
            </div>
          )}

          <div ref={messagesEndRef} />

          {/* Bottom Sticky Prompt Bar with Mode Selector & Analyze Button */}
          <div className="sticky bottom-0 pt-2 pb-2 bg-gradient-to-t from-[#07070c] via-[#07070c]/90 to-transparent">
            <ResearchPromptBar
              onSearch={handleSearch}
              isResearching={isResearching}
              selectedSourcesCount={selectedSourceIds.length}
              researchMode={researchMode}
              onChangeMode={setResearchMode}
            />
          </div>
        </main>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
