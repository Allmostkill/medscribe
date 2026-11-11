/**
 * Настройки микрофона (src/utils/micConstraints.ts) без браузера:
 * очный приём без обработки звука по умолчанию, звонок как раньше, строка для журнала.
 *
 *   npx tsx scripts/check-mic-constraints.ts
 */
import {
  AUDIO_PROCESSING_KEY, parseAudioProcessing, micConstraints, describeTrack, describeProcessingForDoctor,
} from '../src/utils/micConstraints';

let bad = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(66)} ${detail}`);
};

console.log('micConstraints');
{
  const off = micConstraints('in-person', false);
  check('очный, обработка выключена: три false, один канал',
    off.echoCancellation === false && off.noiseSuppression === false && off.autoGainControl === false && off.channelCount === 1);
  const on = micConstraints('in-person', true);
  check('очный, обработка включена: три true, один канал',
    on.echoCancellation === true && on.noiseSuppression === true && on.autoGainControl === true && on.channelCount === 1);
  check('очный: sampleRate не просим', !('sampleRate' in off) && !('sampleRate' in on));
  for (const p of [false, true]) {
    const c = micConstraints('call-mic', p);
    check(`звонок, переключатель ${p}: три true`,
      c.echoCancellation === true && c.noiseSuppression === true && c.autoGainControl === true);
  }
}

console.log('parseAudioProcessing');
{
  check('null → false', parseAudioProcessing(null) === false);
  check("'false' → false", parseAudioProcessing('false') === false);
  check("'true' → true", parseAudioProcessing('true') === true);
  check('мусор → false', !parseAudioProcessing('1') && !parseAudioProcessing('TRUE') && !parseAudioProcessing('') && !parseAudioProcessing('yes'));
  check('ключ', AUDIO_PROCESSING_KEY === 'medscribe_browser_audio_processing');
}

console.log('describeTrack');
{
  const wanted = micConstraints('in-person', false);
  const full = describeTrack(
    { echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: 48000, channelCount: 1 }, wanted);
  check('полные настройки', full.line === 'ec=off ns=off agc=off rate=48000 ch=1' && full.mismatch.length === 0, full.line);

  const part = describeTrack({ echoCancellation: true, sampleRate: 44100 }, micConstraints('call-mic', false));
  check('частичные: неизвестное — «?»', part.line === 'ec=on ns=? agc=? rate=44100 ch=?', part.line);
  check('частичные: без mismatch', part.mismatch.length === 0);

  const mm = describeTrack({ echoCancellation: true, noiseSuppression: false, autoGainControl: true, sampleRate: 48000, channelCount: 1 }, wanted);
  check('mismatch: ec и agc', mm.mismatch.join(',') === 'echoCancellation,autoGainControl', mm.mismatch.join(','));

  const empty = describeTrack({}, wanted);
  check('пустые настройки', empty.line === 'ec=? ns=? agc=? rate=? ch=?' && empty.mismatch.length === 0, empty.line);

  const priv = describeTrack({ deviceId: 'SECRET-ID-123', groupId: 'GRP', label: 'Мой микрофон', sampleRate: 48000 } as any, wanted);
  check('deviceId, groupId и label не попадают в строку',
    !priv.line.includes('SECRET') && !priv.line.includes('GRP') && !priv.line.includes('микрофон'), priv.line);
}

console.log('describeProcessingForDoctor');
{
  const d = describeProcessingForDoctor;
  check('все выключены', d('ec=off ns=off agc=off rate=48000 ch=1') === 'Обработка звука браузера: выключена · 48 кГц · 1 канал', d('ec=off ns=off agc=off rate=48000 ch=1'));
  check('все включены, 44,1 кГц с запятой', d('ec=on ns=on agc=on rate=44100 ch=2') === 'Обработка звука браузера: включена · 44,1 кГц · 2 канала', d('ec=on ns=on agc=on rate=44100 ch=2'));
  check('смешанные — частично', d('ec=on ns=off agc=off rate=48000 ch=1').startsWith('Обработка звука браузера: частично включена'));
  check('неизвестные не учитываются: известные off → выключена', d('ec=off ns=? agc=? rate=48000 ch=1') === 'Обработка звука браузера: выключена · 48 кГц · 1 канал', d('ec=off ns=? agc=? rate=48000 ch=1'));
  check('неизвестные не учитываются: известные on → включена', d('ec=on ns=on agc=? rate=? ch=?') === 'Обработка звука браузера: включена', d('ec=on ns=on agc=? rate=? ch=?'));
  check('известные разные + неизвестное — частично', d('ec=on ns=off agc=?  rate=? ch=?').includes('частично'));
  check('известных нет — без начала', d('ec=? ns=? agc=? rate=48000 ch=1') === '48 кГц · 1 канал', d('ec=? ns=? agc=? rate=48000 ch=1'));
  check('всё неизвестно — пусто', d('ec=? ns=? agc=? rate=? ch=?') === '');
  check('16 кГц и 6 каналов', d('ec=off ns=off agc=off rate=16000 ch=6') === 'Обработка звука браузера: выключена · 16 кГц · 6 каналов');
}

console.log(bad ? `\nПровалено: ${bad}` : '\nВсё сошлось.');
process.exit(bad ? 1 : 0);
