// Client for the PlantOps AI Assistant (/api/assistant)
const BASE = 'http://localhost:4000/api/assistant';

export type ActionType = 'CREATE_WORK_ORDER' | 'RESERVE_PART' | 'CREATE_PURCHASE_ORDER';
export type ActionStatus = 'PENDING' | 'EXECUTED' | 'REJECTED' | 'FAILED';

export interface CitedSource {
  label: string;
  title: string;
  section?: string;
  sourceType: string;
  ref: string;
  machine?: string;
  excerpt: string;
  score: number;
}

export interface ProposedAction {
  id: string;
  sessionId: string;
  type: ActionType;
  params: Record<string, any>;
  summary: string;
  rationale: string;
  status: ActionStatus;
  result?: any;
  requestedBy: string;
  decidedBy?: string;
  decisionNote?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface Verification {
  status: 'verified' | 'revised' | 'unverified' | 'skipped';
  issues: string[];
}

export interface TraceStep {
  id?: string;
  name: string;
  args: any;
  ok?: boolean;
  summary?: string;
  durationMs?: number;
  kind?: 'read' | 'propose';
  running?: boolean;
}

export interface AssistantMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  meta?: {
    sources?: CitedSource[];
    actions?: string[];
    trace?: TraceStep[];
    verification?: Verification;
    model?: string;
    steps?: number;
  };
  feedback?: 'up' | 'down' | null;
  createdAt: string;
}

export interface AssistantSession {
  id: string;
  title: string;
  userName: string;
  userRole: string;
  createdAt: string;
  updatedAt: string;
}

export interface IndexStatus {
  chunks: number;
  documents: number;
  bySource: Record<string, number>;
  embedded: number;
  vectorBackend: 'tidb' | 'local';
  lastBuiltAt: string | null;
  building: boolean;
  warnings: string[];
}

// Roles allowed to approve each proposal type (enforced again on the server)
export const APPROVER_ROLES: Record<ActionType, string[]> = {
  CREATE_WORK_ORDER: ['PLANT_ADMIN', 'MANAGER', 'SUPERVISOR'],
  RESERVE_PART: ['PLANT_ADMIN', 'SUPERVISOR', 'INVENTORY_MGMT'],
  CREATE_PURCHASE_ORDER: ['PLANT_ADMIN', 'MANAGER', 'INVENTORY_MGMT'],
};

async function json<T>(res: Promise<Response>): Promise<T> {
  const r = await res;
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.success === false) throw new Error(body.error || `Request failed (${r.status})`);
  return body.data as T;
}

const post = (path: string, data: any) =>
  fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

export const assistantApi = {
  listSessions: (user?: string) => json<AssistantSession[]>(fetch(`${BASE}/sessions${user ? `?user=${encodeURIComponent(user)}` : ''}`)),
  getMessages: (sessionId: string) => json<AssistantMessage[]>(fetch(`${BASE}/sessions/${sessionId}/messages`)),
  deleteSession: (sessionId: string) => json(fetch(`${BASE}/sessions/${sessionId}`, { method: 'DELETE' })),
  feedback: (messageId: string, rating: 'up' | 'down', note?: string) => json(post(`/messages/${messageId}/feedback`, { rating, note })),
  listActions: (params: { status?: ActionStatus; sessionId?: string } = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    return json<ProposedAction[]>(fetch(`${BASE}/actions${q ? `?${q}` : ''}`));
  },
  decide: (id: string, decision: 'approve' | 'reject', decider: { name: string; role: string; roleKey: string }, note?: string) =>
    json<ProposedAction>(post(`/actions/${id}/decision`, { decision, decider, note })),
  knowledgeStatus: () => json<IndexStatus>(fetch(`${BASE}/knowledge/status`)),
  reindex: () => json<IndexStatus>(post('/knowledge/reindex', {})),
};

export type ChatEvent =
  | { type: 'session'; sessionId: string; title: string; userMessageId: string }
  | { type: 'status'; text: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'token'; delta: string }
  | { type: 'tool_call'; id: string; name: string; args: any; kind: 'read' | 'propose' }
  | { type: 'tool_result'; id: string; name: string; ok: boolean; summary: string; durationMs: number }
  | { type: 'sources'; sources: CitedSource[] }
  | { type: 'action'; action: ProposedAction }
  | { type: 'revision'; reason: string[] }
  | { type: 'clear_answer' }
  | { type: 'verification'; verification: Verification }
  | { type: 'done'; messageId: string; sessionId: string; answer: string; sources: CitedSource[]; actions: ProposedAction[]; verification: Verification; model: string; steps: number }
  | { type: 'error'; message: string };

/** POST a chat turn and consume the Server-Sent Events stream. */
export async function streamChat(
  body: { sessionId?: string | null; message: string; user: { name: string; role: string } },
  onEvent: (e: ChatEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Assistant request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      try {
        onEvent({ ...(JSON.parse(data) as any), type: event });
      } catch {
        // ignore malformed frames
      }
    }
  }
}
