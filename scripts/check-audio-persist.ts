/**
 * Проверка чистой логики сохранения записи (куски, дыры, живость, сброс, длительность).
 *   tsx scripts/check-audio-persist.ts
 * Гоняется настоящий код src/utils/audioPersist.ts.
 */
import {
  assembleSegments, nextSessionMeta, isSessionLive, sessionBelongsTo, shouldFlush, formatSessionDuration,
  FLUSH_INTERVAL_MS, LIVE_FRESH_MS, type ChunkLike,
} from '../src/utils/audioPersist';

let bad = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) bad++; console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(62)} ${ok ? '' : detail}`); };

const buf = (n: number) => new Uint8Array(n).buffer as ArrayBuffer;
const ch = (segmentIdx: number, seq: number, segmentMs = (seq + 1) * 5000): ChunkLike =>
  ({ segmentIdx, seq, data: buf(seq + 1), mimeType: 'audio/webm;codecs=opus', segmentMs, recordedAt: 1000 + seq });

console.log('Сборка сегментов');
{
  const r = assembleSegments([ch(1, 1), ch(0, 2), ch(0, 0), ch(1, 0), ch(0, 1)]);
  check('сегменты по порядку, кусочки по seq', r.length === 2 && r[0].segmentIdx === 0 && r[1].segmentIdx === 1
    && r[0].parts.map(p => p.byteLength).join() === '1,2,3' && r[1].parts.length === 2);
  check('длительность сегмента — у последнего кусочка', r[0].durationMs === 15000 && r[1].durationMs === 10000);
  check('mimeType сохраняется, обрезки нет', r[0].mimeType === 'audio/webm;codecs=opus' && !r[0].truncated);
  check('пустой вход — пусто', assembleSegments([]).length === 0);
}
{
  const r = assembleSegments([ch(0, 1), ch(0, 2), ch(1, 0)]);
  check('нет seq=0 — сегмент не отдаётся (файл без заголовка)', r.length === 1 && r[0].segmentIdx === 1);
}
{
  const r = assembleSegments([ch(0, 0), ch(0, 1), ch(0, 3), ch(0, 4)]);
  check('дыра в середине — кусочки после неё отброшены', r.length === 1 && r[0].parts.length === 2 && r[0].truncated);
  check('после обрезки длительность — по последнему целому', r[0].durationMs === 10000);
}

console.log('Строка сессии');
{
  const a = nextSessionMeta({ durationMs: 0, segmentCount: 0 }, 0, 5000, 111);
  check('первый сброс: длительность и сегмент', a.durationMs === 5000 && a.segmentCount === 1 && a.updatedAt === 111);
  const b = nextSessionMeta(a, 0, 10000, 222);
  check('длительность абсолютная, а не сумма', b.durationMs === 10000, String(b.durationMs));
  const c = nextSessionMeta(b, 1, 1_205_000, 333);
  check('segmentCount — максимум, смена сегмента', c.segmentCount === 2 && c.durationMs === 1_205_000);
  const d = nextSessionMeta(c, 0, 20000, 444);
  check('поздний кусочек старого сегмента не уменьшает счётчики', d.segmentCount === 2 && d.durationMs === 1_205_000);
  check('NaN длительности не портит строку', nextSessionMeta(c, 1, NaN, 1).durationMs === 1_205_000);
}

console.log('Живая запись');
{
  const now = 1_000_000;
  const rec = (updatedAt?: number) => ({ sessionId: 'a', status: 'recording', startedAt: now - 600_000, updatedAt });
  check('с блокировкой: держится — живая', isSessionLive(rec(now - 999_999), new Set(['a']), now));
  check('с блокировкой: нет — упавшая, видна', !isSessionLive(rec(now - 1000), new Set(['b']), now));
  check('с блокировкой: completed, но держится — живая', isSessionLive({ ...rec(), status: 'completed' }, new Set(['a']), now));
  check('без блокировок: свежая запись — живая', isSessionLive(rec(now - (LIVE_FRESH_MS - 1)), null, now));
  check('без блокировок: ровно 30 с — уже упавшая', !isSessionLive(rec(now - LIVE_FRESH_MS), null, now));
  check('без блокировок: нет updatedAt — по startedAt (старая запись)', !isSessionLive(rec(undefined), null, now));
  check('без блокировок: completed — не живая', !isSessionLive({ ...rec(now), status: 'completed' }, null, now));
}

console.log('Чья запись');
{
  const me = { id: 'doc-1', name: 'Иванов И.И.' };
  check('своя запись (id совпал)', sessionBelongsTo({ doctorId: 'doc-1' }, me));
  check('чужая запись скрыта', !sessionBelongsTo({ doctorId: 'doc-2' }, me));
  check('старая запись: в doctorId имя этого врача', sessionBelongsTo({ doctorId: 'Иванов И.И.' }, me));
  check('старая запись: имя другого врача — скрыта', !sessionBelongsTo({ doctorId: 'Петров П.П.' }, me));
  check('старая запись без doctorId — видна', sessionBelongsTo({}, me) && sessionBelongsTo({ doctorId: '' }, me) && sessionBelongsTo({ doctorId: '  ' }, me));
  check('врач неизвестен — ничего не показываем', !sessionBelongsTo({ doctorId: 'doc-1' }, null) && !sessionBelongsTo({}, undefined)
    && !sessionBelongsTo({}, { id: '', name: 'Иванов И.И.' }) && !sessionBelongsTo({ doctorId: 'Иванов И.И.' }, { name: 'Иванов И.И.' }));
  check('пустое имя врача не совпадает с пустым doctorId чужой записи', !sessionBelongsTo({ doctorId: 'doc-2' }, { id: 'doc-1', name: '' }));
}

console.log('Когда сбрасывать на диск');
{
  check('ничего не накопилось — не сбрасываем', !shouldFlush(0, 0, 60_000));
  check('4999 мс — рано', !shouldFlush(3, 1000, 1000 + FLUSH_INTERVAL_MS - 1));
  check('ровно 5 с — пора', shouldFlush(3, 1000, 1000 + FLUSH_INTERVAL_MS));
  check('больше 5 с — пора', shouldFlush(1, 0, 60_000));
}

console.log('Вид длительности');
{
  check('40 с', formatSessionDuration(40_000) === '40 с', formatSessionDuration(40_000));
  check('0 и NaN — «0 с»', formatSessionDuration(0) === '0 с' && formatSessionDuration(NaN) === '0 с');
  check('59 с — секунды', formatSessionDuration(59_000) === '59 с');
  check('7 минут — «~7 мин»', formatSessionDuration(7 * 60_000) === '~7 мин', formatSessionDuration(7 * 60_000));
  check('65 с — «~1 мин»', formatSessionDuration(65_000) === '~1 мин');
  check('60 мин', formatSessionDuration(3_600_000) === '~60 мин');
}

if (bad) { console.log(`\nПровалено: ${bad}`); process.exit(1); }
console.log('\nВсе проверки пройдены');
