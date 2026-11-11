/**
 * Чистые проверки ответов модели: цитаты сверяются со стенограммой. Модуль
 * ничего не читает из окружения и не лезет в базу, поэтому его гоняют
 * scripts/check-communication.ts и scripts/check-note-check.ts как есть.
 */

export const COMMUNICATION_PROTOCOLS = ['SPIKES', 'NURSE', 'МИ', 'ask-tell-ask', 'teach-back', 'общее'];

/** Для сверки цитаты: регистр, пунктуация и пробелы значения не имеют. */
export const normalizeQuote = (s: string) =>
  s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Отбор пунктов разбора. Вынесено отдельной функцией, чтобы проверять
 * настоящий код, а не его пересказ: scripts/check-communication.ts
 * скармливает сюда типовые выдумки модели.
 */
export function validateCommunicationNotes(raw: any[], transcript: string) {
  const haystack = normalizeQuote(transcript);
  const notes: any[] = [];
  const dropped: string[] = [];
  for (const n of raw) {
    if (!n || typeof n !== 'object') { dropped.push('не объект'); continue; }
    const quote = String(n.quote ?? '').trim();
    const why = String(n.why ?? '').trim();
    const kind = n.kind === 'gap' ? 'gap' : 'phrasing';
    const alternative = String(n.alternative ?? '').trim();
    if (quote.length < 8 || !why) { dropped.push('нет цитаты или объяснения'); continue; }
    if (!haystack.includes(normalizeQuote(quote))) { dropped.push(`цитаты нет в стенограмме: «${quote.slice(0, 40)}»`); continue; }
    // Пункт про формулировку без альтернативы — это замечание, а его тут
    // быть не должно: смысл слоя в том, чтобы предложить другой вариант.
    if (kind === 'phrasing' && alternative.length < 8) { dropped.push('формулировка без альтернативы'); continue; }
    notes.push({
      kind,
      speaker: n.speaker === 'patient' ? 'patient' : 'doctor',
      quote,
      alternative: kind === 'phrasing' ? alternative : undefined,
      why,
      protocol: COMMUNICATION_PROTOCOLS.includes(n.protocol) ? n.protocol : 'общее',
    });
    if (notes.length >= 5) break;
  }
  return { notes, dropped };
}

export const NOTE_FIELDS = ['complaints', 'anamnesisMorbi', 'anamnesisVitae', 'allergies', 'examination', 'diagnoses', 'medications', 'plan'];
/**
 * Протокол из ответа модели приводится к ровно восьми строковым полям.
 * Модель бывает опускает поле, отдаёт null, массив, объект или число, а клиент
 * зовёт на полях .trim() при рендере — пустая страница. Объекты не теряются
 * (response_format: json_object схему не гарантирует): значения строк и конечных
 * чисел идут текстом через запятую, ключи не выводятся, элементы массива — с новой
 * строки. Не объект (или массив) и протокол, где все 8 полей пусты, → undefined:
 * клиент сочтёт, что протокола нет (иначе запись стёрлась бы при пустом протоколе).
 * Чистая функция: scripts/check-diarization.ts гоняет через неё типовые ответы.
 */
export function normalizeEhr(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const src = raw as Record<string, unknown>;
  // Вложенность глубже трёх уровней отбрасываем: это уже не поле протокола.
  const MAX_DEPTH = 3;
  const flat = (v: unknown, depth: number): string => {
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
    if (depth >= MAX_DEPTH) return '';
    if (Array.isArray(v)) return v.map(x => flat(x, depth + 1)).filter(Boolean).join(', ');
    if (v && typeof v === 'object') {
      return Object.values(v as Record<string, unknown>).map(x => flat(x, depth + 1)).filter(Boolean).join(', ');
    }
    return '';
  };
  const asText = (v: unknown): string => {
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(x => flat(x, 1)).filter(Boolean).join('\n');
    return flat(v, 0);
  };
  const out: Record<string, string> = {};
  for (const f of NOTE_FIELDS) out[f] = asText(src[f]);
  if (NOTE_FIELDS.every(f => out[f].trim() === '')) return undefined;
  return out;
}
export const OMISSION_CATEGORIES = ['allergy', 'medication', 'diagnosis', 'timing', 'other'];
// Находки, которых по видео или телефону получить нельзя — только руками и
// фонендоскопом. Намеренно без температуры, давления и пульса: их пациент
// измеряет дома и называет сам.
export const REMOTE_EXAM_PATTERN = /пальпац|перкус|аускульт|тоны сердца|дыхание (везикулярн|жестк|жёстк|ослаблен|бронхиальн)|хрип|живот мягк|безболезнен|печень (не )?увелич|печень у края|менингеальн|рефлексы|сухожильн|пастозн/i;

/**
 * Отбор результата сверки. Отдельной функцией, чтобы проверять настоящий
 * код: scripts/check-note-check.ts гоняет через неё типовые выдумки.
 */
