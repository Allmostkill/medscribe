/**
 * Проверка выбора стенограммы при «Завершить и сформировать протокол» посреди записи.
 *   tsx scripts/check-finish-flow.ts
 * Гоняется настоящий код src/utils/finishFlow.ts.
 */
import {
  refineTimeoutMs, planFinishTranscript, raceWithTimeout, FALLBACK_NOTICE, FALLBACK_NOTICE_NO_AUDIO,
  REFINE_PER_SEGMENT_MS, REFINE_PER_SEGMENT_MS_GIGAAM, REFINE_SEGMENT_MS, type RefineOutcome,
  isPendingForVisit, canRefineOnFinish, isResumedFinish, shouldDeleteAudio,
} from '../src/utils/finishFlow';

let bad = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) bad++; console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(62)} ${ok ? '' : detail}`); };

const live = ['живая 1', 'живая 2'];
const refinedLines = ['[speaker_1] а', '[speaker_2] б'];

console.log('Таймаут по длине записи');
check('0 мс и NaN — один сегмент', refineTimeoutMs(0) === REFINE_PER_SEGMENT_MS && refineTimeoutMs(NaN) === REFINE_PER_SEGMENT_MS);
check('20 минут — 3 минуты', refineTimeoutMs(REFINE_SEGMENT_MS) === 3 * 60 * 1000);
check('20 минут и 1 мс — два сегмента', refineTimeoutMs(REFINE_SEGMENT_MS + 1) === 2 * REFINE_PER_SEGMENT_MS);
check('65 минут — четыре сегмента', refineTimeoutMs(65 * 60 * 1000) === 4 * REFINE_PER_SEGMENT_MS);
check('движок по умолчанию — T-one', refineTimeoutMs(REFINE_SEGMENT_MS, 'tone') === refineTimeoutMs(REFINE_SEGMENT_MS));
check('GigaAM: 20 минут — 6 минут', refineTimeoutMs(REFINE_SEGMENT_MS, 'gigaam') === 6 * 60 * 1000);
check('GigaAM: 65 минут — четыре сегмента по 6 минут', refineTimeoutMs(65 * 60 * 1000, 'gigaam') === 4 * REFINE_PER_SEGMENT_MS_GIGAAM);
check('GigaAM: 0 мс и NaN — один сегмент', refineTimeoutMs(0, 'gigaam') === REFINE_PER_SEGMENT_MS_GIGAAM && refineTimeoutMs(NaN, 'gigaam') === REFINE_PER_SEGMENT_MS_GIGAAM);

console.log('Выбор стенограммы');
{
  const ok: RefineOutcome<string> = { kind: 'ok', lines: refinedLines, voiceLabelled: true };
  const p = planFinishTranscript(live, false, ok);
  check('успех: уточнённые строки и метки голосов', p.source === 'refined' && p.lines === refinedLines && p.voiceLabelled && !p.keepAudio && p.notice === null);
  const noLabels = planFinishTranscript(live, true, { kind: 'ok', lines: refinedLines, voiceLabelled: false });
  check('успех без диаризации: флаг голосов выключен', noLabels.source === 'refined' && noLabels.voiceLabelled === false);
  for (const kind of ['empty', 'failed', 'timeout'] as const) {
    const f = planFinishTranscript(live, false, { kind });
    check(`${kind}: живая стенограмма, аудио сохранено, сообщение`,
      f.source === 'live' && f.lines === live && f.voiceLabelled === false && f.keepAudio && f.notice === FALLBACK_NOTICE);
  }
  const emptyOk = planFinishTranscript(live, false, { kind: 'ok', lines: [], voiceLabelled: true });
  check('ok с пустыми строками не стирает живую стенограмму', emptyOk.source === 'live' && emptyOk.lines === live && emptyOk.keepAudio);
  const none = planFinishTranscript(live, false, null);
  check('записи не было: живая, аудио не трогаем, свой текст', none.source === 'live' && !none.keepAudio && none.notice === FALLBACK_NOTICE_NO_AUDIO);
  check('сообщение с «Незавершённых» только когда аудио есть', FALLBACK_NOTICE.includes('«Незавершённых»') && !FALLBACK_NOTICE_NO_AUDIO.includes('Запись'));
  const keep = planFinishTranscript(live, true, { kind: 'failed' });
  check('живой флаг голосов сохраняется как был', keep.voiceLabelled === true);
}

console.log('Владение уточнением, продолжение записи, удаление аудио');
check('уточнение того же приёма подхватывается', isPendingForVisit(3, 3));
check('уточнение прошлого приёма — нет', !isPendingForVisit(2, 3));
check('нет уточнения — нет', !isPendingForVisit(null, 3) && !isPendingForVisit(undefined, 3));
check('чистая запись — уточняем', canRefineOnFinish(0));
check('продолженная запись (есть префикс) — не склеиваем', !canRefineOnFinish(4));
check('продолжение без идущей записи (после «Стоп», уточнение в работе) — тоже продолженный', isResumedFinish(true, 3));
check('чистый приём с уточнением в работе — не продолженный', !isResumedFinish(true, 0));
check('нечего расшифровывать — не продолженный', !isResumedFinish(false, 3));
check('уточнение не заменяет стенограмму с префиксом (правило общее для «Стоп» и «Завершить»)', !canRefineOnFinish(1) && canRefineOnFinish(0));
check('аудио стирается только при протоколе и сохранённом черновике',
  shouldDeleteAudio(true, true) && !shouldDeleteAudio(true, false) && !shouldDeleteAudio(false, true) && !shouldDeleteAudio(false, false));

console.log('Ожидание с таймаутом');
async function run() {
  const fast = await raceWithTimeout(new Promise<number>(r => setTimeout(() => r(7), 5)), 200);
  check('быстрый результат отдаётся', !fast.timedOut && fast.value === 7);
  const slow = await raceWithTimeout(new Promise<number>(r => setTimeout(() => r(1), 300)), 20);
  check('медленный — timedOut', slow.timedOut === true);
  let rejected = false;
  try { await raceWithTimeout(Promise.reject(new Error('x')), 50); } catch { rejected = true; }
  check('ошибка пробрасывается', rejected);

  console.log(bad ? `\n${bad} проверок не прошло` : '\nВсе проверки прошли');
  process.exit(bad ? 1 : 0);
}
run();
