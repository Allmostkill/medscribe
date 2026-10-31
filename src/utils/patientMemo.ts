import type { PatientSummary } from "../types";

export const MEMO_SECTIONS: { key: keyof PatientSummary; label: string }[] = [
  { key: 'condition', label: 'Что у вас' },
  { key: 'decision', label: 'Что мы решили сегодня' },
  { key: 'treatment', label: 'Лечение' },
  { key: 'todo', label: 'Что сделать до следующего визита' },
  { key: 'redFlags', label: 'Когда обратиться срочно' },
  { key: 'followUp', label: 'Когда прийти снова' },
];

/**
 * Нужно ли врачу писать раздел «Что у вас» самому.
 *
 * Ст. 22 ФЗ-323: при неблагоприятном прогнозе информация сообщается в
 * деликатной форме, и пациент вправе вообще не хотеть её знать. Автоматически
 * выдать пациенту на бумаге «подозрение на C61» — грубо и юридически
 * небезопасно, поэтому для онкологических (C) и психиатрических (F) диагнозов
 * модель этот раздел не заполняет: что и как сказать, решает врач.
 */
export function needsDoctorWrittenCondition(diagnoses: string, specialtyId: string): boolean {
  if (specialtyId === 'psychiatrist') return true;
  const text = diagnoses || '';

  // Кириллица: «С61» в русской раскладке визуально неотличим от «C61», но это
  // другой символ, и шлюз молча не срабатывал. Нормализуем перед проверкой.
  const normalized = text.replace(/[СF]/g, ch => (ch === 'С' ? 'C' : ch));
  if (/(^|[^A-Za-zА-Яа-я0-9])[CF]\d{2}(\.\d+)?([^0-9]|$)/i.test(normalized)) return true;

  // Кода может не быть вовсе: поле «Диагноз» — свободный текст, который врач
  // правит руками, и «Рак предстательной железы» встречается чаще, чем «C61».
  // Ошибка в сторону срабатывания стоит врачу пары фраз; ошибка в другую
  // сторону печатает пациенту машинную формулировку онкодиагноза.
  return /(рак\b|\bЗНО\b|злокачествен|карцином|сарком|лимфом|лейкоз|меланом|метастаз|бластом|глиом|миелом|онколог)/i.test(text);
}

/** Есть ли в памятке хоть что-то, кроме красных флагов (они подставляются всегда). */
export function isMemoEmpty(summary: PatientSummary): boolean {
  return MEMO_SECTIONS
    .filter(s => s.key !== 'redFlags')
    .every(s => !summary[s.key]?.trim());
}

/**
 * Есть ли что печатать. Отличается от isMemoEmpty тем, что красные флаги
 * считаются содержимым: памятка, где заполнен только раздел «когда обратиться
 * срочно», — валидный документ. Раньше блок печати рендерился по isMemoEmpty,
 * а кнопка «Распечатать» показывалась всегда, и в этом случае из принтера
 * выходил чистый лист (весь остальной интерфейс скрыт @media print).
 */
export function isMemoBlank(summary: PatientSummary): boolean {
  return MEMO_SECTIONS.every(s => !summary[s.key]?.trim());
}

/** Памятка как текст — для копирования в буфер. Пустые разделы опускаются. */
export function memoToText(summary: PatientSummary, doctorName: string, specialtyName: string): string {
  const body = MEMO_SECTIONS
    .filter(s => summary[s.key]?.trim())
    .map(s => `${s.label.toUpperCase()}\n${summary[s.key].trim()}`)
    .join('\n\n');

  return [
    'ПАМЯТКА ПАЦИЕНТУ',
    body,
    `Врач: ${doctorName}, ${specialtyName}`,
    `Дата: ${new Date().toLocaleDateString('ru-RU')}`,
    'Памятка для пациента. Не является медицинским заключением — оригинал протокола в медицинской карте.',
  ].filter(Boolean).join('\n\n');
}
