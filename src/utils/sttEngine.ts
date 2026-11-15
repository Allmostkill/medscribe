// Выбор модели распознавания речи: чистая логика (без сети и базы).

export type SttEngine = 'tone' | 'gigaam';
export type GigaamState = 'absent' | 'downloading' | 'verifying' | 'loading' | 'ready' | 'failed' | 'unknown';
export type GigaamErrorCode = 'network' | 'checksum' | 'disk_space' | 'load' | 'unknown';

const STATES: readonly string[] = ['absent', 'downloading', 'verifying', 'loading', 'ready', 'failed'];
const ERROR_CODES: readonly string[] = ['network', 'checksum', 'disk_space', 'load', 'unknown'];

export const isSttEngine = (v: unknown): v is SttEngine => v === 'tone' || v === 'gigaam';

/** Что реально будет работать: GigaAM только если выбран и модель готова, иначе T-one. */
export function effectiveEngine(selected: SttEngine, state: GigaamState): SttEngine {
  return selected === 'gigaam' && state === 'ready' ? 'gigaam' : 'tone';
}

export interface ToneEngines {
  toneReady: boolean;
  gigaam: { state: GigaamState; downloadedBytes: number; totalBytes: number; errorCode: GigaamErrorCode | null };
}

const bytes = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;

/** Ответ tone:/engines → проверенная структура. Мусор и недоступность → state unknown. */
export function parseToneEngines(json: unknown): ToneEngines {
  const d = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const tone = (d.tone && typeof d.tone === 'object' ? d.tone : {}) as Record<string, unknown>;
  const g = d.gigaam && typeof d.gigaam === 'object' ? d.gigaam as Record<string, unknown> : null;
  const state: GigaamState = g && typeof g.state === 'string' && STATES.includes(g.state)
    ? (g.state as GigaamState) : 'unknown';
  const errorCode = state === 'failed'
    ? (typeof g?.error === 'string' && ERROR_CODES.includes(g.error) ? (g.error as GigaamErrorCode) : 'unknown')
    : null;
  return {
    toneReady: tone.ready === true,
    gigaam: { state, downloadedBytes: bytes(g?.downloaded_bytes), totalBytes: bytes(g?.total_bytes), errorCode },
  };
}

const ERROR_MESSAGES: Record<GigaamErrorCode, string> = {
  network: 'Не удалось скачать модель: нет связи с HuggingFace. Если он недоступен из вашей сети, укажите зеркало HF_ENDPOINT (инструкция, раздел 4.1) и нажмите «Повторить».',
  checksum: 'Файл модели пришёл повреждённым (не совпала контрольная сумма). Нажмите «Повторить».',
  disk_space: 'Не хватает места на диске: нужно около 300 МБ свободных.',
  load: 'Модель скачана, но не запустилась (возможно, не хватает памяти). Расшифровка идёт через T-one.',
  unknown: 'Не удалось подготовить модель. Нажмите «Повторить».',
};

export function gigaamErrorMessage(code: string | null | undefined): string {
  return ERROR_MESSAGES[(code && ERROR_CODES.includes(code) ? code : 'unknown') as GigaamErrorCode];
}

/** Причина, по которой tone не взял выбранную модель (только проверенные значения). */
export type EngineFallback = 'not_ready' | 'error';
export const parseEngineFallback = (v: unknown): EngineFallback | null =>
  v === 'not_ready' || v === 'error' ? v : null;
