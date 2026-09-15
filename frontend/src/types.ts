export interface HealthStatus {
  status: string;
  app_name: string;
  llm_model: string;
  embedding_model: string;
}

export interface SourceMetadata {
  [key: string]: unknown;
}

export interface SourceInfo {
  source_id: string;
  source_type: string;
  url: string;
  title: string;
  language?: string;
  chunk_count: number;
  metadata?: SourceMetadata;
}

export interface SourceListItem {
  source_id: string;
  title: string;
  url: string;
  chunk_count: number;
}

export interface UploadPayload {
  url: string;
  manual_transcript?: string;
  chunk_size: number;
  chunk_overlap: number;
  k: number;
}

export interface UploadResponse {
  message: string;
  source: SourceInfo;
}

export type ResearchMode = "quick" | "standard" | "deep";

export interface ResearchOptions {
  mode: ResearchMode;
  web_search: boolean;
}

export interface ResearchPayload {
  query: string;
  source_ids: string[];
  options: ResearchOptions;
  youtube_url?: string;
}

export interface KeyFinding {
  title?: string;
  finding?: string;
  detail?: string;
  [key: string]: unknown;
}

export interface AnalysisSection {
  heading?: string;
  title?: string;
  content?: string;
  body?: string;
  [key: string]: unknown;
}

export interface CitedSource {
  source_id?: string;
  title?: string;
  url?: string;
  [key: string]: unknown;
}

export interface ResearchReport {
  research_id: string;
  query: string;
  title: string;
  executive_summary: string;
  key_findings: KeyFinding[];
  analysis: AnalysisSection[];
  conclusion: string;
  sources: CitedSource[];
  mode: ResearchMode | string;
  latency_ms: number;
}

export type SSEEventType =
  | "status"
  | "tool_call"
  | "source_found"
  | "analysis"
  | "report"
  | "done"
  | "error";

export interface SSEEvent {
  type: SSEEventType;
  message?: string;
  tool?: string;
  source_id?: string;
  url?: string;
  data?: ResearchReport;
  research_id?: string;
  [key: string]: unknown;
}

export interface ToastMessage {
  id: string;
  type: "error" | "success" | "info";
  message: string;
}
