import { EHRNote } from "../types";
import { getStoredSession } from "./auth";

export interface ClinicalHint {
  text: string;
  severity: 'low' | 'medium' | 'high';
}

export interface AIResult<T> {
  data: T;
  error?: string;
}

export interface DiagnosisSuggestion {
  code: string;
}

function getAuthHeaders() {
  const token = getStoredSession()?.token;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function generateClinicalHints(
  transcript: string,
  specialty: string,
  patientContext: string,
  // Контекст из МИС (см. analyzeConsultation): подсказки замечают расхождения
  // с прошлым визитом — отменённый препарат, забытая аллергия.
  priorContext = ''
): Promise<AIResult<ClinicalHint[]>> {
  if (!transcript || transcript.length < 50) return { data: [] };
  try {
    const res = await fetch("/api/ai/hints", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ transcript, specialty, patientContext, priorContext })
    });
    const json = await res.json();
    if (!res.ok) return { data: [], error: json.error || `Ошибка сервера ${res.status}` };
    const hints = (json.hints || []).map((h: string | ClinicalHint) =>
      typeof h === 'string' ? { text: h, severity: 'low' as const } : h
    );
    return { data: hints };
  } catch (error: any) {
    console.error("[AI] hints failed:", error);
    return { data: [], error: 'Нет связи с сервером' };
  }
}

/** Пункт разбора общения: как сказать иначе или что осталось непроговорённым. */
export interface CommunicationNote {
  kind: 'phrasing' | 'gap';
  speaker: 'doctor' | 'patient';
  /** Дословная реплика из стенограммы. Сервер проверяет, что она там есть. */
  quote: string;
  /** Другой вариант той же мысли — только у kind "phrasing". */
  alternative?: string;
  why: string;
  /** Протокол общения, на который опирается подсказка: SPIKES, NURSE, МИ… */
  protocol: string;
}

export async function requestCommunicationReview(
  transcript: string,
  specialty: string,
): Promise<AIResult<CommunicationNote[]>> {
  // Разбирать нечего, пока разговор не начался. Порог тот же, что у подсказок.
  if (!transcript || transcript.length < 50) return { data: [] };
  try {
    const res = await fetch("/api/ai/communication", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ transcript, specialty }),
    });
    const json = await res.json();
    if (!res.ok) return { data: [], error: json.error || `Ошибка сервера ${res.status}` };
    return { data: json.notes || [] };
  } catch (error: any) {
    console.error("[AI] communication review failed:", error);
    return { data: [], error: 'Нет связи с сервером' };
  }
}

export async function generatePharmaAnalysis(
  transcript: string,
  specialtyConfig: import('../config/specialties').SpecialtyConfig
): Promise<AIResult<string[]>> {
  if (!transcript || transcript.length < 50) return { data: [] };
  try {
    const res = await fetch("/api/ai/pharma", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ transcript, specialtyConfig })
    });
    const json = await res.json();
    if (!res.ok) return { data: [], error: json.error || `Ошибка сервера ${res.status}` };
    return { data: json.hints || [] };
  } catch (error: any) {
    console.error("[AI] pharma failed:", error);
    return { data: [], error: 'Нет связи с сервером' };
  }
}

// Порог выше, чем у hints/pharma (50 символов) — предположение диагноза по
// паре реплик шумнее, чем общая клиническая подсказка.
export async function generateDiagnosisSuggestions(
  transcript: string,
  specialty: import('../config/specialties').SpecialtyConfig
): Promise<AIResult<DiagnosisSuggestion[]>> {
  if (!transcript || transcript.length < 150) return { data: [] };
  try {
    const res = await fetch("/api/ai/suggest-diagnosis", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ transcript, specialtyId: specialty.id, specialtyName: specialty.name })
    });
    const json = await res.json();
    if (!res.ok) return { data: [], error: json.error || `Ошибка сервера ${res.status}` };
    return { data: json.suggestions || [] };
  } catch (error: any) {
    console.error("[AI] suggest-diagnosis failed:", error);
    return { data: [], error: 'Нет связи с сервером' };
  }
}

