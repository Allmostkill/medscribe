export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorDefinition {
  code: string;
  message: string;
  severity: ErrorSeverity;
}

// ── Speech-to-Text (T-one) ────────────────────────────────────────────────────
export const STT_ERRORS = {
  STT_008: { code: 'STT_008', message: 'STT: ошибка обработки аудио чанка', severity: 'medium' },
  STT_010: { code: 'STT_010', message: 'T-one: сервис распознавания вернул ошибку', severity: 'high' },
  STT_011: { code: 'STT_011', message: 'T-one: ошибка потокового WebSocket', severity: 'high' },
} as const satisfies Record<string, ErrorDefinition>;

// ── AI Models (LLM) ──────────────────────────────────────────────────────────
export const AI_ERRORS = {
  AI_001: { code: 'AI_001', message: 'LLM: запрос завершился с ошибкой', severity: 'high' },
  AI_008: { code: 'AI_008', message: 'AI: ошибка анализа транскрипта', severity: 'medium' },
  AI_009: { code: 'AI_009', message: 'AI: ошибка генерации подсказок', severity: 'low' },
  AI_010: { code: 'AI_010', message: 'AI: ошибка генерации фармацевтической справки', severity: 'low' },
  AI_011: { code: 'AI_011', message: 'AI: ошибка предложения диагноза', severity: 'low' },
  AI_012: { code: 'AI_012', message: 'AI: ошибка сверки протокола со стенограммой', severity: 'medium' },
  AI_013: { code: 'AI_013', message: 'LLM: не удалось расшифровать сохранённый ключ', severity: 'medium' },
} as const satisfies Record<string, ErrorDefinition>;

// ── Authentication ───────────────────────────────────────────────────────────
export const AUTH_ERRORS = {
  AUTH_004: { code: 'AUTH_004', message: 'Auth: ошибка 2FA', severity: 'high' },
  AUTH_006: { code: 'AUTH_006', message: 'Auth: ошибка генерации капчи', severity: 'low' },
  AUTH_011: { code: 'AUTH_011', message: 'Auth: ошибка сохранения refresh-токена', severity: 'high' },
  AUTH_012: { code: 'AUTH_012', message: 'Auth: ошибка обновления сессии по refresh-токену', severity: 'medium' },
} as const satisfies Record<string, ErrorDefinition>;

// ── First run (setup) ────────────────────────────────────────────────────────
export const SETUP_ERRORS = {
  SETUP_001: { code: 'SETUP_001', message: 'Первый запуск: ошибка создания аккаунта', severity: 'high' },
} as const satisfies Record<string, ErrorDefinition>;

// ── Database ──────────────────────────────────────────────────────
export const DB_ERRORS = {
  DB_003: { code: 'DB_003', message: 'DB: ошибка сохранения черновика', severity: 'high' },
  DB_004: { code: 'DB_004', message: 'DB: ошибка обновления профиля', severity: 'medium' },
  DB_007: { code: 'DB_007', message: 'DB: ошибка получения данных пользователя', severity: 'medium' },
  DB_010: { code: 'DB_010', message: 'DB: база данных недоступна', severity: 'critical' },
  DB_011: { code: 'DB_011', message: 'DB: ошибка раскладки рабочего поля', severity: 'low' },
  DB_012: { code: 'DB_012', message: 'DB: ошибка настроек языковой модели', severity: 'medium' },
  DB_013: { code: 'DB_013', message: 'DB: ошибка настроек распознавания речи', severity: 'medium' },
} as const satisfies Record<string, ErrorDefinition>;

// ── Clinical guidelines ──────────────────────────────────────────────────────
export const GUIDELINE_ERRORS = {
  GUIDE_001: { code: 'GUIDE_001', message: 'Клинреки: источник рекомендаций недоступен', severity: 'low' },
} as const satisfies Record<string, ErrorDefinition>;

// ── Server ───────────────────────────────────────────────────────────────────
export const SERVER_ERRORS = {
  SERVER_001: { code: 'SERVER_001', message: 'Server: необработанная ошибка', severity: 'high' },
} as const satisfies Record<string, ErrorDefinition>;

// ── Unified error map ────────────────────────────────────────────────────────
export const ERROR_CODES = {
  ...STT_ERRORS,
  ...AI_ERRORS,
  ...AUTH_ERRORS,
  ...SETUP_ERRORS,
  ...DB_ERRORS,
  ...GUIDELINE_ERRORS,
  ...SERVER_ERRORS,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;
