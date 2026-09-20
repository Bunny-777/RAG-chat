export type ResearchMode = "quick" | "standard" | "deep";

export interface ResearchOptions {
  mode: ResearchMode;
  web_search: boolean;
}

export interface ResearchPayload {
  query: string;
  session_id?: string | undefined;
  source_ids: string[];
  options: ResearchOptions;
  youtube_url?: string | undefined;
}

export interface CitedSource {
  source_id?: string;
  title?: string;
  url?: string;
  source_type?: string;
  domain?: string;
  metadata?: Record<string, unknown>;
}

export interface ResearchReport {
  research_id: string;
  session_id?: string;
  query: string;
  title: string;
  executive_summary: string;
  key_findings: Array<{ title?: string; finding?: string; detail?: string }>;
  analysis: Array<{ heading?: string; title?: string; content?: string }>;
  conclusion: string;
  sources: CitedSource[];
  mode: ResearchMode | string;
  latency_ms: number;
}

export interface HealthInfo {
  status: string;
  app_name?: string;
  llm_model?: string;
  embedding_model?: string;
}

export interface SourceInfo extends CitedSource {
  id?: string;
  name?: string;
  chunk_count?: number;
  chunks?: number;
  created_at?: string;
}

export interface ChatTurn {
  id?: string;
  role: "user" | "assistant";
  content?: string;
  query?: string;
  created_at?: string;
  timestamp?: string;
  report?: ResearchReport;
}

export interface ChatSessionSummary {
  session_id?: string;
  id?: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
  message_count?: number;
  turn_count?: number;
}

export interface ChatSessionDetail extends ChatSessionSummary {
  turns?: ChatTurn[];
  messages?: ChatTurn[];
}

export type StreamEventType =
  | "status"
  | "tool_call"
  | "thinking"
  | "source_found"
  | "analysis"
  | "report"
  | "done"
  | "error";

export interface ResearchStreamEvent {
  type: StreamEventType;
  message?: string;
  content?: string;
  tool?: string;
  name?: string;
  query?: string;
  source?: CitedSource;
  report?: ResearchReport;
  data?: unknown;
}

export interface TimelineTurn {
  id: string;
  query: string;
  createdAt: string;
  status: "streaming" | "complete" | "error" | "cancelled";
  events: ResearchStreamEvent[];
  report?: ResearchReport | undefined;
  error?: string | undefined;
}
