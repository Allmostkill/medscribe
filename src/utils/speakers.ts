// Разметка по голосу: разбор ответа T-one и сквозная нумерация спикеров.

export type DiarizationStatus = 'ok' | 'single' | 'skipped' | 'off' | 'failed';
export interface SttSegment { start: number; end: number; text: string; speaker?: string }

const STATUSES: readonly string[] = ['ok', 'single', 'skipped', 'off', 'failed'];
const MAX_PHRASES = 5000;
const MAX_TEXT = 2000;

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;

/** Ответ tone:/transcribe → сегменты для клиента. Мусор отбрасывается. */
export function toneToSegments(data: unknown): { segments: SttSegment[]; diarization: DiarizationStatus } {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const diarization: DiarizationStatus =
    typeof d.diarization === 'string' && STATUSES.includes(d.diarization)
      ? (d.diarization as DiarizationStatus) : 'off';
  const phrases = Array.isArray(d.phrases) ? d.phrases.slice(0, MAX_PHRASES) : [];
  const segments: SttSegment[] = [];
  for (const p of phrases) {
    if (!p || typeof p !== 'object') continue;
    const ph = p as Record<string, unknown>;
    const start = num(ph.start);
    const end = num(ph.end);
    if (start === null || end === null) continue;
    if (typeof ph.text !== 'string') continue;
    const text = ph.text.trim().slice(0, MAX_TEXT);
    if (!text) continue;
    const seg: SttSegment = { start, end, text };
    const n = ph.speaker;
    if (diarization === 'ok' && typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 9) {
      seg.speaker = `speaker_${n}`;
    }
    segments.push(seg);
  }
  return { segments, diarization };
}

export const isVoiceLabel = (s: string) => /^speaker_\d+$/.test(s);

/** Сдвигает speaker_N на offset (запись из нескольких сегментов); maxIndex — наибольший номер после сдвига. */
export function offsetSpeakers(segs: SttSegment[], offset: number): { segments: SttSegment[]; maxIndex: number } {
  let maxIndex = offset;
  const segments = segs.map(s => {
    if (!s.speaker || !isVoiceLabel(s.speaker)) return s;
    const idx = Number(s.speaker.slice('speaker_'.length)) + offset;
    if (idx > maxIndex) maxIndex = idx;
    return { ...s, speaker: `speaker_${idx}` };
  });
  return { segments, maxIndex };
}

/**
 * doctor / patient / speaker_N / unknown остаются как есть. Всё невалидное —
 * 'unknown', а не 'doctor': чужую реплику нельзя подписывать «Врач».
 */
export function normalizeLineSpeaker(s: unknown): string {
  if (s === 'doctor' || s === 'patient' || s === 'unknown') return s;
  if (typeof s === 'string' && isVoiceLabel(s)) return s;
  return 'unknown';
}

/** Подпись участника для экрана и текста черновика. */
export function speakerLabel(speaker: string): string {
  if (speaker === 'doctor') return 'Врач';
  if (speaker === 'patient') return 'Пациент';
  if (speaker === 'unknown') return 'Не определён';
  if (isVoiceLabel(speaker)) return `Спикер ${speaker.split('_')[1]}`;
  return speaker;
}

export interface AnalyzeLine { speaker: string; text: string; timestamp: Date | string | number }

/**
 * Склейка кусков потокового STT, которые почти наверняка одна реплика, чтобы
 * диаризатор не разрезал фразу между двумя говорящими.
 *
 * Клеим `cur` с предыдущей строкой, если одновременно: тот же говорящий (оба 'unknown' — только
 * в полностью неразмеченной стенограмме), пауза < 1.5 с, предыдущий текст не закончен точкой/!/?/…
 * Консервативно: ложная склейка вредит меньше ложного разреза.
 */
export function coalesceTranscriptChunks<T extends AnalyzeLine>(lines: T[]): T[] {
  const MAX_GAP_MS = 1500;
  const ENDS_HARD = /[.!?…)»"]\s*$/;
  const out: T[] = [];
  const hasLabelled = lines.some(l => l.speaker !== 'unknown');
  for (const cur of lines) {
    const prev = out[out.length - 1];
    if (!prev) { out.push({ ...cur }); continue; }
    // В частично размеченной стенограмме времена строк условные (шаг 1 с или
    // все одинаковые): склейка двух 'unknown' слила бы вопрос врача с ответом пациента.
    const sameSpeaker = prev.speaker === cur.speaker && (cur.speaker !== 'unknown' || !hasLabelled);
    const gapMs = new Date(cur.timestamp).getTime() - new Date(prev.timestamp).getTime();
    const prevEndsHard = ENDS_HARD.test(prev.text.trimEnd());
    if (sameSpeaker && gapMs >= 0 && gapMs < MAX_GAP_MS && !prevEndsHard) {
      out[out.length - 1] = {
        ...prev,
        text: (prev.text.trimEnd() + ' ' + cur.text.trimStart()).replace(/\s+/g, ' ').trim(),
      };
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/** Строки стенограммы → текст для /api/ai/analyze: «[метка] реплика», метка 'unknown' передаётся как есть. */
export function toAnalyzeText(lines: AnalyzeLine[]): string {
  return coalesceTranscriptChunks(lines).map(t => {
    // Текст реплики — одна строка и не начинается с «[»: иначе он подделает метку
    const text = t.text.replace(/[\r\n]+/g, ' ').trimStart();
    return `[${t.speaker}] ${text.startsWith('[') ? ` ${text}` : text}`;
  }).join("\n");
}

export interface SessionPart { segments: SttSegment[]; diarization?: DiarizationStatus; durationSec: number }

/**
 * Склейка сегментов записи (по 20 минут) в одну стенограмму: время сдвигается
 * сквозь всю запись, голоса нумеруются сквозь сегменты. Сегмент со статусом
 * 'single' (там звучал один голос), когда в другом сегменте голоса разделены,
 * получает свой новый номер: иначе он «приклеился» бы к чужому голосу как
 * 'unknown'. Без единого 'ok' меток нет вообще. 'failed' и 'skipped' остаются
 * без меток ('unknown') — это известный пробел.
 */
export function mergeSessionSegments(parts: SessionPart[]): { segments: SttSegment[]; diarization?: DiarizationStatus } {
  const anyOk = parts.some(p => p.diarization === 'ok');
  const out: SttSegment[] = [];
  let timeOffset = 0;
  let speakerOffset = 0;
  for (const p of parts) {
    let segs: SttSegment[];
    if (p.diarization === 'ok') {
      const shifted = offsetSpeakers(p.segments, speakerOffset);
      speakerOffset = shifted.maxIndex;
      segs = shifted.segments;
    } else if (p.diarization === 'single' && anyOk && p.segments.length > 0) {
      speakerOffset += 1;
      segs = p.segments.map(s => ({ ...s, speaker: `speaker_${speakerOffset}` }));
    } else {
      segs = p.segments.map(({ speaker: _s, ...rest }) => rest);
    }
    for (const s of segs) {
      out.push({ ...s, start: s.start + timeOffset, end: s.end + timeOffset });
    }
    timeOffset += p.durationSec;
  }
  const statuses = parts.map(p => p.diarization).filter((d): d is DiarizationStatus => !!d);
  return { segments: out, diarization: statuses.find(d => d === 'ok') ?? statuses[0] };
}
