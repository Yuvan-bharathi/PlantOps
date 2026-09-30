/**
 * /api/assistant — streaming chat (SSE), sessions, approvals, knowledge-index status.
 */
import { Router, Request, Response } from 'express';
import { runAgent, AgentEvent } from './agent.js';
import { addMessage, createSession, deleteSession, getMessages, getSession, listSessions, setFeedback } from './memory.js';
import { decideAction, listActions, ActionStatus, ForbiddenError } from './actions.js';
import { ensureLoaded, getIndexStatus, rebuildIndex, searchKnowledge } from './knowledge/store.js';
import { warmUpModels } from './models.js';

const router = Router();

const ok = (res: Response, data: any) => res.json({ success: true, data });
const fail = (res: Response, err: any, status = 500) => res.status(status).json({ success: false, error: err?.message || String(err) });

// ── Chat (Server-Sent Events) ────────────────────────────────────────────────
router.post('/chat', async (req: Request, res: Response) => {
  const message = String(req.body?.message || '').trim();
  const user = {
    name: String(req.body?.user?.name || 'Plant Member').slice(0, 100),
    role: String(req.body?.user?.role || 'Operator').slice(0, 60),
  };
  if (!message) return fail(res, 'message is required', 400);
  if (message.length > 4000) return fail(res, 'message is too long (max 4000 characters)', 400);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event: string, data: any) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const ctrl = new AbortController();
  res.on('close', () => ctrl.abort());
  const heartbeat = setInterval(() => !res.writableEnded && res.write(': ping\n\n'), 15000);

  try {
    let session = req.body?.sessionId ? await getSession(req.body.sessionId) : null;
    if (!session) session = await createSession(message.slice(0, 80), user.name, user.role);
    const history = (await getMessages(session.id, 24)).map((m) => ({ role: m.role, content: m.content }));
    const userMsg = await addMessage(session.id, 'user', message);
    send('session', { sessionId: session.id, title: session.title, userMessageId: userMsg.id });

    const result = await runAgent({
      question: message,
      history,
      sessionId: session.id,
      user,
      signal: ctrl.signal,
      emit: (e: AgentEvent) => send(e.type, e),
    });

    const saved = await addMessage(session.id, 'assistant', result.answer, {
      sources: result.sources,
      actions: result.actions.map((a) => a.id),
      trace: result.trace,
      verification: result.verification,
      model: result.model,
      steps: result.steps,
      usage: result.usage,
    });
    send('done', { messageId: saved.id, sessionId: session.id, ...result });
  } catch (err: any) {
    if (!ctrl.signal.aborted) send('error', { message: err.message || 'Assistant failed' });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

// ── Sessions & feedback ──────────────────────────────────────────────────────
router.get('/sessions', async (req, res) => {
  try { ok(res, await listSessions(req.query.user ? String(req.query.user) : undefined)); } catch (e) { fail(res, e); }
});

router.get('/sessions/:id/messages', async (req, res) => {
  try { ok(res, await getMessages(req.params.id)); } catch (e) { fail(res, e); }
});

router.delete('/sessions/:id', async (req, res) => {
  try { await deleteSession(req.params.id); ok(res, { deleted: req.params.id }); } catch (e) { fail(res, e); }
});

router.post('/messages/:id/feedback', async (req, res) => {
  const rating = req.body?.rating;
  if (rating !== 'up' && rating !== 'down') return fail(res, 'rating must be "up" or "down"', 400);
  try { await setFeedback(req.params.id, rating, req.body?.note); ok(res, { id: req.params.id, rating }); } catch (e) { fail(res, e); }
});

// ── Human-in-the-loop approvals ──────────────────────────────────────────────
router.get('/actions', async (req, res) => {
  try {
    ok(res, await listActions({
      status: req.query.status ? (String(req.query.status).toUpperCase() as ActionStatus) : undefined,
      sessionId: req.query.sessionId ? String(req.query.sessionId) : undefined,
    }));
  } catch (e) { fail(res, e); }
});

router.post('/actions/:id/decision', async (req, res) => {
  const decision = req.body?.decision;
  const name = String(req.body?.decider?.name || '').trim();
  if (decision !== 'approve' && decision !== 'reject') return fail(res, 'decision must be "approve" or "reject"', 400);
  if (!name) return fail(res, 'decider.name is required', 400);
  try {
    ok(res, await decideAction(req.params.id, decision, { name, role: req.body?.decider?.role, roleKey: req.body?.decider?.roleKey }, req.body?.note));
  } catch (e: any) {
    fail(res, e, e instanceof ForbiddenError ? 403 : /not found|already/.test(e.message) ? 409 : 500);
  }
});

// ── Knowledge base ───────────────────────────────────────────────────────────
router.get('/knowledge/status', async (_req, res) => {
  try { await ensureLoaded(); ok(res, getIndexStatus()); } catch (e) { fail(res, e); }
});

router.post('/knowledge/reindex', async (_req, res) => {
  try { ok(res, await rebuildIndex()); } catch (e) { fail(res, e); }
});

router.get('/knowledge/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return fail(res, 'q is required', 400);
  try {
    ok(res, await searchKnowledge(q, {
      topK: Number(req.query.top_k) || 6,
      machineType: req.query.machine_type ? String(req.query.machine_type) : undefined,
    }));
  } catch (e) { fail(res, e); }
});

// ── Startup ──────────────────────────────────────────────────────────────────
export function initAssistant(): void {
  (async () => {
    try {
      await ensureLoaded();
      await warmUpModels();
      await rebuildIndex();
    } catch (err: any) {
      console.warn(`[Assistant] Initial knowledge indexing failed: ${err.message}`);
    }
  })();
  // Keep incident / work-order history fresh (incremental: only changed chunks are re-embedded)
  setInterval(() => rebuildIndex().catch(() => {}), 15 * 60 * 1000);
}

export default router;
