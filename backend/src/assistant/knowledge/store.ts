/**
 * RAG knowledge store
 *
 * Indexing:   docs → heading-aware chunks with contextual headers → local BGE embeddings
 *             → TiDB `kb_chunks` (VECTOR(384)), mirrored to a local cache for offline use.
 *             Re-indexing is incremental (content hash), so only changed chunks are re-embedded.
 * Retrieval:  multi-query expansion → dense (TiDB VEC_COSINE_DISTANCE) + sparse (BM25)
 *             → reciprocal-rank fusion → cross-encoder re-ranking → relevance floor + per-doc diversity.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { query } from '../../db/mysql.js';
import { EMBED_DIM, embedPassages, embedQuery, rerank } from '../models.js';
import { chatJson, FAST_MODEL, isLLMConfigured } from '../groq.js';
import { collectKnowledgeDocs, KnowledgeDoc, SourceType } from './sources.js';

export interface Chunk {
  id: string;
  docId: string;
  sourceType: SourceType;
  title: string;
  section: string;
  ref: string;
  machineType?: string;
  machineCode?: string;
  content: string;
  hash: string;
  embedding?: number[];
}

export interface SearchHit {
  id: string;
  docId: string;
  sourceType: SourceType;
  title: string;
  section: string;
  ref: string;
  machineType?: string;
  machineCode?: string;
  content: string;
  score: number; // cross-encoder relevance (or fused score when re-ranking is unavailable)
}

export interface SearchOptions {
  topK?: number;
  machineType?: string;
  sourceTypes?: SourceType[];
  expand?: boolean;
}

const CACHE_FILE = path.resolve(process.cwd(), 'data', 'kb_index.json');
const MAX_CHUNK_CHARS = 1100;
const CHUNK_OVERLAP_CHARS = 180;
const RELEVANCE_FLOOR = -3; // cross-encoder logit; below this a passage is almost never relevant
const MAX_CHUNKS_PER_DOC = 2;

let chunks: Chunk[] = [];
let byId = new Map<string, Chunk>();
let bm25: Bm25Index | null = null;
let dbAvailable = false;
let lastBuiltAt: string | null = null;
let lastBuildWarnings: string[] = [];
let building: Promise<IndexStatus> | null = null;
let loaded: Promise<void> | null = null;

// ── Chunking ─────────────────────────────────────────────────────────────────

function splitLong(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text];
  const paras = text.split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z0-9])/);
  const out: string[] = [];
  let cur = '';
  for (const p of paras) {
    if (cur && cur.length + p.length + 1 > MAX_CHUNK_CHARS) {
      out.push(cur.trim());
      cur = cur.slice(-CHUNK_OVERLAP_CHARS) + ' ';
    }
    if (p.length > MAX_CHUNK_CHARS) {
      for (let i = 0; i < p.length; i += MAX_CHUNK_CHARS - CHUNK_OVERLAP_CHARS) out.push(p.slice(i, i + MAX_CHUNK_CHARS));
      cur = '';
      continue;
    }
    cur += p + '\n';
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function chunkDocument(doc: KnowledgeDoc): Chunk[] {
  const lines = doc.text.replace(/\r/g, '').split('\n');
  const sections: { heading: string; body: string[] }[] = [{ heading: '', body: [] }];
  for (const line of lines) {
    const m = line.match(/^#{1,3}\s+(.*)/);
    if (m && line.startsWith('## ')) sections.push({ heading: m[1].trim(), body: [] });
    else if (m && line.startsWith('### ')) sections.push({ heading: m[1].trim(), body: [] });
    else if (!(line.startsWith('# ') && sections.length === 1 && sections[0].body.length === 0)) sections[sections.length - 1].body.push(line);
  }
  // The intro (text before the first "##") is short context that belongs to every chunk
  const intro = sections[0].body.join('\n').trim();
  const bodySections = sections.slice(1).filter((s) => s.body.join('').trim());
  const parts = bodySections.length
    ? bodySections.flatMap((s) => splitLong(s.body.join('\n').trim()).map((t) => ({ section: s.heading, text: t })))
    : splitLong(intro).map((t) => ({ section: '', text: t }));
  const introForContext = bodySections.length ? intro.slice(0, 300) : '';

  return parts.map((p, i) => {
    const content = introForContext ? `${introForContext}\n\n${p.text}` : p.text;
    return {
      id: `${doc.id}#${i}`,
      docId: doc.id,
      sourceType: doc.sourceType,
      title: doc.title.slice(0, 250),
      section: p.section.slice(0, 250),
      ref: doc.ref.slice(0, 100),
      machineType: doc.machineType,
      machineCode: doc.machineCode,
      content,
      hash: crypto.createHash('sha1').update(embedTextOf({ title: doc.title, section: p.section, content } as Chunk)).digest('hex'),
    };
  });
}

// Contextual header: the model sees which document/section a passage belongs to
function embedTextOf(c: Pick<Chunk, 'title' | 'section' | 'content'>): string {
  return `${c.title}${c.section ? ` — ${c.section}` : ''}\n${c.content}`;
}

// ── BM25 ─────────────────────────────────────────────────────────────────────

const STOPWORDS = new Set(
  'a an and are as at be by for from has have how i in is it its of on or that the this to was were what when where which who why will with do does did can should my our your me we you'.split(' ')
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOPWORDS.has(t));
}

class Bm25Index {
  private docs: { id: string; tf: Map<string, number>; len: number }[] = [];
  private df = new Map<string, number>();
  private avgLen = 1;
  constructor(items: Chunk[], private k1 = 1.2, private b = 0.75) {
    for (const c of items) {
      const toks = tokenize(embedTextOf(c));
      const tf = new Map<string, number>();
      toks.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
      tf.forEach((_, t) => this.df.set(t, (this.df.get(t) || 0) + 1));
      this.docs.push({ id: c.id, tf, len: toks.length });
    }
    this.avgLen = this.docs.reduce((s, d) => s + d.len, 0) / Math.max(1, this.docs.length);
  }
  search(q: string, limit: number, allow: (id: string) => boolean): { id: string; score: number }[] {
    const terms = [...new Set(tokenize(q))];
    const N = this.docs.length;
    const scored: { id: string; score: number }[] = [];
    for (const d of this.docs) {
      if (!allow(d.id)) continue;
      let s = 0;
      for (const t of terms) {
        const f = d.tf.get(t);
        if (!f) continue;
        const df = this.df.get(t) || 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        s += idf * ((f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * d.len) / this.avgLen)));
      }
      if (s > 0) scored.push({ id: d.id, score: s });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

// ── Persistence ──────────────────────────────────────────────────────────────

async function ensureTable(): Promise<boolean> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS kb_chunks (
        id            VARCHAR(160) NOT NULL PRIMARY KEY,
        doc_id        VARCHAR(140) NOT NULL,
        source_type   VARCHAR(20)  NOT NULL,
        title         VARCHAR(255) NOT NULL,
        section       VARCHAR(255) NULL,
        ref           VARCHAR(100) NULL,
        machine_type  VARCHAR(30)  NULL,
        machine_code  VARCHAR(40)  NULL,
        content       TEXT         NOT NULL,
        content_hash  CHAR(40)     NOT NULL,
        embedding     VECTOR(${EMBED_DIM}) NULL,
        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_kb_doc (doc_id),
        INDEX idx_kb_source (source_type)
      )`);
    return true;
  } catch (err: any) {
    console.warn(`[Assistant] TiDB vector table unavailable, using local index: ${err.message}`);
    return false;
  }
}

function setIndex(next: Chunk[]) {
  chunks = next;
  byId = new Map(next.map((c) => [c.id, c]));
  bm25 = new Bm25Index(next);
}

function saveCache() {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ builtAt: lastBuiltAt, chunks }));
  } catch (err: any) {
    console.warn(`[Assistant] Could not write local index cache: ${err.message}`);
  }
}

async function loadIndex(): Promise<void> {
  dbAvailable = await ensureTable();
  if (dbAvailable) {
    try {
      const rows = await query<any>(`SELECT * FROM kb_chunks`);
      if (rows.length) {
        setIndex(
          rows.map((r) => ({
            id: r.id,
            docId: r.doc_id,
            sourceType: r.source_type,
            title: r.title,
            section: r.section || '',
            ref: r.ref || '',
            machineType: r.machine_type || undefined,
            machineCode: r.machine_code || undefined,
            content: r.content,
            hash: r.content_hash,
            embedding: r.embedding ? (typeof r.embedding === 'string' ? JSON.parse(r.embedding) : r.embedding) : undefined,
          }))
        );
        return;
      }
    } catch (err: any) {
      console.warn(`[Assistant] Could not load kb_chunks: ${err.message}`);
      dbAvailable = false;
    }
  }
  try {
    const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    setIndex(cached.chunks || []);
    lastBuiltAt = cached.builtAt || null;
  } catch {
    setIndex([]);
  }
}

export function ensureLoaded(): Promise<void> {
  return (loaded ||= loadIndex());
}

// ── Indexing ─────────────────────────────────────────────────────────────────

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

export function getIndexStatus(): IndexStatus {
  const bySource: Record<string, number> = {};
  const docs = new Set<string>();
  for (const c of chunks) {
    bySource[c.sourceType] = (bySource[c.sourceType] || 0) + 1;
    docs.add(c.docId);
  }
  return {
    chunks: chunks.length,
    documents: docs.size,
    bySource,
    embedded: chunks.filter((c) => c.embedding).length,
    vectorBackend: dbAvailable ? 'tidb' : 'local',
    lastBuiltAt,
    building: !!building,
    warnings: lastBuildWarnings,
  };
}

const vecLiteral = (v: number[]) => `[${v.map((x) => x.toFixed(6)).join(',')}]`;

async function doRebuild(): Promise<IndexStatus> {
  await ensureLoaded();
  const t0 = Date.now();
  const { docs, warnings } = await collectKnowledgeDocs();
  const next = docs.flatMap(chunkDocument);

  // Reuse embeddings for unchanged chunks
  const stale: Chunk[] = [];
  for (const c of next) {
    const prev = byId.get(c.id);
    if (prev && prev.hash === c.hash && prev.embedding) c.embedding = prev.embedding;
    else stale.push(c);
  }

  try {
    const vectors = await embedPassages(stale.map(embedTextOf));
    stale.forEach((c, i) => (c.embedding = vectors[i]));
  } catch (err: any) {
    warnings.push(`Embedding model unavailable (keyword search only): ${err.message}`);
  }

  if (dbAvailable) {
    try {
      for (let i = 0; i < stale.length; i += 50) {
        const batch = stale.slice(i, i + 50);
        await query(
          `INSERT INTO kb_chunks (id, doc_id, source_type, title, section, ref, machine_type, machine_code, content, content_hash, embedding)
           VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
           ON DUPLICATE KEY UPDATE doc_id = VALUES(doc_id), source_type = VALUES(source_type), title = VALUES(title),
             section = VALUES(section), ref = VALUES(ref), machine_type = VALUES(machine_type), machine_code = VALUES(machine_code),
             content = VALUES(content), content_hash = VALUES(content_hash), embedding = VALUES(embedding)`,
          batch.flatMap((c) => [
            c.id, c.docId, c.sourceType, c.title, c.section || null, c.ref || null, c.machineType || null,
            c.machineCode || null, c.content, c.hash, c.embedding ? vecLiteral(c.embedding) : null,
          ])
        );
      }
      const keep = new Set(next.map((c) => c.id));
      const removed = chunks.filter((c) => !keep.has(c.id)).map((c) => c.id);
      for (let i = 0; i < removed.length; i += 200) {
        const batch = removed.slice(i, i + 200);
        await query(`DELETE FROM kb_chunks WHERE id IN (${batch.map(() => '?').join(',')})`, batch);
      }
    } catch (err: any) {
      warnings.push(`TiDB write failed, serving from local index: ${err.message}`);
      dbAvailable = false;
    }
  }

  setIndex(next);
  lastBuiltAt = new Date().toISOString();
  lastBuildWarnings = warnings;
  saveCache();
  console.log(
    `[Assistant] Knowledge index: ${next.length} chunks from ${docs.length} documents (${stale.length} re-embedded) in ${Date.now() - t0} ms`
  );
  return getIndexStatus();
}

export function rebuildIndex(): Promise<IndexStatus> {
  if (!building) building = doRebuild().finally(() => (building = null));
  return building;
}

// ── Retrieval ────────────────────────────────────────────────────────────────

const expansionCache = new Map<string, string[]>();

async function expandQuery(q: string): Promise<string[]> {
  if (!isLLMConfigured()) return [];
  const cached = expansionCache.get(q);
  if (cached) return cached;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const out = await chatJson<{ queries?: string[] }>({
      model: FAST_MODEL,
      temperature: 0,
      maxTokens: 300,
      reasoningEffort: 'low',
      signal: ctrl.signal,
      messages: [
        {
          role: 'system',
          content:
            'You rewrite search queries for an industrial maintenance knowledge base (SOPs, LOTO procedures, incident history, manuals). ' +
            'Return JSON {"queries": [..]} with 2 alternative phrasings that use precise technical/maintenance terminology ' +
            '(component names, failure modes, part types). Keep any machine codes, part numbers and values exactly.',
        },
        { role: 'user', content: q },
      ],
    });
    clearTimeout(timer);
    const queries = (out.queries || []).filter((x) => typeof x === 'string' && x.trim()).slice(0, 2);
    if (expansionCache.size > 300) expansionCache.clear();
    expansionCache.set(q, queries);
    return queries;
  } catch {
    return [];
  }
}

function cosine(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s; // vectors are L2-normalised
}

async function denseSearch(vec: number[], limit: number, allow: (c: Chunk) => boolean): Promise<string[]> {
  if (dbAvailable) {
    try {
      const rows = await query<{ id: string }>(
        `SELECT id FROM kb_chunks WHERE embedding IS NOT NULL ORDER BY VEC_COSINE_DISTANCE(embedding, ?) LIMIT ?`,
        [vecLiteral(vec), limit * 3]
      );
      return rows.map((r) => r.id).filter((id) => byId.has(id) && allow(byId.get(id)!)).slice(0, limit);
    } catch {
      // fall through to in-memory search
    }
  }
  return chunks
    .filter((c) => c.embedding && allow(c))
    .map((c) => ({ id: c.id, s: cosine(vec, c.embedding!) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.id);
}

export async function searchKnowledge(
  q: string,
  opts: SearchOptions = {}
): Promise<{ hits: SearchHit[]; queries: string[]; mode: string }> {
  await ensureLoaded();
  if (!chunks.length) await rebuildIndex();

  const topK = Math.min(10, Math.max(1, opts.topK ?? 6));
  const mt = opts.machineType?.toUpperCase();
  const allow = (c: Chunk) =>
    (!opts.sourceTypes?.length || opts.sourceTypes.includes(c.sourceType)) &&
    // generic documents (no machine type) always stay eligible
    (!mt || !c.machineType || c.machineType.toUpperCase() === mt);

  const queries = [q, ...(opts.expand === false ? [] : await expandQuery(q))];
  const lists: string[][] = [];
  let mode = 'hybrid+rerank';

  for (const qq of queries) lists.push(bm25!.search(qq, 25, (id) => allow(byId.get(id)!)).map((x) => x.id));
  try {
    const vecs = await Promise.all(queries.map((qq) => embedQuery(qq)));
    lists.push(...(await Promise.all(vecs.map((v) => denseSearch(v, 25, allow)))));
  } catch {
    mode = 'keyword';
  }

  // Reciprocal-rank fusion
  const fused = new Map<string, number>();
  for (const list of lists) list.forEach((id, rank) => fused.set(id, (fused.get(id) || 0) + 1 / (60 + rank + 1)));
  const candidates = [...fused.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([id, s]) => ({ c: byId.get(id)!, s }));

  let scored = candidates.map((x) => ({ c: x.c, score: x.s }));
  try {
    const rs = await rerank(q, candidates.map((x) => embedTextOf(x.c)));
    scored = candidates.map((x, i) => ({ c: x.c, score: rs[i] })).filter((x) => x.score >= RELEVANCE_FLOOR);
  } catch {
    if (mode === 'hybrid+rerank') mode = 'hybrid';
  }
  scored.sort((a, b) => b.score - a.score);

  // Small-to-big: a matching section of a procedure (SOP / LOTO / checklist) returns the whole
  // procedure, so steps are never cited out of order or with gaps. Other sources stay chunk-level,
  // with a per-document cap so one long document can't crowd out the rest.
  const perDoc = new Map<string, number>();
  const hits: SearchHit[] = [];
  for (const { c, score } of scored) {
    const n = perDoc.get(c.docId) || 0;
    const isProcedure = PROCEDURE_TYPES.includes(c.sourceType);
    if (isProcedure ? n >= 1 : n >= MAX_CHUNKS_PER_DOC) continue;
    perDoc.set(c.docId, n + 1);
    const base = {
      docId: c.docId, sourceType: c.sourceType, title: c.title, ref: c.ref,
      machineType: c.machineType, machineCode: c.machineCode, score: Math.round(score * 1000) / 1000,
    };
    hits.push(isProcedure ? { ...base, id: c.docId, section: '', content: fullDocument(c.docId) } : { ...base, id: c.id, section: c.section, content: c.content });
    if (hits.length >= topK) break;
  }
  return { hits, queries, mode };
}

const PROCEDURE_TYPES: SourceType[] = ['SOP', 'LOTO', 'INSPECTION'];

function fullDocument(docId: string): string {
  const parts = chunks
    .filter((c) => c.docId === docId)
    .sort((a, b) => Number(a.id.split('#')[1]) - Number(b.id.split('#')[1]));
  const intro = parts[0]?.content.split('\n\n')[0] || '';
  return [intro, ...parts.map((p) => `## ${p.section}\n${p.content.startsWith(intro) ? p.content.slice(intro.length).trim() : p.content}`)]
    .join('\n\n')
    .slice(0, 4500);
}
