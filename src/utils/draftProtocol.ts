// Готов ли протокол в записи истории. Вынесено из PersonalAccount.tsx, чтобы проверять без React.

// Значение, которое saveDraft (Dashboard.tsx) кладёт в diagnoses, когда протокола нет.
export const DRAFT_PLACEHOLDER = '(не сформировано)';

// Все 8 полей протокола (EHRNote в src/types.ts).
const PROTOCOL_FIELDS = ['complaints', 'anamnesisMorbi', 'anamnesisVitae', 'allergies', 'examination', 'diagnoses', 'medications', 'plan'] as const;

const filled = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.trim() !== DRAFT_PLACEHOLDER;

// Протокол есть, если заполнено хоть одно поле и оно не заглушка:
// пустой диагноз или короткий код («I10») не делают готовый протокол черновиком.
export const hasProtocolContent = (content: unknown): boolean => {
  if (!content || typeof content !== 'object') return false;
  const c = content as Record<string, unknown>;
  return PROTOCOL_FIELDS.some(f => filled(c[f]));
};

export const draftTitle = (content: unknown): string => {
  if (!hasProtocolContent(content)) return 'Протокол не сформирован';
  const d = (content as Record<string, unknown>).diagnoses;
  return filled(d) ? d : 'Протокол без диагноза';
};
