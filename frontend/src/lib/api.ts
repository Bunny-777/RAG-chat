import type {
  HealthStatus,
  SourceInfo,
  UploadPayload,
  UploadResponse,
  ResearchPayload,
  ResearchReport,
  SSEEvent,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function fetchSources(): Promise<SourceInfo[]> {
  const res = await fetch(`${API_BASE_URL}/sources`);
  if (!res.ok) throw new Error(`Failed to fetch sources: ${res.statusText}`);
  return res.json();
}

export async function fetchSource(sourceId: string): Promise<SourceInfo> {
  const res = await fetch(`${API_BASE_URL}/sources/${sourceId}`);
  if (!res.ok) throw new Error(`Failed to fetch source: ${res.statusText}`);
  return res.json();
}

export async function uploadSource(payload: UploadPayload): Promise<UploadResponse> {
  const res = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || `Upload failed: ${res.statusText}`);
  }
  return res.json();
}

export async function executeResearch(payload: ResearchPayload): Promise<ResearchReport> {
  const res = await fetch(`${API_BASE_URL}/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || errorData.message || `Research failed: ${res.statusText}`);
  }
  return res.json();
}

export async function executeResearchStream(
  payload: ResearchPayload,
  onEvent: (event: SSEEvent) => void,
  onError: (error: Error) => void,
  onDone: (report?: ResearchReport) => void
): Promise<() => void> {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/research/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `Streaming failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Response body is not readable");

      const decoder = new TextDecoder();
      let buffer = "";
      let finalReport: ResearchReport | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            const jsonStr = trimmed.replace(/^data:\s*/, "");
            if (!jsonStr) continue;
            try {
              const event: SSEEvent = JSON.parse(jsonStr);
              onEvent(event);
              if (event.type === "report" && event.data) {
                finalReport = event.data as ResearchReport;
              }
              if (event.type === "error" && event.message) {
                onError(new Error(event.message));
              }
            } catch (err) {
              console.warn("Error parsing SSE JSON chunk:", err, jsonStr);
            }
          }
        }
      }

      onDone(finalReport);
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        onError(err as Error);
      }
    }
  })();

  return () => controller.abort();
}

export async function fetchResearchReport(researchId: string): Promise<ResearchReport> {
  const res = await fetch(`${API_BASE_URL}/research/${researchId}`);
  if (!res.ok) throw new Error(`Failed to fetch report: ${res.statusText}`);
  return res.json();
}

export async function deleteResearchReport(researchId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/research/${researchId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete report: ${res.statusText}`);
}