export function validateNoteCheck(raw: any, transcript: string, ehr: any, remote: boolean, prior = '') {
  const haystack = normalizeQuote(transcript);
  const priorHay = normalizeQuote(prior);
  const inTranscript = (q: string) => normalizeQuote(q).length >= 8 && haystack.includes(normalizeQuote(q));
  // Контекст из МИС — вторая законная опора (хронический диагноз в анамнезе,
  // текущая терапия). Цитаты из него живут отдельно, чтобы врач видел, что
  // поле стоит на прошлом протоколе, а не на сегодняшнем разговоре.
  const inPrior = (q: string) => priorHay.length > 0 && normalizeQuote(q).length >= 8 && priorHay.includes(normalizeQuote(q));
  const sources: any = {};
  const priorSources: any = {};
  const unsupported: string[] = [];
  let rejectedSources = 0;
  for (const f of NOTE_FIELDS) {
    const text = String(ehr?.[f] ?? '').trim();
    const quotes = [
      ...(Array.isArray(raw?.sources?.[f]) ? raw.sources[f] : []),
      ...(Array.isArray(raw?.priorSources?.[f]) ? raw.priorSources[f] : []),
    ];
    const kept: string[] = [];
    const keptPrior: string[] = [];
    for (const q of quotes) {
      const s = String(q ?? '').trim();
      // Куда положить, решает текст, а не модель: цитату из МИС, поданную
      // как стенограмму, просто перекладываем, а не выбрасываем.
      const bucket = inTranscript(s) ? kept : inPrior(s) ? keptPrior : null;
      if (!bucket) { rejectedSources++; continue; }
      // Повтор — по нормализованному тексту: «Давит в груди» и «давит в груди,» — одна цитата.
      if (bucket.length < 3 && !bucket.some(k => normalizeQuote(k) === normalizeQuote(s))) bucket.push(s);
    }
    sources[f] = kept;
    priorSources[f] = keptPrior;
    // Пустому полю опора не нужна.
    if (text && !kept.length && !keptPrior.length) unsupported.push(f);
  }
  const noteText = normalizeQuote(NOTE_FIELDS.map(f => String(ehr?.[f] ?? '')).join('\n'));
  const omissions: any[] = [];
  const dropped: string[] = [];
  for (const o of Array.isArray(raw?.omissions) ? raw.omissions : []) {
    if (!o || typeof o !== 'object') { dropped.push('не объект'); continue; }
    const quote = String(o.quote ?? '').trim();
    const why = String(o.why ?? '').trim();
    const suggestion = String(o.suggestion ?? '').trim();
    if (!inTranscript(quote)) { dropped.push(`цитаты нет в стенограмме: «${quote.slice(0, 40)}»`); continue; }
    if (!why || suggestion.length < 4) { dropped.push('пропуск без объяснения или формулировки'); continue; }
    // Формулировка, которая уже есть в протоколе дословно, — не пропуск.
    if (noteText.includes(normalizeQuote(suggestion))) { dropped.push(`уже в протоколе: «${suggestion.slice(0, 40)}»`); continue; }
    if (!NOTE_FIELDS.includes(o.field)) { dropped.push(`неизвестное поле «${String(o.field).slice(0, 20)}»`); continue; }
    omissions.push({
      category: OMISSION_CATEGORIES.includes(o.category) ? o.category : 'other',
      field: o.field, quote, why, suggestion,
    });
    if (omissions.length >= 6) break;
  }
  const remoteExam = remote && REMOTE_EXAM_PATTERN.test(String(ehr?.examination ?? ''));
  return { sources, priorSources, unsupported, omissions, remoteExam, dropped, rejectedSources };
}

export type SpeakerRole = 'doctor' | 'patient' | 'other';
const SPEAKER_ROLES: SpeakerRole[] = ['doctor', 'patient', 'other'];

/** Метки голоса [speaker_N] из стенограммы режима «по голосу», в порядке появления. */
export function detectVoiceLabels(transcript: string): string[] {
  const labels: string[] = [];
  for (const m of String(transcript ?? '').matchAll(/^\[(speaker_\d+)\]/gm)) {
    if (!labels.includes(m[1])) labels.push(m[1]);
  }
  return labels;
}

/**
 * Роли по меткам из ответа модели. Невалидное игнорируется, метка без роли —
 * «other». ok — когда есть врач и кто-то ещё: иначе роли негодные, и на экране
 * остаются «Спикер N».
 */
export function resolveSpeakerRoles(raw: unknown, labels: string[]): { roles: Record<string, SpeakerRole>; ok: boolean } {
  const src = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const roles: Record<string, SpeakerRole> = {};
  for (const l of labels) {
    const v = Object.prototype.hasOwnProperty.call(src, l) ? src[l] : undefined;
    roles[l] = SPEAKER_ROLES.includes(v as SpeakerRole) ? v as SpeakerRole : 'other';
  }
  const vals = Object.values(roles);
  return { roles, ok: vals.includes('doctor') && vals.some(r => r !== 'doctor') };
}

const LABEL_LINE = /^\[(speaker_\d+|doctor|patient|unknown)\]/;
const FIXED_LINE = /^\[(speaker_\d+|doctor|patient)\]/m;

