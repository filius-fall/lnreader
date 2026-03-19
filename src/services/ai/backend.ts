import { getString } from '@strings/translations';
import { AiAskRequest, AiAskResponse, AiIndexRequest } from './types';
import { getMMKVObject } from '@utils/mmkv/mmkv';
import { AI_SETTINGS, AiSettings, initialAiSettings } from '@hooks/persisted/useSettings';

const getAiSettings = () =>
  getMMKVObject<AiSettings>(AI_SETTINGS) || initialAiSettings;

const buildHeaders = (settings: AiSettings) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (settings.apiKey?.trim()) {
    headers.Authorization = `Bearer ${settings.apiKey.trim()}`;
  }
  return headers;
};

const createSignal = (timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
};

async function request<TResponse>(
  path: string,
  body: unknown,
): Promise<TResponse> {
  const settings = getAiSettings();
  if (!settings.baseUrl?.trim()) {
    throw new Error(getString('ai.errors.configureBackend'));
  }
  const { signal, clear } = createSignal(settings.timeoutMs);
  try {
    const response = await fetch(
      `${settings.baseUrl.replace(/\/$/, '')}${path}`,
      {
        method: 'POST',
        headers: buildHeaders(settings),
        body: JSON.stringify(body),
        signal,
      },
    );
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `HTTP ${response.status}`);
    }
    return (await response.json()) as TResponse;
  } finally {
    clear();
  }
}

export const sendAiChunks = async (payload: AiIndexRequest) =>
  request<{ chunkIds?: string[] }>('/index', payload);

export const askAiQuestion = async (payload: AiAskRequest) =>
  request<AiAskResponse>('/ask', payload);
