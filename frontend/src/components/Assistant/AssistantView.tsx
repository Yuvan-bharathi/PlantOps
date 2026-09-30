import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles, Send, Square, Plus, Trash2, MessageSquare, BookOpen, ClipboardCheck, Search, Cpu, Activity, Truck,
  AlertTriangle, Wrench, HardHat, Package, ShoppingCart, BarChart3, Zap, CalendarClock, Lock, CheckCircle2,
  XCircle, Loader2, ShieldCheck, RefreshCw, ChevronDown, ChevronRight, ThumbsUp, ThumbsDown,
  Brain, History,
} from 'lucide-react';
import {
  assistantApi, streamChat, APPROVER_ROLES, AssistantSession, CitedSource, ProposedAction, TraceStep, Verification,
} from '../../services/assistantApi';
import { socket } from '../../services/api';
import type { UserProfile } from '../Operations/LoginPage';
import type { ToastMessage } from '../ToastNotification';

interface Props {
  currentUser: UserProfile;
  onAddToast?: (t: Omit<ToastMessage, 'id' | 'timestamp'> & { timestamp?: string }) => void;
}

interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: CitedSource[];
  trace: TraceStep[];
  actionIds: string[];
  verification?: Verification;
  revisionReasons?: string[];
  reasoning?: string;
  status?: string;
  streaming?: boolean;
  error?: string;
  model?: string;
  feedback?: 'up' | 'down' | null;
}

const TOOL_META: Record<string, { label: string; icon: React.ElementType }> = {
  search_knowledge_base: { label: 'Searched SOPs & incident history', icon: Search },
  list_machines: { label: 'Listed machines', icon: Cpu },
  get_machine_details: { label: 'Checked machine', icon: Cpu },
  get_telemetry_history: { label: 'Queried TimescaleDB telemetry', icon: Activity },
  search_incidents: { label: 'Searched incidents', icon: AlertTriangle },
  get_incident_details: { label: 'Opened incident', icon: AlertTriangle },
  list_work_orders: { label: 'Checked work orders', icon: Wrench },
  find_technicians: { label: 'Looked up technicians', icon: HardHat },
  recommend_technician: { label: 'Ranked technicians', icon: HardHat },
  check_spare_part: { label: 'Checked spare-part stock', icon: Package },
  list_purchase_orders: { label: 'Checked purchase orders', icon: ShoppingCart },
  get_production_summary: { label: 'Pulled production summary', icon: BarChart3 },
  get_plant_power_state: { label: 'Checked plant power', icon: Zap },
  get_fleet_status: { label: 'Checked freight & fleet', icon: Truck },
  get_pm_schedule: { label: 'Checked PM schedule', icon: CalendarClock },
  get_loto_procedure: { label: 'Retrieved LOTO procedure', icon: Lock },
  propose_work_order: { label: 'Drafted work order', icon: ClipboardCheck },
  propose_part_reservation: { label: 'Drafted part reservation', icon: ClipboardCheck },
  propose_purchase_order: { label: 'Drafted purchase order', icon: ClipboardCheck },
};