export async function analyzeConsultation(
  transcript: string,
  specialty: string,
  patientContext: string,
  guideline: import('../types').GuidelineType = 'international',
  consultationType: 'primary' | 'follow-up' = 'primary',
  // Шаблон назначений, выбранный врачом в блоке «Шаблоны назначений». Если
  // передан, сервер строит по нему поля medications/plan протокола, подставляя
  // в пункты шаблона данные приёма (см. /api/ai/analyze).
  prescriptionTemplate: { title: string; body: string } | null = null,
  // Дистанционный приём (запись звука вкладки — онлайн-приём): осмотра не было, и сервер запрещает
  // модели его выдумывать в examination.
  remote = false,
  // Контекст из МИС: предыдущий протокол/выписка, вставленные врачом перед
  // приёмом. Нигде не хранится — живёт в состоянии приёма и в одном запросе;
  // сервер подаёт его модели как фон (анамнез, терапия), а не как сегодняшний приём.
  priorContext = '',
  // Стенограмма уже размечена по голосу (метки speaker_N заменены на doctor/patient):
  // сервер остаётся в режиме «по голосу» и не даёт модели переписывать текст.
  voiceLabelled = false
): Promise<AIResult<{ ehr: EHRNote, diarizedTranscript: { speaker: string, text: string }[], protocolTemplateUsed?: boolean, priorContextUsed?: boolean, diarizationSource?: 'voice' | 'llm' } | null>> {
  try {
    const res = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ transcript, specialty, patientContext, guideline, consultationType, prescriptionTemplate, remote, priorContext, voiceLabelled })
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || `Ошибка сервера ${res.status}` };
    return { data: json.result || null };
  } catch (error: any) {
    console.error("[AI] analyze failed:", error);
    return { data: null, error: 'Нет связи с сервером' };
  }
}

// ── Сверка протокола со стенограммой ────────────────────────────────────
// Отдельный проход после analyze: проверяющий не должен быть тем же, кто писал.
export interface NoteOmission {
  category: 'allergy' | 'medication' | 'diagnosis' | 'timing' | 'other';
  /** Поле протокола, куда это должно было попасть. */
  field: keyof EHRNote;
  /** Дословная реплика; сервер проверяет, что она есть в стенограмме. */
  quote: string;
  why: string;
  /** Короткая формулировка для протокола — врач добавляет её одной кнопкой. */
  suggestion: string;
}

export interface NoteCheck {
  /** Подтверждённые цитаты под каждое поле (пустой список — опоры нет). */
  sources: Record<string, string[]>;
  /** Цитаты из контекста «Из МИС» — поле стоит на прошлом протоколе, не на разговоре. */
  priorSources: Record<string, string[]>;
  /** Поля с текстом, но без единой подтверждённой цитаты. */
  unsupported: string[];
  omissions: NoteOmission[];
  /** Дистанционный приём, а в осмотре — то, что руками через видео не сделать. */
  remoteExam: boolean;
}

export async function checkNote(
  transcript: string,
  ehr: EHRNote,
  specialty: string,
  remote: boolean,
  priorContext = '',
): Promise<AIResult<NoteCheck | null>> {
  try {
    const res = await fetch("/api/ai/note-check", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ transcript, ehr, specialty, remote, priorContext })
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || `Ошибка сервера ${res.status}` };
    return { data: { sources: json.sources ?? {}, priorSources: json.priorSources ?? {}, unsupported: json.unsupported ?? [], omissions: json.omissions ?? [], remoteExam: !!json.remoteExam } };
  } catch (error: any) {
    console.error("[AI] note-check failed:", error);
    return { data: null, error: 'Нет связи с сервером' };
  }
}

/**
 * Памятка пациенту из утверждённого протокола.
 *
 * `redFlags` приходит из курируемого справочника (config/redFlags.ts) и
 * возвращается сервером дословно — модель этот раздел не пишет и не видит.
 * `doctorMustWriteCondition` — онко/психиатрия: диагноз формулирует врач сам
 * (ст. 22 ФЗ-323 о деликатной форме при неблагоприятном прогнозе).
 */
export async function generatePatientSummary(
  ehr: EHRNote,
  specialty: string,
  redFlags: string[],
  doctorMustWriteCondition: boolean,
): Promise<AIResult<import('../types').PatientSummary | null>> {
  try {
    const res = await fetch("/api/ai/patient-summary", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ ehr, specialty, redFlags, doctorMustWriteCondition })
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: json.error || `Ошибка сервера ${res.status}` };
    return { data: json.summary || null };
  } catch (error: any) {
    console.error("[AI] patient-summary failed:", error);
    return { data: null, error: 'Нет связи с сервером' };
  }
}
