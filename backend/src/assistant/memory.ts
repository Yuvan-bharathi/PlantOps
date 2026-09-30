/**
 * Conversation memory: sessions + messages persisted in TiDB (in-memory fallback).
 */
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/mysql.js';

export interface AssistantMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  meta?: Record<string, any>; // sources, tool trace, verification, actions
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

const memSessions = new Map<string, AssistantSession>();
const memMessages = new Map<string, AssistantMessage[]>();
let ready: Promise<boolean> | null = null;

function ensureTables(): Promise<boolean> {
  return (ready ||= (async () => {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS assistant_sessions (
          id         VARCHAR(40)  NOT NULL PRIMARY KEY,
          title      VARCHAR(200) NOT NULL,
          user_name  VARCHAR(120) NOT NULL,
          user_role  VARCHAR(80)  NOT NULL,
          created_at DATETIME(3)  NOT NULL,
          updated_at DATETIME(3)  NOT NULL,
          INDEX idx_as_user (user_name, updated_at)
        )`);
      await query(`
        CREATE TABLE IF NOT EXISTS assistant_messages (
          id            VARCHAR(40) NOT NULL PRIMARY KEY,
          session_id    VARCHAR(40) NOT NULL,
          role          VARCHAR(12) NOT NULL,
          content       MEDIUMTEXT  NOT NULL,
          meta          JSON        NULL,
          feedback      VARCHAR(8)  NULL,
          feedback_note TEXT        NULL,
          created_at    DATETIME(3) NOT NULL,
          INDEX idx_am_session (session_id, created_at)
        )`);
      return true;
    } catch (err: any) {
      console.warn(`[Assistant] Conversation tables unavailable, using memory: ${err.message}`);
      return false;
    }
  })());
}

const iso = (v: any) => new Date(v).toISOString();

export async function createSession(title: string, userName: string, userRole: string): Promise<AssistantSession> {
  const now = new Date().toISOString();
  const s: AssistantSession = { id: `SES-${uuidv4().slice(0, 12)}`, title: title.slice(0, 200), userName, userRole, createdAt: now, updatedAt: now };
  memSessions.set(s.id, s);
  if (await ensureTables()) {
    await query(`INSERT INTO assistant_sessions (id, title, user_name, user_role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`, [
      s.id, s.title, userName, userRole, new Date(now), new Date(now),
    ]).catch(() => {});
  }
  return s;
}

export async function getSession(id: string): Promise<AssistantSession | null> {
  if (await ensureTables()) {
    try {
      const rows = await query<any>(`SELECT * FROM assistant_sessions WHERE id = ? LIMIT 1`, [id]);
      if (rows[0]) {
        const r = rows[0];
        return { id: r.id, title: r.title, userName: r.user_name, userRole: r.user_role, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) };
      }
    } catch {}
  }
  return memSessions.get(id) || null;
}

export async function listSessions(userName?: string): Promise<AssistantSession[]> {
  if (await ensureTables()) {
    try {
      const rows = await query<any>(
        `SELECT * FROM assistant_sessions ${userName ? 'WHERE user_name = ?' : ''} ORDER BY updated_at DESC LIMIT 50`,
        userName ? [userName] : []
      );
      return rows.map((r) => ({ id: r.id, title: r.title, userName: r.user_name, userRole: r.user_role, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) }));
    } catch {}
  }
  return [...memSessions.values()].filter((s) => !userName || s.userName === userName).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteSession(id: string): Promise<void> {
  memSessions.delete(id);
  memMessages.delete(id);
  if (await ensureTables()) {
    await query(`DELETE FROM assistant_messages WHERE session_id = ?`, [id]).catch(() => {});
    await query(`DELETE FROM assistant_sessions WHERE id = ?`, [id]).catch(() => {});
  }
}

export async function getMessages(sessionId: string, limit = 100): Promise<AssistantMessage[]> {
  if (await ensureTables()) {
    try {
      const rows = await query<any>(
        `SELECT * FROM (SELECT * FROM assistant_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?) t ORDER BY created_at ASC`,
        [sessionId, limit]
      );
      return rows.map((r) => ({
        id: r.id,
        sessionId: r.session_id,
        role: r.role,
        content: r.content,
        meta: r.meta ? (typeof r.meta === 'string' ? JSON.parse(r.meta) : r.meta) : undefined,
        feedback: r.feedback || null,
        createdAt: iso(r.created_at),
      }));
    } catch {}
  }
  return (memMessages.get(sessionId) || []).slice(-limit);
}

export async function addMessage(sessionId: string, role: 'user' | 'assistant', content: string, meta?: Record<string, any>): Promise<AssistantMessage> {
  const m: AssistantMessage = { id: `MSG-${uuidv4().slice(0, 12)}`, sessionId, role, content, meta, createdAt: new Date().toISOString() };
  if (!memMessages.has(sessionId)) memMessages.set(sessionId, []);
  memMessages.get(sessionId)!.push(m);
  if (await ensureTables()) {
    await query(`INSERT INTO assistant_messages (id, session_id, role, content, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [
      m.id, sessionId, role, content, meta ? JSON.stringify(meta) : null, new Date(m.createdAt),
    ]).catch((err) => console.warn(`[Assistant] Could not persist message: ${err.message}`));
    await query(`UPDATE assistant_sessions SET updated_at = ? WHERE id = ?`, [new Date(), sessionId]).catch(() => {});
  }
  return m;
}

export async function setFeedback(messageId: string, feedback: 'up' | 'down', note?: string): Promise<void> {
  for (const list of memMessages.values()) {
    const m = list.find((x) => x.id === messageId);
    if (m) m.feedback = feedback;
  }
  if (await ensureTables()) {
    await query(`UPDATE assistant_messages SET feedback = ?, feedback_note = ? WHERE id = ?`, [feedback, note || null, messageId]).catch(() => {});
  }
}