const SOURCE_BADGE: Record<string, string> = {
  SOP: 'bg-blue-50 text-blue-700 border-blue-200',
  LOTO: 'bg-rose-50 text-rose-700 border-rose-200',
  INSPECTION: 'bg-violet-50 text-violet-700 border-violet-200',
  INCIDENT: 'bg-amber-50 text-amber-800 border-amber-200',
  WORK_ORDER: 'bg-amber-50 text-amber-800 border-amber-200',
  DOC: 'bg-slate-100 text-slate-700 border-slate-200',
  UPLOAD: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const SUGGESTIONS = [
  { icon: Cpu, text: 'What is the status of the machining cell right now? Anything abnormal?' },
  { icon: Wrench, text: 'How do I replace the spindle bearing on CNC-05? Include torque specs and whether the bearing is in stock.' },
  { icon: AlertTriangle, text: 'Which incidents caused the most downtime in the last 7 days, and what were the root causes?' },
  { icon: CalendarClock, text: 'What preventive maintenance is due or overdue in the next 7 days?' },
  { icon: BarChart3, text: "Summarise today's production against target." },
  { icon: History, text: 'Has CNC-06 had vibration problems before? What fixed them?' },
  { icon: Activity, text: 'Show the vibration trend for CNC-05 over the last 24 hours.' },
];


const argPreview = (args: any) => {
  if (!args || typeof args !== 'object') return '';
  const v = args.query || args.machine_code || args.incident_id || args.part || args.work_order_id || args.date || args.skill || args.status;
  return v ? String(v) : '';
};

const timeAgo = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// Turn [S1] markers into links the markdown renderer can style as citation chips
const withCitationLinks = (text: string) => text.replace(/\[(S\d+)\]/g, '[$1](#cite-$1)');

// ── Sub-components (module level so their local state survives streaming re-renders) ──

const ActionCard: React.FC<{
  a: ProposedAction;
  roleKey: string;
  roleLabel: string;
  onDecide: (a: ProposedAction, decision: 'approve' | 'reject') => Promise<void>;
}> = ({ a, roleKey, roleLabel, onDecide }) => {
  const allowed = APPROVER_ROLES[a.type]?.includes(roleKey);
  const [busy, setBusy] = useState(false);
  const statusStyle: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
    EXECUTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-slate-100 text-slate-600 border-slate-200',
    FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  const details = Object.entries(a.params).filter(([k, v]) => k !== 'machineId' && v !== undefined && v !== '');
  const run = async (d: 'approve' | 'reject') => {
    setBusy(true);
    try {
      await onDecide(a, d);
    } finally {
      setBusy(false);
    }
  };
  const woId = a.result?.workOrder?.workOrderId || a.result?.workOrder?.id;
  return (
    <div className="mt-2.5 rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50/70 to-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <ClipboardCheck size={14} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Proposed action · needs approval</div>
            <div className="text-[13px] font-bold text-[#1E293B] leading-snug">{a.summary}</div>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${statusStyle[a.status]}`}>{a.status}</span>
      </div>
      {a.rationale && <p className="mt-1.5 text-[12px] text-[#475569] leading-snug">{a.rationale}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {details.map(([k, v]) => (
          <span key={k} className="text-[10.5px] px-1.5 py-0.5 rounded-md bg-white border border-[#E7E3DA] text-[#475569]">
            <span className="text-[#94A3B8]">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span> <span className="font-semibold">{String(v)}</span>
          </span>
        ))}
      </div>
      {a.status === 'PENDING' ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            disabled={!allowed || busy}
            onClick={() => run('approve')}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Approve & execute
          </button>
          <button
            disabled={busy}
            onClick={() => run('reject')}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white hover:bg-slate-50 border border-[#DDD9D0] text-[#475569] text-xs font-bold disabled:opacity-40"
          >
            <XCircle size={13} /> Reject
          </button>
          {!allowed && <span className="text-[11px] text-[#94A3B8]">Your role ({roleLabel}) can't approve this.</span>}
        </div>
      ) : (
        <div className="mt-2 text-[11px] text-[#64748B]">
          {a.status === 'EXECUTED' && (
            <>
              ✓ Executed{a.decidedBy ? ` · approved by ${a.decidedBy}` : ''}
              {woId ? ` · ${woId}` : ''}
              {a.result?.incidentId ? ` · incident ${a.result.incidentId}` : ''}
            </>
          )}
          {a.status === 'REJECTED' && <>Rejected{a.decidedBy ? ` by ${a.decidedBy}` : ''}</>}
          {a.status === 'FAILED' && <span className="text-rose-600">Failed: {a.result?.error}</span>}
        </div>
      )}
    </div>
  );
};

const Steps: React.FC<{ m: UIMessage }> = ({ m }) => {
  const [open, setOpen] = useState(false);
  if (!m.trace.length && !m.reasoning) return null;
  const running = m.trace.some((t) => t.running);
  const verbs = [...new Set(m.trace.map((t) => (TOOL_META[t.name]?.label || 'Ran').split(' ')[0]))].slice(0, 3).join(', ');
  return (
    <div className="mb-2">
      <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B] hover:text-[#1E293B]">
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {running ? <Loader2 size={12} className="animate-spin text-blue-600" /> : <Brain size={12} className="text-blue-600" />}
        {m.trace.length ? `${m.trace.length} step${m.trace.length > 1 ? 's' : ''} · ${verbs}` : 'Reasoning'}
      </button>
      {open && (
        <div className="mt-1.5 ml-1 pl-3 border-l-2 border-[#E7E3DA] space-y-1">
          {m.trace.map((t, i) => {
            const meta = TOOL_META[t.name] || { label: t.name, icon: Cpu };
            return (
              <div key={t.id || i} className="flex items-center gap-2 text-[11.5px]">
                {t.running ? (
                  <Loader2 size={12} className="animate-spin text-blue-600 shrink-0" />
                ) : t.ok === false ? (
                  <XCircle size={12} className="text-rose-500 shrink-0" />
                ) : (
                  <meta.icon size={12} className="text-[#64748B] shrink-0" />
                )}
                <span className="font-semibold text-[#334155] whitespace-nowrap">{meta.label}</span>
                {argPreview(t.args) && <span className="font-mono text-[10.5px] text-[#64748B] truncate max-w-[240px]">“{argPreview(t.args)}”</span>}
                {t.summary && <span className="text-[#94A3B8] truncate">— {t.summary}</span>}
                {t.durationMs != null && <span className="text-[#CBD5E1] font-mono text-[10px] ml-auto shrink-0">{t.durationMs}ms</span>}
              </div>
            );
          })}
          {m.reasoning && (
            <details className="text-[11px] text-[#94A3B8]">
              <summary className="cursor-pointer select-none">Model reasoning</summary>
              <p className="mt-1 whitespace-pre-wrap leading-snug max-h-40 overflow-y-auto">{m.reasoning.slice(-2500)}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

const VerificationBadge: React.FC<{ v?: Verification; reasons?: string[] }> = ({ v, reasons }) => {
  if (!v || v.status === 'skipped') return null;
  const map = {
    verified: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: ShieldCheck, text: 'Verified against sources' },
    revised: { cls: 'bg-amber-50 text-amber-800 border-amber-200', icon: RefreshCw, text: 'Self-corrected after verification' },
    unverified: { cls: 'bg-slate-100 text-slate-600 border-slate-200', icon: AlertTriangle, text: 'Could not verify' },
  } as const;
  const s = map[v.status as keyof typeof map];
  if (!s) return null;
  const issues = v.issues?.length ? v.issues : reasons;
  return (
    <span
      title={issues?.length ? `Fixed: ${issues.join(' · ')}` : undefined}
      className={`inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}
    >
      <s.icon size={11} /> {s.text}
    </span>
  );
};

