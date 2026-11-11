/**
 * Выбор модели распознавания речи (src/utils/sttEngine.ts) без сети и базы:
 * что реально работает, разбор ответа tone, тексты ошибок.
 *
 *   npx tsx scripts/check-stt-engine.ts
 */
import {
  isSttEngine, effectiveEngine, parseToneEngines, gigaamErrorMessage, parseEngineFallback,
  type GigaamState, type SttEngine,
} from '../src/utils/sttEngine';

let bad = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(66)} ${detail}`);
};

console.log('Выбор и действующая модель');
{
  check('isSttEngine: tone и gigaam', isSttEngine('tone') && isSttEngine('gigaam'));
  check('isSttEngine: мусор', !isSttEngine('whisper') && !isSttEngine(null) && !isSttEngine(1) && !isSttEngine(undefined));
  const states: GigaamState[] = ['absent', 'downloading', 'verifying', 'loading', 'ready', 'failed', 'unknown'];
  for (const s of states) {
    check(`gigaam + ${s}`, effectiveEngine('gigaam', s) === (s === 'ready' ? 'gigaam' : 'tone'));
    check(`tone + ${s}`, effectiveEngine('tone' as SttEngine, s) === 'tone');
  }
}

console.log('parseToneEngines');
{
  const ok = parseToneEngines({
    tone: { ready: true },
    gigaam: { state: 'downloading', loaded: false, downloaded_bytes: 1000, total_bytes: 5000, error: null, model: 'x' },
  });
  check('нормальный ответ', ok.toneReady && ok.gigaam.state === 'downloading'
    && ok.gigaam.downloadedBytes === 1000 && ok.gigaam.totalBytes === 5000 && ok.gigaam.errorCode === null);
  const failed = parseToneEngines({ tone: { ready: true }, gigaam: { state: 'failed', error: 'checksum' } });
  check('failed с кодом', failed.gigaam.state === 'failed' && failed.gigaam.errorCode === 'checksum');
  const failedBad = parseToneEngines({ gigaam: { state: 'failed', error: '<script>' } });
  check('failed с чужим кодом → unknown', failedBad.gigaam.errorCode === 'unknown');
  check('error вне failed не передаётся', parseToneEngines({ gigaam: { state: 'ready', error: 'network' } }).gigaam.errorCode === null);
  for (const junk of [null, undefined, 'x', 42, [], {}, { gigaam: 'x' }, { gigaam: { state: 'hacked' } }]) {
    const r = parseToneEngines(junk);
    check(`мусор ${JSON.stringify(junk)}`, r.gigaam.state === 'unknown' && !r.toneReady
      && r.gigaam.downloadedBytes === 0 && r.gigaam.errorCode === null);
  }
  const neg = parseToneEngines({ gigaam: { state: 'downloading', downloaded_bytes: -5, total_bytes: 'a' } });
  check('отрицательные и нечисловые байты → 0', neg.gigaam.downloadedBytes === 0 && neg.gigaam.totalBytes === 0);
  check('tone.ready не true → false', !parseToneEngines({ tone: { ready: 'yes' } }).toneReady);
}

console.log('Тексты ошибок и причина отката');
{
  for (const c of ['network', 'checksum', 'disk_space', 'load', 'unknown']) {
    check(`текст для ${c}`, gigaamErrorMessage(c).length > 10);
  }
  check('неизвестный код → unknown', gigaamErrorMessage('zzz') === gigaamErrorMessage('unknown') && gigaamErrorMessage(null) === gigaamErrorMessage('unknown'));
  check('network упоминает HF_ENDPOINT', gigaamErrorMessage('network').includes('HF_ENDPOINT'));
  check('parseEngineFallback', parseEngineFallback('not_ready') === 'not_ready' && parseEngineFallback('error') === 'error'
    && parseEngineFallback('x') === null && parseEngineFallback(null) === null);
}

console.log(bad ? `\nПровалено: ${bad}` : '\nВсё сошлось.');
process.exit(bad ? 1 : 0);
