// Единое определение специальности для ИИ-промптов. Идентификаторы совпадают с
// ключами src/config/specialties.ts; фронтенд присылает то русское название, то id,
// поэтому распознаём и то и другое. Порядок проверки имеет значение (первое совпадение).
//
// Для 'dentist' и 'therapist' отдельных веток в промптах нет — вызывающий код
// обрабатывает их как 'general'. Новую ветку промпта добавляйте там, где она нужна.
export type SpecialtyKey =
  | 'psychiatrist' | 'cardiologist' | 'endocrinologist' | 'neurologist' | 'pediatrician'
  | 'pulmonologist' | 'gynecologist' | 'gastroenterologist' | 'dermatologist'
  | 'ophthalmologist' | 'otolaryngologist' | 'urologist' | 'orthopedist' | 'ultrasound'
  | 'dentist' | 'general';

const SPECIALTY_PATTERNS: [SpecialtyKey, RegExp][] = [
  ['psychiatrist', /психиатр|psychiatr/],
  ['cardiologist', /кардиолог|cardiolog/],
  ['endocrinologist', /эндокринолог|endocrin/],
  ['neurologist', /невролог|neurolog/],
  ['pediatrician', /педиатр|pediatr/],
  ['pulmonologist', /пульмонолог|pulmonolog/],
  ['gynecologist', /гинеколог|gynecolog/],
  ['gastroenterologist', /гастро|gastroentero/],
  ['dermatologist', /дерматолог|dermatolog/],
  ['ophthalmologist', /офтальмолог|ophthalmolog/],
  ['otolaryngologist', /лор|оторинолар|otolaryngolog/],
  ['urologist', /уролог|urolog/],
  ['orthopedist', /ортопед|травматолог|orthoped/],
  ['ultrasound', /узи|ультразвук|сонолог|ultrasound|sonograph/],
  ['dentist', /стоматолог|dentist|stomatolog/],
];

export function detectSpecialty(specialty: unknown): SpecialtyKey {
  const lower = String(specialty || '').toLowerCase();
  for (const [key, re] of SPECIALTY_PATTERNS) {
    if (re.test(lower)) return key;
  }
  return 'general';
}