export const AssistantView: React.FC<Props> = ({ currentUser, onAddToast }) => {
  const [sessions, setSessions] = useState<AssistantSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [actions, setActions] = useState<Record<string, ProposedAction>>({});
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [rightTab, setRightTab] = useState<'sources' | 'approvals'>('sources');
  const [focusMsgId, setFocusMsgId] = useState<string | null>(null);
  const [focusSource, setFocusSource] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const toast = useCallback(
    (kind: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING', title: string, message: string) =>
      onAddToast?.({ type: kind === 'SUCCESS' ? 'AI_AGENT' : kind === 'INFO' ? 'INFO' : 'IOT_ALERT', title, subtitle: 'AI Assistant', message }),
    [onAddToast]
  );

  // ── Data loading ──
  const loadSessions = useCallback(async () => {
    try {
      setSessions(await assistantApi.listSessions(currentUser.name));
    } catch {
      /* backend unavailable */
    }
  }, [currentUser.name]);

  const loadPendingActions = useCallback(async () => {
    try {
      const list = await assistantApi.listActions({ status: 'PENDING' });
      setActions((prev) => ({ ...prev, ...Object.fromEntries(list.map((a) => [a.id, a])) }));
    } catch {}
  }, []);

  useEffect(() => {
    loadSessions();
    loadPendingActions();
  }, [loadSessions, loadPendingActions]);

  useEffect(() => {
    const upsert = (a: ProposedAction) => setActions((prev) => ({ ...prev, [a.id]: a }));
    socket.on('assistant:action_proposed', upsert);
    socket.on('assistant:action_updated', upsert);
    return () => {
      socket.off('assistant:action_proposed', upsert);
      socket.off('assistant:action_updated', upsert);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: streaming ? 'auto' : 'smooth' });
  }, [messages, streaming]);

  const openSession = async (id: string) => {
    if (streaming) return;
    setSessionId(id);
    setFocusMsgId(null);
    try {
      const [msgs, acts] = await Promise.all([assistantApi.getMessages(id), assistantApi.listActions({ sessionId: id })]);
      setActions((prev) => ({ ...prev, ...Object.fromEntries(acts.map((a) => [a.id, a])) }));
      setMessages(
        msgs.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          sources: m.meta?.sources || [],
          trace: m.meta?.trace || [],
          actionIds: m.meta?.actions || [],
          verification: m.meta?.verification,
          model: m.meta?.model,
          feedback: m.feedback,
        }))
      );
    } catch (err: any) {
      toast('ERROR', 'Could not open conversation', err.message);
    }
  };

  const newChat = () => {
    if (streaming) abortRef.current?.abort();
    setSessionId(null);
    setMessages([]);
    setFocusMsgId(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const removeSession = async (id: string) => {
    try {
      await assistantApi.deleteSession(id);
      setSessions((s) => s.filter((x) => x.id !== id));
      if (id === sessionId) newChat();
    } catch (err: any) {
      toast('ERROR', 'Delete failed', err.message);
    }
  };

  // ── Chat ──
  const patch = (id: string, fn: (m: UIMessage) => UIMessage) => setMessages((list) => list.map((m) => (m.id === id ? fn(m) : m)));

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || streaming) return;
    setInput('');
    const tmpId = `pending-${Date.now()}`;
    setMessages((list) => [
      ...list,
      { id: `u-${Date.now()}`, role: 'user', content: text, sources: [], trace: [], actionIds: [] },
      { id: tmpId, role: 'assistant', content: '', sources: [], trace: [], actionIds: [], streaming: true, status: 'Thinking…', reasoning: '' },
    ]);
    setFocusMsgId(tmpId);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let msgId = tmpId;
    let isNewSession = !sessionId;

    try {
      await streamChat(
        { sessionId, message: text, user: { name: currentUser.name, role: currentUser.role } },
        (e) => {
          switch (e.type) {
            case 'session':
              setSessionId(e.sessionId);
              break;
            case 'status':
              patch(msgId, (m) => ({ ...m, status: e.text }));
              break;
            case 'reasoning':
              patch(msgId, (m) => ({ ...m, reasoning: (m.reasoning || '') + e.delta }));
              break;
            case 'token':
              patch(msgId, (m) => ({ ...m, content: m.content + e.delta, status: undefined }));
              break;
            case 'tool_call':
              patch(msgId, (m) => ({ ...m, trace: [...m.trace, { id: e.id, name: e.name, args: e.args, kind: e.kind, running: true }] }));
              break;
            case 'tool_result':
              patch(msgId, (m) => ({
                ...m,
                trace: m.trace.map((t) => (t.id === e.id ? { ...t, running: false, ok: e.ok, summary: e.summary, durationMs: e.durationMs } : t)),
              }));
              break;
            case 'sources':
              patch(msgId, (m) => ({ ...m, sources: e.sources }));
              break;
            case 'action':
              setActions((prev) => ({ ...prev, [e.action.id]: e.action }));
              patch(msgId, (m) => ({ ...m, actionIds: [...m.actionIds, e.action.id] }));
              break;
            case 'clear_answer':
              patch(msgId, (m) => ({ ...m, content: '' }));
              break;
            case 'revision':
              patch(msgId, (m) => ({ ...m, content: '', revisionReasons: e.reason, status: 'Correcting the answer after verification…' }));
              break;
            case 'verification':
              patch(msgId, (m) => ({ ...m, verification: e.verification }));
              break;
            case 'done': {
              const finalId = e.messageId;
              patch(msgId, (m) => ({
                ...m,
                id: finalId,
                content: e.answer,
                sources: e.sources,
                verification: e.verification,
                model: e.model,
                streaming: false,
                status: undefined,
              }));
              setFocusMsgId(finalId);
              msgId = finalId;
              break;
            }
            case 'error':
              patch(msgId, (m) => ({ ...m, streaming: false, status: undefined, error: e.message }));
              break;
          }
        },
        ctrl.signal
      );
    } catch (err: any) {
      if (ctrl.signal.aborted) {
        patch(msgId, (m) => ({ ...m, streaming: false, status: undefined, error: m.content ? undefined : 'Stopped.' }));
      } else {
        patch(msgId, (m) => ({ ...m, streaming: false, status: undefined, error: err.message || 'The assistant is unavailable.' }));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      if (isNewSession) loadSessions();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const stop = () => abortRef.current?.abort();

  const rate = async (m: UIMessage, rating: 'up' | 'down') => {
    if (m.id.startsWith('pending-')) return;
    patch(m.id, (x) => ({ ...x, feedback: rating }));
    try {
      await assistantApi.feedback(m.id, rating);
    } catch {}
  };

  // ── Approvals ──
  const decide = async (a: ProposedAction, decision: 'approve' | 'reject') => {
    try {
      const updated = await assistantApi.decide(a.id, decision, { name: currentUser.name, role: currentUser.role, roleKey: currentUser.roleKey });
      setActions((prev) => ({ ...prev, [updated.id]: updated }));
      if (updated.status === 'EXECUTED') toast('SUCCESS', 'Approved & executed', updated.summary);
      else if (updated.status === 'FAILED') toast('ERROR', 'Approved but execution failed', updated.result?.error || updated.summary);
      else toast('INFO', 'Proposal rejected', updated.summary);
    } catch (err: any) {
      toast('ERROR', 'Decision failed', err.message);
    }
  };

  const pending = useMemo(
    () => Object.values(actions).filter((a) => a.status === 'PENDING').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [actions]
  );

  const focusMsg = messages.find((m) => m.id === focusMsgId) || [...messages].reverse().find((m) => m.role === 'assistant');

  const openCitation = (msg: UIMessage, label: string) => {
    setFocusMsgId(msg.id);
    setFocusSource(label);
    setRightTab('sources');
    setTimeout(() => document.getElementById(`src-${label}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  };

  // ── Render helpers ──
  const renderMarkdown = (m: UIMessage) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => {
          if (href?.startsWith('#cite-')) {
            const label = href.slice(6);
            const known = m.sources.some((s) => s.label === label);
            return (
              <button
                onClick={() => openCitation(m, label)}
                className={`inline-flex items-center align-baseline mx-0.5 px-1.5 py-0 rounded-md text-[10px] font-bold font-mono border transition-colors ${
                  known ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
                title={m.sources.find((s) => s.label === label)?.title || 'Source'}
              >
                {label}
              </button>
            );
          }
          return <a href={href} target="_blank" rel="noreferrer" className="text-blue-700 underline">{children}</a>;
        },
        p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="my-2 pl-5 list-disc space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="my-2 pl-5 list-decimal space-y-1">{children}</ol>,
        h1: ({ children }) => <h3 className="mt-3 mb-1.5 text-[15px] font-extrabold text-[#1E293B]">{children}</h3>,
        h2: ({ children }) => <h3 className="mt-3 mb-1.5 text-[14px] font-extrabold text-[#1E293B]">{children}</h3>,
        h3: ({ children }) => <h4 className="mt-3 mb-1 text-[13px] font-bold text-[#1E293B]">{children}</h4>,
        strong: ({ children }) => <strong className="font-bold text-[#0F172A]">{children}</strong>,
        hr: () => <hr className="my-3 border-[#E7E3DA]" />,
        blockquote: ({ children }) => <blockquote className="my-2 border-l-4 border-amber-300 bg-amber-50/60 px-3 py-1.5 rounded-r-md text-[#44403C]">{children}</blockquote>,
        code: ({ children }) => <code className="px-1 py-0.5 rounded bg-slate-100 text-[12px] font-mono text-slate-800">{children}</code>,
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto rounded-lg border border-[#DDD9D0]">
            <table className="w-full text-[12.5px] border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-[#F5F3EE]">{children}</thead>,
        th: ({ children }) => <th className="text-left font-bold text-[#475569] px-2.5 py-1.5 border-b border-[#DDD9D0] whitespace-nowrap">{children}</th>,
        td: ({ children }) => <td className="px-2.5 py-1.5 border-b border-[#EFECE5] align-top">{children}</td>,
      }}
    >
      {withCitationLinks(m.content)}
    </ReactMarkdown>
  );

  // ── Layout ──
  return (
    <div className="flex gap-3 h-[calc(100vh-7.5rem)] min-h-[560px]">
      {/* Conversations */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col rounded-xl border border-[#DDD9D0] bg-[#FAF9F6] overflow-hidden">
        <div className="p-3 border-b border-[#DDD9D0]">
          <button onClick={newChat} className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">
            <Plus size={14} /> New conversation
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sessions.length === 0 && <div className="p-3 text-[11px] text-[#94A3B8]">No conversations yet.</div>}
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => openSession(s.id)}
              className={`group flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer ${s.id === sessionId ? 'bg-white border border-[#DDD9D0] shadow-sm' : 'hover:bg-white/70 border border-transparent'}`}
            >
              <MessageSquare size={13} className="mt-0.5 text-[#94A3B8] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-[#1E293B] truncate">{s.title}</div>
                <div className="text-[10px] text-[#94A3B8]">{timeAgo(s.updatedAt)}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeSession(s.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50"
                title="Delete conversation"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Chat */}
      <section className="flex-1 min-w-0 flex flex-col rounded-xl border border-[#DDD9D0] bg-white overflow-hidden">
        <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-[#EFECE5] bg-[#FAF9F6]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-extrabold text-[#1E293B] leading-tight">PlantOps Copilot</div>
              <div className="text-[11px] text-[#64748B] truncate">TiDB records · MQTT/Redis live telemetry · TimescaleDB history · actions with your approval</div>
            </div>
          </div>
          <button onClick={newChat} className="lg:hidden inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-[#DDD9D0] text-xs font-bold text-[#475569]">
            <Plus size={13} /> New
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto pt-6">
              <div className="text-center">
                <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white items-center justify-center shadow-md mb-3">
                  <Sparkles size={22} />
                </div>
                <h2 className="text-lg font-extrabold text-[#1E293B]">How can I help, {currentUser.name.split(' ')[0]}?</h2>
                <p className="text-[13px] text-[#64748B] mt-1">
                  I check live machines, incidents, stock and production, look up SOPs and past repairs, and can draft work orders or POs for your approval.
                </p>
              </div>
              <div className="mt-6 grid sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    onClick={() => send(s.text)}
                    className="text-left flex items-start gap-2.5 p-3 rounded-xl border border-[#E7E3DA] bg-[#FAF9F6] hover:bg-white hover:border-blue-300 transition-colors"
                  >
                    <s.icon size={15} className="text-blue-600 mt-0.5 shrink-0" />
                    <span className="text-[12.5px] text-[#334155] leading-snug">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-5">
              {messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 text-white px-3.5 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap">{m.content}</div>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-2.5" onClick={() => setFocusMsgId(m.id)}>
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Steps m={m} />
                      {m.content ? (
                        <div className="text-[13.5px] text-[#1E293B]">{renderMarkdown(m)}</div>
                      ) : null}
                      {m.streaming && (
                        <div className="flex items-center gap-2 text-[12px] text-[#64748B] mt-1">
                          <Loader2 size={13} className="animate-spin text-blue-600" />
                          {m.status || 'Writing…'}
                        </div>
                      )}
                      {m.error && (
                        <div className="mt-1 flex items-center gap-1.5 text-[12px] text-rose-600">
                          <AlertTriangle size={13} /> {m.error}
                        </div>
                      )}
                      {m.actionIds.map((id) => actions[id] && <ActionCard key={id} a={actions[id]} roleKey={currentUser.roleKey} roleLabel={currentUser.role} onDecide={decide} />)}
                      {!m.streaming && !m.error && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <VerificationBadge v={m.verification} reasons={m.revisionReasons} />
                          {m.sources.length > 0 && (
                            <button
                              onClick={() => { setFocusMsgId(m.id); setRightTab('sources'); }}
                              className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border border-[#DDD9D0] text-[#475569] hover:bg-[#FAF9F6]"
                            >
                              <BookOpen size={11} /> {m.sources.length} source{m.sources.length > 1 ? 's' : ''}
                            </button>
                          )}
                          <div className="ml-auto flex items-center gap-1">
                            <button onClick={() => rate(m, 'up')} className={`p-1 rounded ${m.feedback === 'up' ? 'text-emerald-600 bg-emerald-50' : 'text-[#CBD5E1] hover:text-[#64748B]'}`} title="Helpful">
                              <ThumbsUp size={13} />
                            </button>
                            <button onClick={() => rate(m, 'down')} className={`p-1 rounded ${m.feedback === 'down' ? 'text-rose-600 bg-rose-50' : 'text-[#CBD5E1] hover:text-[#64748B]'}`} title="Not helpful">
                              <ThumbsDown size={13} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-[#EFECE5] bg-[#FAF9F6] px-4 sm:px-6 py-3">
          <div className="max-w-3xl mx-auto flex items-end gap-2 rounded-xl border border-[#DDD9D0] bg-white px-3 py-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Ask about a machine, a fault, a procedure, stock or production…"
              className="flex-1 resize-none bg-transparent outline-none text-[13.5px] text-[#1E293B] placeholder:text-[#94A3B8] max-h-40 py-1.5"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = `${Math.min(160, el.scrollHeight)}px`;
              }}
            />
            {streaming ? (
              <button onClick={stop} className="h-9 w-9 shrink-0 rounded-lg bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center" title="Stop">
                <Square size={13} />
              </button>
            ) : (
              <button
                onClick={() => send()}
                disabled={!input.trim()}
                className="h-9 w-9 shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center disabled:opacity-40"
                title="Send (Enter)"
              >
                <Send size={14} />
              </button>
            )}
          </div>
          <div className="max-w-3xl mx-auto mt-1.5 text-[10.5px] text-[#94A3B8]">
            Answers are grounded in plant data and cited sources. Always follow LOTO and site safety rules — nothing is executed without approval.
          </div>
        </div>
      </section>

      {/* Context panel */}
      <aside className="hidden xl:flex w-[340px] shrink-0 flex-col rounded-xl border border-[#DDD9D0] bg-[#FAF9F6] overflow-hidden">
        <div className="flex border-b border-[#DDD9D0] bg-white">
          {([
            { id: 'sources', label: 'Sources', icon: BookOpen, count: focusMsg?.sources.length || 0 },
            { id: 'approvals', label: 'Approvals', icon: ClipboardCheck, count: pending.length },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setRightTab(t.id)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 h-11 text-[12px] font-bold border-b-2 ${
                rightTab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
              }`}
            >
              <t.icon size={13} /> {t.label}
              {t.count > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full ${t.id === 'approvals' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {rightTab === 'sources' && (
            <div className="space-y-2">
              {!focusMsg?.sources.length ? (
                <div className="p-4 text-center text-[12px] text-[#94A3B8]">
                  Sources the assistant cites (SOPs, LOTO procedures and past incidents from TiDB) appear here. Click a <span className="font-mono">[S1]</span> chip to jump to it.
                </div>
              ) : (
                focusMsg.sources.map((s) => (
                  <div
                    id={`src-${s.label}`}
                    key={s.label}
                    className={`rounded-xl border bg-white p-2.5 transition-shadow ${focusSource === s.label ? 'border-blue-400 ring-2 ring-blue-100' : 'border-[#E7E3DA]'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md bg-blue-600 text-white">{s.label}</span>
                      <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded border ${SOURCE_BADGE[s.sourceType] || SOURCE_BADGE.DOC}`}>{s.sourceType.replace('_', ' ')}</span>
                      {s.machine && <span className="text-[10px] font-mono text-[#64748B]">{s.machine}</span>}
                      <span className="ml-auto text-[9.5px] font-mono text-[#94A3B8]" title="Cross-encoder relevance">rel {s.score.toFixed(1)}</span>
                    </div>
                    <div className="text-[12px] font-bold text-[#1E293B] leading-snug">{s.title}</div>
                    {s.section && <div className="text-[11px] text-[#64748B]">{s.section}</div>}
                    <p className="mt-1 text-[11.5px] text-[#475569] leading-snug whitespace-pre-line line-clamp-[10]">{s.excerpt}</p>
                    <div className="mt-1 text-[10px] font-mono text-[#94A3B8]">{s.ref}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {rightTab === 'approvals' && (
            <div className="space-y-2">
              {pending.length === 0 ? (
                <div className="p-4 text-center text-[12px] text-[#94A3B8]">No proposals waiting. When the assistant drafts a work order, part reservation or PO, it appears here for approval.</div>
              ) : (
                pending.map((a) => (
                  <div key={a.id}>
                    <div className="text-[10px] text-[#94A3B8] mb-0.5">{a.requestedBy} · {timeAgo(a.createdAt)}</div>
                    <ActionCard a={a} roleKey={currentUser.roleKey} roleLabel={currentUser.role} onDecide={decide} />
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </aside>
    </div>
  );
};

export default AssistantView;
