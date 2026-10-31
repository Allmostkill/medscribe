import { SpecialtyConfig } from "./config/specialties";

export interface DoctorProfile {
  name: string;
  specialty: SpecialtyConfig;
  experienceYears: number;
  protocolTemplate?: string;
}

export interface TranscriptLine {
  id: string;
  // 'doctor'|'patient' — after AI diarization; 'speaker_N' — голос из разметки полной записи (только после расшифровки; живые строки всегда 'unknown'); 'unknown' — interim
  speaker: string;
  text: string;
  timestamp: Date;
}

export type GuidelineType = 'international' | 'russian';

export interface EHRNote {
  complaints: string;
  anamnesisMorbi: string;
  anamnesisVitae: string;
  allergies: string;
  examination: string;
  diagnoses: string;
  medications: string;
  plan: string;
}

// Памятка пациенту — единственный артефакт продукта, который создаётся не для
// МИС, а для самого пациента (ст. 22 ФЗ-323: информация о состоянии здоровья
// предоставляется в доступной форме). Собирается из УТВЕРЖДЁННОГО врачом
// EHRNote, а не из стенограммы: врач правит поля протокола руками, и памятка
// обязана отражать именно правки, а не то, что услышала модель.
export interface PatientSummary {
  /** Диагноз человеческим языком, 1-2 предложения. Пусто для онко/психиатрии — там формулирует врач. */
  condition: string;
  /** Что решили на приёме. */
  decision: string;
  /** Лечение: препарат — зачем — как принимать — сколько. */
  treatment: string;
  /** Что сделать до следующего визита: анализы, обследования, режим. */
  todo: string;
  /** Когда срочно обратиться. Не генерируется моделью — берётся из redFlags.ts. */
  redFlags: string;
  /** Когда прийти снова. */
  followUp: string;
}
