/**
 * Minimal Groq (OpenAI-compatible) chat client with streaming + native tool calling.
 */

export const AGENT_MODEL = process.env.ASSISTANT_MODEL || 'openai/gpt-oss-120b';
export const FAST_MODEL = process.env.ASSISTANT_FAST_MODEL || 'openai/gpt-oss-20b';
// Independent model for fact-checking answers (a different model family catches different mistakes)
export const JUDGE_MODEL = process.env.ASSISTANT_JUDGE_MODEL || 'qwen/qwen3.8-27b';
// Each Groq model has its own tokens-per-minute budget; on a rate limit we move down this chain
const FALLBACK_MODELS = (process.env.ASSISTANT_FALLBACK_MODELS || 'qwen/qwen3.8-27b,openai/gpt-oss-20b')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolSpec {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, any> };
}

export interface ChatOptions {
  model?: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  toolChoice?: 'auto' | 'none' | 'required';
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  jsonMode?: boolean;
  signal?: AbortSignal;
  /** Allow switching to fallback models when the primary is rate-limited (default true). */
  allowFallback?: boolean;
  /** Called when a request is delayed or rerouted because of rate limits. */
  onRetry?: (info: { model: string; waitSeconds: number; switchedTo?: string }) => void;
}

export class RateLimitError extends Error {
  constructor(message: string, public waitSeconds: number) {
    super(message);
  }
}

export interface ChatResult {
  content: string;
  reasoning: string;
  toolCalls: ToolCall[];
  finishReason: string | null;
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  model: string; // model that actually served the request (may be a fallback)
}

export function isLLMConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

function buildBody(opts: ChatOptions, stream: boolean) {
  const body: Record<string, any> = {
    model: opts.model || AGENT_MODEL,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.2,
    stream,
  };
  if (opts.maxTokens) body.max_completion_tokens = opts.maxTokens;
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = opts.toolChoice || 'auto';
  }
  const model = body.model as string;
  if (model.startsWith('openai/gpt-oss')) {
    if (opts.reasoningEffort) body.reasoning_effort = opts.reasoningEffort;
  } else if (model.startsWith('qwen/')) {
    // Keep chain-of-thought out of the answer text
    body.reasoning_format = 'parsed';
  }
  if (opts.jsonMode) body.response_format = { type: 'json_object' };
  return body;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); }, { once: true });
  });

async function postOnce(body: Record<string, any>, signal?: AbortSignal): Promise<Response> {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not configured');
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (res.ok) return res;
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text)?.error?.message || text;
    } catch {}
    if (res.status === 429) {
      const hinted = Number(res.headers.get('retry-after')) || Number(message.match(/try again in ([\d.]+)s/i)?.[1]);
      throw new RateLimitError(`Groq rate limit on ${body.model}: ${message.slice(0, 200)}`, Number.isFinite(hinted) && hinted > 0 ? hinted : 5);
    }
    if (res.status >= 500 && attempt < 2) {
      await sleep(1000 * (attempt + 1), signal);
      continue;
    }
    throw new Error(`Groq ${res.status}: ${message.slice(0, 400)}`);
  }
}

/**
 * Sends the request, routing around per-model rate limits: short waits are absorbed on the same
 * model, longer ones switch to the next model in the fallback chain, and if every model is
 * limited we wait for the shortest reset (max 3 rounds).
 */
async function post(opts: ChatOptions, stream: boolean): Promise<{ res: Response; model: string }> {
  const primary = opts.model || AGENT_MODEL;
  const chain = opts.allowFallback === false ? [primary] : [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
  for (let round = 0; round < 3; round++) {
    let shortestWait = Infinity;
    for (let i = 0; i < chain.length; i++) {
      const model = chain[i];
      try {
        return { res: await postOnce(buildBody({ ...opts, model }, stream), opts.signal), model };
      } catch (err) {
        if (!(err instanceof RateLimitError)) throw err;
        shortestWait = Math.min(shortestWait, err.waitSeconds);
        if (err.waitSeconds <= 2.5) {
          opts.onRetry?.({ model, waitSeconds: err.waitSeconds });
          await sleep(err.waitSeconds * 1000 + 200, opts.signal);
          try {
            return { res: await postOnce(buildBody({ ...opts, model }, stream), opts.signal), model };
          } catch (retryErr) {
            if (!(retryErr instanceof RateLimitError)) throw retryErr;
          }
        }
        if (i + 1 < chain.length) opts.onRetry?.({ model, waitSeconds: err.waitSeconds, switchedTo: chain[i + 1] });
      }
    }
    const wait = Math.min(20, Number.isFinite(shortestWait) ? shortestWait : 5);
    opts.onRetry?.({ model: primary, waitSeconds: wait });
    await sleep(wait * 1000 + 250, opts.signal);
  }
  throw new Error('The AI service is busy (rate limit). Please try again in a minute.');
}

/** Streaming completion. Content and reasoning deltas are forwarded as they arrive. */
export async function chatStream(
  opts: ChatOptions,
  onDelta?: (d: { content?: string; reasoning?: string }) => void
): Promise<ChatResult> {
  const { res, model } = await post(opts, true);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let reasoning = '';
  let finishReason: string | null = null;
  let usage: ChatResult['usage'] = {};
  const calls: Record<number, ToolCall> = {};

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      let chunk: any;
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }
      if (chunk.error) throw new Error(`Groq stream error: ${chunk.error.message || JSON.stringify(chunk.error)}`);
      const choice = chunk.choices?.[0];
      const delta = choice?.delta || {};
      if (delta.content) {
        content += delta.content;
        onDelta?.({ content: delta.content });
      }
      if (delta.reasoning) {
        reasoning += delta.reasoning;
        onDelta?.({ reasoning: delta.reasoning });
      }
      for (const tc of delta.tool_calls || []) {
        const idx = tc.index ?? 0;
        const cur = (calls[idx] ||= { id: tc.id || `call_${idx}`, type: 'function', function: { name: '', arguments: '' } });
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.function.name += tc.function.name;
        if (tc.function?.arguments) cur.function.arguments += tc.function.arguments;
      }
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      const u = chunk.x_groq?.usage || chunk.usage;
      if (u) usage = u;
    }
  }

  return { content, reasoning, toolCalls: Object.values(calls), finishReason, usage, model };
}

/** Non-streaming completion returning parsed JSON (for planners, judges, query rewriting). */
export async function chatJson<T = any>(opts: ChatOptions): Promise<T> {
  const { res } = await post({ ...opts, jsonMode: true }, false);
  const json: any = await res.json();
  const text: string = json.choices?.[0]?.message?.content || '';
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error('Model did not return valid JSON');
  }
}