/**
 * Включать ли режим «по голосу». Клиент мог пометить стенограмму флагом
 * (она уже размечена по голосу, но speaker_N в ней заменены на doctor/patient)
 * или в ней сами метки двух и более голосов. Любая другая строка в скобках
 * («[шум]», «[Врач]») — не наша метка: тогда старый путь, чтобы текст пациента
 * не мог подделать разметку.
 */
export function shouldUseVoiceMode(transcript: string, flag: unknown): boolean {
  const text = String(transcript ?? '');
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('[') && !LABEL_LINE.test(line)) return false;
  }
  if (flag === true) return FIXED_LINE.test(text);
  return detectVoiceLabels(text).length >= 2;
}

/**
 * Строки стенограммы для экрана: текст берётся из запроса как есть (модель его
 * не правит), от модели — только роли меток speaker_N. Строки [doctor]/[patient]
 * (ручная реплика врача, уже определённые роли) — отдельные реплики с этой
 * ролью. [unknown] (сегмент записи без разметки по голосу) остаётся отдельной
 * репликой 'unknown': по соседству роль не выводится, с известным участником
 * такие строки не склеиваются. Строка без метки — продолжение предыдущей
 * реплики; в самом начале (предыдущей нет) она образует реплику 'unknown'.
 * Соседние реплики одного известного участника склеиваются.
 */
export function buildVoiceDiarizedTranscript(transcript: string, rawRoles: unknown) {
  const labels = detectVoiceLabels(transcript);
  const { roles, ok } = resolveSpeakerRoles(rawRoles, labels);
  const turns: { label: string; text: string }[] = [];
  for (const line of String(transcript ?? '').split(/\r?\n/)) {
    const m = line.match(/^\[(speaker_\d+|doctor|patient|unknown)\]\s*(.*)$/);
    const text = (m ? m[2] : line).trim();
    if (m) { turns.push({ label: m[1], text }); continue; }
    if (!text) continue;
    const last = turns[turns.length - 1];
    if (last) last.text = last.text ? `${last.text} ${text}` : text;
    else turns.push({ label: 'unknown', text });
  }
  const lines: { speaker: string; text: string }[] = [];
  for (const t of turns) {
    if (!t.text) continue;
    if (t.label === 'unknown') { lines.push({ speaker: 'unknown', text: t.text }); continue; }
    const role = roles[t.label];
    const speaker = t.label === 'doctor' || t.label === 'patient' ? t.label
      : !ok ? t.label : role === 'doctor' ? 'doctor' : role === 'patient' ? 'patient' : t.label;
    const prev = lines[lines.length - 1];
    if (prev && prev.speaker === speaker) prev.text += ` ${t.text}`;
    else lines.push({ speaker, text: t.text });
  }
  return { lines, rolesOk: ok, labels };
}

/**
 * Доля исходной стенограммы, ниже которой разбор моделью по ролям не берём.
 * Очный приём: реплики должны покрыть почти весь текст, 0.6 оставляет запас
 * на чистку слов-паразитов. Дистанционный: модели велено убирать дубли эха
 * связи, поэтому текста законно меньше — порог 0.4.
 */
export const DIARIZED_MIN_RATIO = 0.6;
export const DIARIZED_MIN_RATIO_REMOTE = 0.4;
/** Короче этого исходника доли не считаем — проверяем только непустоту. */
const DIARIZED_MIN_SOURCE_LEN = 40;

/**
 * Разбор diarizedTranscript из ответа локальной модели: пустые реплики и
 * не-массив отбрасываются, а если реплики покрывают слишком малую часть
 * исходника — результат отклоняется целиком (клиент оставит живую стенограмму).
 */
export function sanitizeLlmDiarized(raw: unknown, transcript: string, remote: boolean): {
  lines: { speaker: string; text: string }[];
  rejected: null | 'not_array' | 'empty' | 'too_short';
  ratio: number;
} {
  if (!Array.isArray(raw)) return { lines: [], rejected: 'not_array', ratio: 0 };
  const lines: { speaker: string; text: string }[] = [];
  for (const it of raw) {
    const text = typeof it?.text === 'string' ? it.text.trim() : '';
    if (!text) continue;
    lines.push({ speaker: typeof it.speaker === 'string' ? it.speaker : 'unknown', text });
  }
  if (lines.length === 0) return { lines: [], rejected: 'empty', ratio: 0 };
  const srcLen = normalizeQuote(String(transcript ?? '').replace(/\[[^\]]*\]/g, ' ')).length;
  if (srcLen < DIARIZED_MIN_SOURCE_LEN) return { lines, rejected: null, ratio: 1 };
  const ratio = lines.reduce((n, l) => n + normalizeQuote(l.text).length, 0) / srcLen;
  if (ratio < (remote ? DIARIZED_MIN_RATIO_REMOTE : DIARIZED_MIN_RATIO)) return { lines: [], rejected: 'too_short', ratio };
  return { lines, rejected: null, ratio };
}
