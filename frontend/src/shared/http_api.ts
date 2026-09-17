/**
 * HTTP client for the local Elowen FastAPI backend.
 */

const API_BASE = (process.env.ELOWEN_API_BASE as string | undefined) ?? "/api";

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      // ignore
    }
    throw new Error(
      typeof detail === "string" ? detail : JSON.stringify(detail)
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function imageUrl(storagePath: string): string {
  const encoded = storagePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${API_BASE}/images/${encoded}`;
}

export const httpApi = {
  getCollections: () => request<any[]>("/collections"),

  getLibrary: () => request<any[]>("/library"),

  putLibraryPaper: (paperId: string, data: unknown) =>
    request<any>(`/library/${encodeURIComponent(paperId)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteLibraryPaper: (paperId: string) =>
    request<{ status: string }>(`/library/${encodeURIComponent(paperId)}`, {
      method: "DELETE",
    }),

  clearLibrary: () =>
    request<{ status: string }>("/library", { method: "DELETE" }),

  getSettings: () =>
    request<{
      modelProvider?: string;
      providerSettings?: Record<string, unknown>;
      responseLanguage?: string;
    }>("/settings"),

  putSettings: (payload: {
    modelProvider?: string;
    providerSettings?: unknown;
    responseLanguage?: string;
  }) =>
    request<{
      modelProvider?: string;
      providerSettings?: Record<string, unknown>;
      responseLanguage?: string;
    }>("/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  getMetadataItem: (paperId: string) =>
    request<any>(`/papers/${encodeURIComponent(paperId)}/metadata-item`),

  getMetadata: (paperId: string) =>
    request<any>(`/papers/${encodeURIComponent(paperId)}/metadata`),

  getVersion: (paperId: string, version: string | number) =>
    request<any>(
      `/papers/${encodeURIComponent(paperId)}/versions/${encodeURIComponent(
        String(version)
      )}`
    ),

  getStatus: (paperId: string) =>
    request<any>(`/papers/${encodeURIComponent(paperId)}/status`),

  importPaper: (
    arxivId: string,
    options?: { modelConfig?: unknown; apiKey?: string }
  ) =>
    request<{ metadata?: any; error?: string }>("/import", {
      method: "POST",
      body: JSON.stringify({
        arxiv_id: arxivId,
        modelConfig: options?.modelConfig,
        apiKey: options?.apiKey,
      }),
    }),

  ask: (payload: {
    doc: unknown;
    request: unknown;
    modelConfig?: unknown;
    apiKey?: string;
    history?: unknown[];
    conversationSummary?: string;
  }) =>
    request<any>("/ask", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        apiKey: payload.apiKey ?? (payload.modelConfig as { apiKey?: string } | undefined)?.apiKey,
        history: payload.history ?? [],
        conversationSummary: payload.conversationSummary ?? undefined,
      }),
    }),

  personalSummary: (payload: {
    doc: unknown;
    past_papers: unknown[];
    modelConfig?: unknown;
    apiKey?: string;
  }) =>
    request<any>("/personal-summary", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        apiKey: payload.apiKey ?? (payload.modelConfig as { apiKey?: string } | undefined)?.apiKey,
      }),
    }),

  feedback: (payload: {
    user_feedback_text: string;
    arxiv_id?: string;
  }) =>
    request<{ status: string }>("/feedback", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

/** Poll a document version until terminal status or abort. */
export function pollVersionDoc(
  paperId: string,
  version: string | number,
  onUpdate: (doc: any) => void,
  options?: { intervalMs?: number; signal?: AbortSignal }
): () => void {
  const intervalMs = options?.intervalMs ?? 1500;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stopStatuses = new Set([
    "SUCCESS",
    "ERROR_DOCUMENT_LOAD",
    "ERROR_DOCUMENT_LOAD_INVALID_RESPONSE",
    "ERROR_DOCUMENT_LOAD_QUOTA_EXCEEDED",
    "ERROR_SUMMARIZING",
    "ERROR_SUMMARIZING_INVALID_RESPONSE",
    "ERROR_SUMMARIZING_QUOTA_EXCEEDED",
    "TIMEOUT",
  ]);

  const tick = async () => {
    if (stopped || options?.signal?.aborted) return;
    try {
      const doc = await httpApi.getVersion(paperId, version);
      if (stopped) return;
      onUpdate(doc);
      const status = doc?.loadingStatus as string | undefined;
      if (status && stopStatuses.has(status)) {
        stopped = true;
        return;
      }
    } catch (e) {
      console.warn("pollVersionDoc error", e);
    }
    if (!stopped && !options?.signal?.aborted) {
      timer = setTimeout(tick, intervalMs);
    }
  };

  tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
