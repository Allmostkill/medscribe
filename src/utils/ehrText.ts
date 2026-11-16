import type { EHRNote } from '../types';

/** Разделы протокола в том порядке и с теми заголовками, в каких они уходят в МИС. */
export const EHR_MIS_SECTIONS: { key: keyof EHRNote; title: string }[] = [
  { key: 'complaints', title: 'Жалобы' },
  { key: 'anamnesisMorbi', title: 'Анамнез заболевания (Morbi)' },
  { key: 'anamnesisVitae', title: 'Анамнез жизни (Vitae)' },
  { key: 'allergies', title: 'Аллергологический анамнез' },
  { key: 'examination', title: 'Данные обследования' },
  { key: 'diagnoses', title: 'Предварительные диагнозы' },
  { key: 'medications', title: 'Лекарственная терапия' },
  { key: 'plan', title: 'План лечения / Прочие рекомендации' },
];

/** Текст протокола для вставки в МИС: пустые разделы пропускаются. */
export function ehrToMisText(ehr: Partial<EHRNote>): string {
  return EHR_MIS_SECTIONS
    .filter(({ key }) => (ehr[key] ?? '').toString().trim())
    .map(({ key, title }) => `${title}:\n${ehr[key]}`)
    .join('\n\n')
    .trim();
}
