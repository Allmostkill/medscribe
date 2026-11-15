/**
 * Загрузка аудиофайла (src/utils/fileImport.ts) без браузера:
 * части, тексты ошибок, проверка до загрузки, дата приёма.
 *
 *   npx tsx scripts/check-file-import.ts
 */
import {
  PART_SIZE, MAX_FILE_BYTES, ACCEPT, partRanges, importErrorMessage, shouldRetry, precheckFile, defaultVisitDate,
  errorFromResponse, maxAttempts, retryDelayMs, MAX_ATTEMPTS, PART_IN_FLIGHT_ATTEMPTS, PART_IN_FLIGHT_DELAY_MS,
} from '../src/utils/fileImport';

let bad = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(66)} ${detail}`);
};

console.log('partRanges');
{
  check('PART_SIZE = 16 МБ', PART_SIZE === 16 * 1024 * 1024);
  check('0 байт: частей нет', partRanges(0).length === 0);
  const a = partRanges(PART_SIZE);
  check('ровно 16 МБ: одна часть', a.length === 1 && a[0].start === 0 && a[0].end === PART_SIZE && a[0].seq === 0);
  const b = partRanges(PART_SIZE + 1);
  check('16 МБ + 1: две части, вторая в 1 байт', b.length === 2 && b[1].start === PART_SIZE && b[1].end === PART_SIZE + 1 && b[1].seq === 1);
  const size = 830 * 1024 * 1024;
  const c = partRanges(size);
  check('830 МБ: 52 части, сплошь без дыр', c.length === 52 && c.every((r, i) => r.seq === i && r.start === (i ? c[i - 1].end : 0)) && c[51].end === size);
}

console.log('importErrorMessage');
{
  check('unsupported 415', importErrorMessage(415, 'unsupported', 'x').startsWith('Формат не распознан'));
  check('too_long 413', importErrorMessage(413, 'too_long', 'x') === 'Запись длиннее 2 часов: разделите файл на части');
  check('too_big 413', importErrorMessage(413, 'too_big', 'x') === 'Файл больше 2 ГБ');
  check('busy 503', importErrorMessage(503, 'busy', 'x').startsWith('Сервер занят'));
  check('401', importErrorMessage(401, undefined, 'x') === 'Сессия истекла, войдите заново');
  check('нет сети (0)', importErrorMessage(0, undefined, 'x') === 'Нет связи с сервером');
  check('gap 409: текст сервера', importErrorMessage(409, 'gap', 'пропущена часть') === 'пропущена часть');
  check('404 gone', importErrorMessage(404, 'gone', 'x') === 'Загрузка прервалась — выберите файл заново');
  check('404 без кода', importErrorMessage(404, undefined, 'x') === 'Загрузка прервалась — выберите файл заново');
  check('409 upload_active', importErrorMessage(409, 'upload_active', 'x').startsWith('Уже идёт загрузка другого файла'));
  check('409 part_in_flight', importErrorMessage(409, 'part_in_flight', 'x').startsWith('Сервер ещё принимает'));
  check('413 too_big mp4: про m4a и 300 МБ', importErrorMessage(413, 'too_big', 'x', 'mp4') === 'Файл m4a больше 300 МБ: сохраните запись в mp3 или wav и загрузите снова');
  check('too_long на части', importErrorMessage(413, 'too_long', 'x', 'mp4').startsWith('Запись длиннее'));
  check('неизвестное: fallback', importErrorMessage(500, undefined, 'fb') === 'fb');
}

console.log('shouldRetry');
{
  check('обрыв сети (0): повторять', shouldRetry(0));
  check('part_in_flight 409: повторять', shouldRetry(409, 'part_in_flight'));
  check('500: повторять', shouldRetry(500));
  check('gone 404: не повторять', !shouldRetry(404, 'gone'));
  check('404 без кода: не повторять', !shouldRetry(404));
  check('upload_active 409: не повторять', !shouldRetry(409, 'upload_active'));
  check('gap 409: не повторять', !shouldRetry(409, 'gap'));
  check('busy 503: не повторять', !shouldRetry(503, 'busy'));
  check('503 без кода: не повторять', !shouldRetry(503));
  check('too_long 413 / unsupported 415: не повторять', !shouldRetry(413, 'too_long') && !shouldRetry(415, 'unsupported'));
  check('401: не повторять', !shouldRetry(401));
}

console.log('errorFromResponse');
{
  const m4a = errorFromResponse(413, { error: 'Файл m4a больше 300 МБ', code: 'too_big', format: 'mp4' });
  check('too_big + format mp4: текст про m4a и 300 МБ', m4a.message.startsWith('Файл m4a больше 300 МБ: сохраните') && !m4a.retryable);
  check('too_big без format: «больше 2 ГБ»', errorFromResponse(413, { error: 'x', code: 'too_big' }).message === 'Файл больше 2 ГБ');
  check('format не строка игнорируется', errorFromResponse(413, { code: 'too_big', format: 5 }).message === 'Файл больше 2 ГБ');
  const pf = errorFromResponse(409, { error: 'x', code: 'part_in_flight' });
  check('part_in_flight: код и повтор', pf.code === 'part_in_flight' && pf.retryable);
  check('тела нет: fallback со статусом, 500 повторяем', errorFromResponse(500, null).message === 'Сервер вернул 500' && errorFromResponse(500, null).retryable);
  check('gap: текст сервера, без повтора', errorFromResponse(409, { error: 'потерялась', code: 'gap' }).message === 'потерялась' && !errorFromResponse(409, { code: 'gap' }).retryable);
}

console.log('запас повторов');
{
  check('обычные: 3 попытки, пауза растёт', MAX_ATTEMPTS === 3 && maxAttempts() === 3 && maxAttempts('gone') === 3 && retryDelayMs(undefined, 2) === 3000);
  check('part_in_flight: 10 попыток, пауза 2 с ровная', PART_IN_FLIGHT_ATTEMPTS === 10 && maxAttempts('part_in_flight') === 10
    && PART_IN_FLIGHT_DELAY_MS === 2000 && retryDelayMs('part_in_flight', 1) === 2000 && retryDelayMs('part_in_flight', 9) === 2000);
  check('запас part_in_flight покрывает ≥ 15 с', (PART_IN_FLIGHT_ATTEMPTS - 1) * PART_IN_FLIGHT_DELAY_MS >= 15000);
}

console.log('precheckFile / ACCEPT');
{
  check('пустой файл', precheckFile({ size: 0, name: 'a.mp3' }) === 'Файл пустой');
  check('2 ГБ + 1', precheckFile({ size: MAX_FILE_BYTES + 1, name: 'a.wav' }) === 'Файл больше 2 ГБ');
  check('ровно 2 ГБ проходит', precheckFile({ size: MAX_FILE_BYTES, name: 'a.wav' }) === null);
  check('странное расширение проходит', precheckFile({ size: 10, name: 'запись.xyz' }) === null);
  check('ACCEPT содержит audio/*', ACCEPT.includes('audio/*') && ACCEPT.includes('.m4a'));
}

console.log('defaultVisitDate');
{
  const now = new Date(2026, 10, 15, 12, 0).getTime();
  check('обычная дата', defaultVisitDate(new Date(2026, 10, 3, 9, 30).getTime(), now) === '2026-11-03');
  check('будущая → сегодня', defaultVisitDate(new Date(2026, 11, 1).getTime(), now) === '2026-11-15');
  check('1999 → сегодня', defaultVisitDate(new Date(1999, 5, 1).getTime(), now) === '2026-11-15');
  check('NaN → сегодня', defaultVisitDate(NaN, now) === '2026-11-15');
}

if (bad) { console.log(`\nпровалено: ${bad}`); process.exit(1); }
console.log('\nвсё в порядке');
