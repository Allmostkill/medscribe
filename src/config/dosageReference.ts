// Пресеты препаратов с дозировкой по массе тела (мг/кг) — преимущественно
// педиатрия, единственная область в проекте, где дозы по весу были явно
// зафиксированы (server.ts, промпт для педиатра). Справочные величины,
// не заменяют инструкцию препарата и клиническое суждение.

export interface DosagePreset {
  drug: string;
  // Если perDay=false (по умолчанию) — mgPerKg это разовая доза на приём.
  // Если perDay=true — mgPerKg это суммарная суточная доза, делится на frequencyPerDay.
  mgPerKg: number;
  perDay?: boolean;
  frequencyPerDay: number;
  note?: string;
  // Совпадает со значениями Icd10Code.category. Влияет только на
  // подсветку/порядок — это разовая доза по весу, не схема титрации.
  relatedCategories?: string[];
}

export const DOSAGE_PRESETS: Record<string, DosagePreset[]> = {
  pediatrician: [
    { drug: 'Парацетамол', mgPerKg: 15, frequencyPerDay: 4, note: 'разовая доза, интервал ≥ 4-6 ч', relatedCategories: ['uri', 'fever'] },
    { drug: 'Ибупрофен', mgPerKg: 10, frequencyPerDay: 3, note: 'разовая доза', relatedCategories: ['uri', 'fever'] },
    { drug: 'Амоксициллин', mgPerKg: 50, perDay: true, frequencyPerDay: 3, note: 'суточная доза, делится на приёмы', relatedCategories: ['otitis_media', 'pneumonia'] },
    { drug: 'Амоксициллин/клавуланат', mgPerKg: 45, perDay: true, frequencyPerDay: 2, note: 'суточная доза по амоксициллину', relatedCategories: ['otitis_media', 'pneumonia'] },
    { drug: 'Азитромицин', mgPerKg: 10, perDay: true, frequencyPerDay: 1, note: 'суточная доза, обычно 3 дня', relatedCategories: ['otitis_media', 'pneumonia'] },
    { drug: 'Цефиксим', mgPerKg: 8, perDay: true, frequencyPerDay: 2, note: 'суточная доза', relatedCategories: ['otitis_media', 'pneumonia'] },
    { drug: 'Цетиризин', mgPerKg: 0.25, frequencyPerDay: 1, note: 'разовая доза, уточните возрастные ограничения' },
    { drug: 'Преднизолон', mgPerKg: 1.5, perDay: true, frequencyPerDay: 1, note: 'суточная доза при бронхообструкции, 1-2 мг/кг/сут' },
  ],
};

export function getDosagePresets(specialtyId: string): DosagePreset[] {
  return DOSAGE_PRESETS[specialtyId] ?? [];
}
