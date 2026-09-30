/**
 * Local ML models for retrieval (run in-process via ONNX, no API key, data stays on-prem):
 * - Embeddings: BGE-small-en-v1.5 (384-d, strong on retrieval benchmarks for its size)
 * - Re-ranker:  MS-MARCO MiniLM cross-encoder (scores query/passage pairs jointly)
 * Weights download once into backend/data/models.
 */
import path from 'path';
import { pipeline, AutoTokenizer, AutoModelForSequenceClassification, env } from '@huggingface/transformers';

env.cacheDir = path.resolve(process.cwd(), 'data', 'models');

const EMBED_MODEL = process.env.ASSISTANT_EMBED_MODEL || 'Xenova/bge-small-en-v1.5';
const RERANK_MODEL = process.env.ASSISTANT_RERANK_MODEL || 'Xenova/ms-marco-MiniLM-L-6-v2';
export const EMBED_DIM = 384;

// BGE retrieval models expect this instruction on queries (not on passages)
const QUERY_INSTRUCTION = 'Represent this sentence for searching relevant passages: ';

let embedderPromise: Promise<any> | null = null;
let rerankerPromise: Promise<{ tokenizer: any; model: any }> | null = null;

function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = pipeline('feature-extraction', EMBED_MODEL, { dtype: 'q8' }).catch((err) => {
      embedderPromise = null;
      throw err;
    });
  }
  return embedderPromise;
}

function getReranker() {
  if (!rerankerPromise) {
    rerankerPromise = Promise.all([
      AutoTokenizer.from_pretrained(RERANK_MODEL),
      AutoModelForSequenceClassification.from_pretrained(RERANK_MODEL, { dtype: 'q8' }),
    ])
      .then(([tokenizer, model]) => ({ tokenizer, model }))
      .catch((err) => {
        rerankerPromise = null;
        throw err;
      });
  }
  return rerankerPromise;
}

async function embed(texts: string[]): Promise<number[][]> {
  const embedder = await getEmbedder();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 16) {
    const batch = texts.slice(i, i + 16);
    const tensor = await embedder(batch, { pooling: 'cls', normalize: true });
    out.push(...(tensor.tolist() as number[][]));
  }
  return out;
}

export function embedPassages(texts: string[]): Promise<number[][]> {
  return embed(texts);
}

export async function embedQuery(query: string): Promise<number[]> {
  const [v] = await embed([QUERY_INSTRUCTION + query]);
  return v;
}

/** Cross-encoder relevance scores (higher = more relevant; roughly > 0 means relevant). */
export async function rerank(query: string, passages: string[]): Promise<number[]> {
  if (passages.length === 0) return [];
  const { tokenizer, model } = await getReranker();
  const scores: number[] = [];
  for (let i = 0; i < passages.length; i += 16) {
    const batch = passages.slice(i, i + 16);
    const inputs = tokenizer(new Array(batch.length).fill(query), {
      text_pair: batch,
      padding: true,
      truncation: true,
      max_length: 512,
    });
    const { logits } = await model(inputs);
    scores.push(...(logits.tolist() as number[][]).map((row) => row[0]));
  }
  return scores;
}

/** Load both models ahead of the first question so users don't wait on a cold start. */
export async function warmUpModels(): Promise<void> {
  const t0 = Date.now();
  await Promise.all([getEmbedder(), getReranker()]);
  console.log(`[Assistant] Local embedding + re-ranker models ready (${Date.now() - t0} ms)`);
}
