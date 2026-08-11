const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";
const KEY_STORAGE = "evalhub.apiKey";

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : `API request failed (${status})`);
    this.status = status;
    this.detail = detail;
  }
}

export function getApiKey(): string {
  return localStorage.getItem(KEY_STORAGE) || "zihao-local-dev-key";
}

export function setApiKey(value: string): void {
  localStorage.setItem(KEY_STORAGE, value);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-API-Key", getApiKey());
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

export async function downloadExport(runId: string, format: "jsonl" | "csv"): Promise<void> {
  const response = await fetch(`${API_BASE}/runs/${runId}/export?format=${format}`, {
    headers: { "X-API-Key": getApiKey() },
  });
  if (!response.ok) throw new ApiError(response.status, await response.text());
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `run-${runId}.${format}`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function streamRunEvents(
  runId: string,
  onEvent: () => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE}/runs/${runId}/events`, {
    headers: { "X-API-Key": getApiKey() },
    signal,
  });
  if (!response.ok || !response.body) {
    throw new ApiError(response.status, await response.text());
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const event of events) {
      if (event.includes("data:")) onEvent();
    }
  }
}
