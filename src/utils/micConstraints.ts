/**
 * Настройки микрофона для записи (без браузерных API: проверяются в scripts/check-mic-constraints.ts).
 *
 * Очный приём: браузер по умолчанию не обрабатывает звук (эхоподавление, шумоподавление,
 * автоусиление выключены). В клинике с двумя петличками на одном USB-приёмнике обработка
 * считает второй голос шумом/эхом и вырезает речь пациента. Врач может включить её обратно
 * переключателем в кабинете (ключ AUDIO_PROCESSING_KEY в localStorage).
 * Запись звонка: все три включены, переключатель на неё не влияет.
 */

export const AUDIO_PROCESSING_KEY = 'medscribe_browser_audio_processing';

export type MicKind = 'in-person' | 'call-mic';

/** Включена ли обработка звука браузером: только явное 'true', иначе выключена. */
export function parseAudioProcessing(raw: string | null): boolean {
  return raw === 'true';
}

export function micConstraints(kind: MicKind, processing: boolean): MediaTrackConstraints {
  if (kind === 'call-mic') {
    return { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  }
  return {
    echoCancellation: processing,
    noiseSuppression: processing,
    autoGainControl: processing,
    channelCount: 1,
  };
}

const FLAGS = [
  ['ec', 'echoCancellation'],
  ['ns', 'noiseSuppression'],
  ['agc', 'autoGainControl'],
] as const;

/**
 * Строка для журнала и подсказки врачу: 'ec=off ns=off agc=off rate=48000 ch=1'.
 * Поле, которого браузер не вернул, — '?'. deviceId и label намеренно не выводятся.
 * mismatch — имена настроек, которые браузер выставил иначе, чем просили.
 */
export function describeTrack(
  s: Partial<MediaTrackSettings>,
  wanted: MediaTrackConstraints,
): { line: string; mismatch: string[] } {
  const parts: string[] = [];
  const mismatch: string[] = [];
  for (const [short, key] of FLAGS) {
    const got = s[key];
    parts.push(`${short}=${typeof got === 'boolean' ? (got ? 'on' : 'off') : '?'}`);
    const want = wanted[key];
    if (typeof want === 'boolean' && typeof got === 'boolean' && want !== got) mismatch.push(key);
  }
  parts.push(`rate=${typeof s.sampleRate === 'number' ? s.sampleRate : '?'}`);
  parts.push(`ch=${typeof s.channelCount === 'number' ? s.channelCount : '?'}`);
  return { line: parts.join(' '), mismatch };
}

const num = (v: string | undefined) => (v === undefined ? NaN : Number(v));

/**
 * Строка из describeTrack → фраза для врача:
 * 'ec=off ns=off agc=off rate=44100 ch=1' → 'Обработка звука браузера: выключена · 44,1 кГц · 1 канал'.
 * Неизвестные поля ('?', Safari) при выборе «выключена/включена/частично» не учитываются;
 * если известных нет, начало строки не показываем.
 */
export function describeProcessingForDoctor(line: string): string {
  const f: Record<string, string> = Object.fromEntries(
    line.split(' ').map(p => p.split('=') as [string, string]),
  );
  const known = [f.ec, f.ns, f.agc].filter(v => v === 'on' || v === 'off');
  const state = known.length === 0 ? ''
    : known.every(v => v === 'off') ? 'выключена'
    : known.every(v => v === 'on') ? 'включена'
    : 'частично включена';
  const rate = num(f.rate);
  const ch = num(f.ch);
  return [
    state && `Обработка звука браузера: ${state}`,
    rate > 0 && `${String(Math.round(rate / 100) / 10).replace('.', ',')} кГц`,
    ch > 0 && `${ch} ${ch === 1 ? 'канал' : ch < 5 ? 'канала' : 'каналов'}`,
  ].filter(Boolean).join(' · ');
}
