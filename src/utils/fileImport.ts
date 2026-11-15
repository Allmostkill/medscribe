// ─── Чистая логика загрузки аудиофайла приёма (без браузерных API) ───────────
// Вынесена из services/fileImport, чтобы проверяться в node:
//   tsx scripts/check-file-import.ts

/** Размер части при отправке исходного файла на сервер. */
export const PART_SIZE = 16 * 1024 * 1024;
/** Предел размера файла (совпадает с сервером). */
export const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
/** Для input[type=file]: формат всё равно определит сервер. */
export const ACCEPT = '.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.webm,.amr,.flac,audio/*';

export interface PartRange { seq: number; start: number; end: number }

/** Части файла [start, end) по PART_SIZE; пустой файл — без частей. */
export function partRanges(size: number): PartRange[] {
  const out: PartRange[] = [];
  if (!Number.isFinite(size) || size <= 0) return out;
  for (let start = 0, seq = 0; start < size; start += PART_SIZE, seq++) {
    out.push({ seq, start, end: Math.min(start + PART_SIZE, size) });
  }
  return out;
}

/**
 * Текст ошибки для врача по ответу сервера ({error, code, format}); code важнее статуса.
 * format — контейнер файла, если сервер его назвал (mp4 = m4a): у него свой, меньший предел размера.
 */
export function importErrorMessage(status: number, code: string | undefined, fallback: string, format?: string): string {
  if (status === 0) return 'Нет связи с сервером';
  if (status === 401) return 'Сессия истекла, войдите заново';
  if (status === 404 || code === 'gone') return 'Загрузка прервалась — выберите файл заново';
  if (code === 'upload_active') return 'Уже идёт загрузка другого файла — дождитесь её или отмените';
  if (code === 'part_in_flight') return 'Сервер ещё принимает предыдущую часть файла, попробуйте ещё раз';
  if (code === 'too_big' && format === 'mp4') return 'Файл m4a больше 300 МБ: сохраните запись в mp3 или wav и загрузите снова';
  if (code === 'unsupported' || status === 415) return 'Формат не распознан: поддерживаются mp3, m4a, wav, ogg, webm, amr, flac';
  if (code === 'too_long') return 'Запись длиннее 2 часов: разделите файл на части';
  if (code === 'too_big') return 'Файл больше 2 ГБ';
  if (code === 'busy' || status === 503) return 'Сервер занят обработкой другого файла, попробуйте через минуту';
  return fallback;
}

/**
 * Повторять ли запрос после ответа сервера (status 0 — обрыв сети).
 * Повтор части шлёт тот же seq, сервер принимает ровно предыдущую часть как повтор.
 * Не повторяем: «gone» (загрузки уже нет), «upload_active», «busy»/503, 4xx, пробел в частях (gap).
 */
export function shouldRetry(status: number, code?: string): boolean {
  if (status === 0) return true;
  if (code === 'part_in_flight') return true;   // прошлая часть ещё пишется: не ошибка врача
  if (code === 'gone' || code === 'upload_active' || code === 'busy' || status === 503) return false;
  return status >= 500;
}

/**
 * Разбор неуспешного ответа сервера (status, тело JSON или null): текст для врача, код и нужен ли повтор.
 * format из тела доходит до importErrorMessage (m4a — свой предел размера).
 */
export function errorFromResponse(status: number, body: any): { message: string; code?: string; retryable: boolean } {
  const code = typeof body?.code === 'string' ? body.code : undefined;
  const fallback = typeof body?.error === 'string' && body.error ? body.error : `Сервер вернул ${status}`;
  const format = typeof body?.format === 'string' ? body.format : undefined;
  return { message: importErrorMessage(status, code, fallback, format), code, retryable: shouldRetry(status, code) };
}

/** Попыток на один запрос и пауза между ними. */
export const MAX_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 1500;
/**
 * part_in_flight: после обрыва tone ещё несколько секунд дописывает предыдущую часть в ffmpeg,
 * поэтому запас длиннее и пауза ровная (не растёт с номером попытки).
 */
export const PART_IN_FLIGHT_ATTEMPTS = 10;
export const PART_IN_FLIGHT_DELAY_MS = 2000;

/** Предел попыток для кода ответа сервера. */
export function maxAttempts(code?: string): number {
  return code === 'part_in_flight' ? PART_IN_FLIGHT_ATTEMPTS : MAX_ATTEMPTS;
}

/** Пауза перед следующей попыткой; attempt — номер только что неудавшейся попытки этого вида (с 1). */
export function retryDelayMs(code: string | undefined, attempt: number): number {
  return code === 'part_in_flight' ? PART_IN_FLIGHT_DELAY_MS : RETRY_DELAY_MS * attempt;
}

/** Проверка до загрузки: null — можно отправлять. Расширение не смотрим: формат определит сервер. */
export function precheckFile(f: { size: number; name: string }): string | null {
  if (!f.size || f.size <= 0) return 'Файл пустой';
  if (f.size > MAX_FILE_BYTES) return 'Файл больше 2 ГБ';
  return null;
}

/** Дата приёма по умолчанию — дата изменения файла (локальная); будущая или раньше 2000 года — сегодня. */
export function defaultVisitDate(lastModified: number, now: number): string {
  const fmt = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const ok = Number.isFinite(lastModified) && lastModified >= new Date(2000, 0, 1).getTime() && lastModified <= now;
  return fmt(ok ? lastModified : now);
}
