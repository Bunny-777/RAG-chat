import type {
  ChatSessionDetail,
  ChatSessionSummary,
  HealthInfo,
  ResearchPayload,
  ResearchStreamEvent,
  SourceInfo,
} from "./types";

const API_URL = (import.meta.env["VITE_API_URL"] || "http://localhost:8000").replace(/\/$/, "");

type Envelope<T> = T | { data?: T; items?: T; sources?: T; sessions?: T };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError("Research service is unavailable. Check that the API is running.");
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const error = (await response.json()) as { detail?: string; message?: string };
      message = error.detail || error.message || message;
    } catch {
      // Keep the status-based fallback for non-JSON failures.
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function unwrapList<T>(value: Envelope<T[]>): T[] {
  if (Array.isArray(value)) return value;
  const nested = value.data ?? value.items ?? value.sources ?? value.sessions;
  return Array.isArray(nested) ? nested : [];
}

export const researchApi = {
  baseUrl: API_URL,
  health: () => request<HealthInfo>("/health"),
  sources: async () => unwrapList(await request<Envelope<SourceInfo[]>>("/sources")),
  source: (id: string) => request<SourceInfo>(`/sources/${encodeURIComponent(id)}`),
  removeSource: (id: string) => request<void>(`/sources/${encodeURIComponent(id)}`, { method: "DELETE" }),
  sessions: async () =>
    unwrapList(await request<Envelope<ChatSessionSummary[]>>("/sessions")),
  session: (id: string) => request<ChatSessionDetail>(`/sessions/${encodeURIComponent(id)}`),
  createSession: (title?: string) =>
    request<ChatSessionSummary>("/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(title ? { title } : {}),
    }),
  removeSession: (id: string) => request<void>(`/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }),
  uploadYouTube: (payload: {
    url: string;
    manual_transcript?: string;
    chunk_size: number;
    chunk_overlap: number;
    k: number;
  }) =>
    request<SourceInfo>("/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  uploadFile: (file: File, options: { chunk_size: number; chunk_overlap: number; k: number }) => {
    const form = new FormData();
    form.append("file", file);
    form.append("chunk_size", String(options.chunk_size));
    form.append("chunk_overlap", String(options.chunk_overlap));
    form.append("k", String(options.k));
    return request<SourceInfo>("/upload/file", { method: "POST", body: form });
  },
};

function parseEvent(raw: string, eventName?: string): ResearchStreamEvent | null {
  const payload = raw.trim();
  if (!payload || payload === "[DONE]") return payload === "[DONE]" ? { type: "done" } : null;
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    const type = String(parsed["type"] || parsed["event"] || eventName || "status") as ResearchStreamEvent["type"];
    return { ...parsed, type } as ResearchStreamEvent;
  } catch {
    return { type: (eventName || "status") as ResearchStreamEvent["type"], message: payload };
  }
}

export async function streamResearch(
  payload: ResearchPayload,
  onEvent: (event: ResearchStreamEvent) => void,
  signal?: AbortSignal,
) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/research/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(payload),
      signal: signal ?? null,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Unable to connect to the live research stream.");
  }
  if (!response.ok || !response.body) {
    throw new ApiError(`Research stream failed (${response.status})`, response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || "";
    for (const block of blocks) {
      let eventName: string | undefined;
      const data: string[] = [];
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      const event = parseEvent(data.join("\n"), eventName);
      if (event) onEvent(event);
    }
    if (done) break;
  }
  if (buffer.trim()) {
    const event = parseEvent(buffer.replace(/^data:\s?/gm, ""));
    if (event) onEvent(event);
  }
}
