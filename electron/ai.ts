import type { WebContents } from 'electron';
import type { AIChatMessage, AISecretStatus, AurenSettings } from '../shared/types';

interface AIConfig {
  provider: AurenSettings['aiProvider'];
  model: string;
  baseUrl: string;
  systemPrompt: string;
}

interface AIRequestInternal {
  requestId: string;
  messages: AIChatMessage[];
}

const activeRequests = new Map<string, AbortController>();

function endpointForOpenAI(baseUrl: string): string {
  const base = (baseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/.test(base)) return base;
  if (/\/v1$/.test(base)) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

function systemAndMessages(messages: AIChatMessage[], systemPrompt: string) {
  const system = [systemPrompt.trim(), ...messages.filter((m) => m.role === 'system').map((m) => m.content)].filter(Boolean).join('\n\n');
  const rest = messages.filter((m) => m.role !== 'system');
  return { system, rest };
}

async function* sseLines(response: Response): AsyncGenerator<string> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() || '';
      for (const line of parts) yield line.replace(/\r$/, '');
    }
    if (buffer) yield buffer;
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
}

async function readError(response: Response): Promise<string> {
  let detail = '';
  try {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      detail = json.error?.message || json.error?.type || json.message || text.slice(0, 400);
    } catch {
      detail = text.slice(0, 400);
    }
  } catch { /* ignore */ }
  return `${response.status} ${response.statusText}${detail ? ` — ${detail}` : ''}`;
}

export class AIService {
  constructor(private getConfig: () => AIConfig, private getApiKey: (provider: string) => string) {}

  cancel(requestId: string) {
    activeRequests.get(requestId)?.abort();
    activeRequests.delete(requestId);
  }

  async chat(request: AIRequestInternal, webContents: WebContents): Promise<{ text: string }> {
    const config = this.getConfig();
    if (config.provider === 'gemini') return this.gemini(request, config, webContents);
    if (config.provider === 'anthropic') return this.anthropic(request, config, webContents);
    return this.openai(request, config, webContents);
  }

  private emit(webContents: WebContents, requestId: string, chunk: string) {
    if (!webContents.isDestroyed()) webContents.send('ai:chunk', { requestId, chunk });
  }

  private async openai(request: AIRequestInternal, config: AIConfig, webContents: WebContents) {
    const key = this.getApiKey('openai') || this.getApiKey('custom');
    if (!key) throw new Error('No API key is configured for the OpenAI-compatible provider.');
    const controller = new AbortController();
    activeRequests.set(request.requestId, controller);
    const { system, rest } = systemAndMessages(request.messages, config.systemPrompt);
    const messages = system ? [{ role: 'system', content: system }, ...rest] : rest;
    try {
      const response = await fetch(endpointForOpenAI(config.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({ model: config.model, messages, stream: true, temperature: 0.7 }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`AI provider error: ${await readError(response)}`);
      let full = '';
      for await (const line of sseLines(response)) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta?.content || json.choices?.[0]?.text || '';
          if (delta) { full += delta; this.emit(webContents, request.requestId, delta); }
        } catch { /* ignore malformed keepalive */ }
      }
      if (!full) {
        const text = await response.clone().text().catch(() => '');
        throw new Error(text ? 'The AI provider returned no generated text.' : 'The AI provider returned an empty response.');
      }
      return { text: full };
    } finally {
      activeRequests.delete(request.requestId);
    }
  }

  private async anthropic(request: AIRequestInternal, config: AIConfig, webContents: WebContents) {
    const key = this.getApiKey('anthropic');
    if (!key) throw new Error('No API key is configured for Anthropic.');
    const controller = new AbortController();
    activeRequests.set(request.requestId, controller);
    const { system, rest } = systemAndMessages(request.messages, config.systemPrompt);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 4096,
          system: system || undefined,
          messages: rest.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
          stream: true
        }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Anthropic error: ${await readError(response)}`);
      let full = '';
      for await (const line of sseLines(response)) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        try {
          const json = JSON.parse(data);
          if (json.type === 'content_block_delta' && json.delta?.text) {
            full += json.delta.text;
            this.emit(webContents, request.requestId, json.delta.text);
          }
        } catch { /* ignore */ }
      }
      if (!full) throw new Error('Anthropic returned an empty response.');
      return { text: full };
    } finally {
      activeRequests.delete(request.requestId);
    }
  }

  private async gemini(request: AIRequestInternal, config: AIConfig, webContents: WebContents) {
    const key = this.getApiKey('gemini');
    if (!key) throw new Error('No API key is configured for Google Gemini.');
    const controller = new AbortController();
    activeRequests.set(request.requestId, controller);
    const { system, rest } = systemAndMessages(request.messages, config.systemPrompt);
    const contents = rest.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model || 'gemini-2.0-flash')}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
        }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Google AI error: ${await readError(response)}`);
      let full = '';
      for await (const line of sseLines(response)) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        try {
          const json = JSON.parse(data);
          const text = json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
          if (text) { full += text; this.emit(webContents, request.requestId, text); }
        } catch { /* ignore */ }
      }
      if (!full) throw new Error('Google AI returned an empty response.');
      return { text: full };
    } finally {
      activeRequests.delete(request.requestId);
    }
  }

  async test(config: AIConfig, key: string): Promise<{ ok: boolean; message: string }> {
    if (!key) return { ok: false, message: 'No API key configured.' };
    try {
      if (config.provider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: config.model, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with: AUREN ready' }] })
        });
        if (!res.ok) return { ok: false, message: await readError(res) };
        return { ok: true, message: 'Connection successful.' };
      }
      if (config.provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model || 'gemini-2.0-flash')}:generateContent?key=${encodeURIComponent(key)}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with: AUREN ready' }] }], generationConfig: { maxOutputTokens: 8 } })
        });
        if (!res.ok) return { ok: false, message: await readError(res) };
        return { ok: true, message: 'Connection successful.' };
      }
      const res = await fetch(endpointForOpenAI(config.baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: config.model, messages: [{ role: 'user', content: 'Reply with: AUREN ready' }], max_tokens: 8 })
      });
      if (!res.ok) return { ok: false, message: await readError(res) };
      return { ok: true, message: 'Connection successful.' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Connection failed.' };
    }
  }
}

export function secretStatus(provider: string, hasSecret: (p: string) => boolean, encryptionAvailable: boolean): AISecretStatus {
  return { configured: hasSecret(provider), provider, encryptionAvailable };
}
