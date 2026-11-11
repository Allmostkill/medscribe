/**
 * Независимые проверки исправлений P1–P4: метки спикеров, рендер стенограммы, сверка ключа с сервером.
 *   npx tsx scripts/check-review-fixes.ts
 * Только синтетические адреса и ключи.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizeLineSpeaker, speakerLabel, toAnalyzeText } from '../src/utils/speakers';
import { buildVoiceDiarizedTranscript, shouldUseVoiceMode } from '../src/server/ai/validate';
import { keyAfterUpdate, validateLlmSettingsInput, LLM_SETTINGS_MESSAGES } from '../src/server/ai/llmSettingsRules';
import { keyState, keyRequired, keyProblem, LLM_PRESETS, type LlmProvider } from '../src/utils/llmForm';
import { hasProtocolContent, draftTitle } from '../src/utils/draftProtocol';
import TranscriptBlock from '../src/components/blocks/TranscriptBlock';

let bad = 0;
const check = (name: string, ok: boolean, detail = '') => { if (!ok) bad++; console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(70)} ${ok ? '' : detail}`); };
const roles = { speaker_1: 'doctor', speaker_2: 'patient' };

console.log('P1: «Не определён» не превращается в «Врач»');
{
  const r = buildVoiceDiarizedTranscript('[speaker_1] Вопрос\n[unknown] А1\n[unknown] А2\n[speaker_2] Реплика', roles);
  check('середина: unknown не склеивается ни с врачом, ни с пациентом',
    JSON.stringify(r.lines.map(l => l.speaker)) === JSON.stringify(['doctor', 'unknown', 'unknown', 'patient']), JSON.stringify(r.lines));
  check('тексты соседей не тронуты', r.lines[0].text === 'Вопрос' && r.lines[3].text === 'Реплика', JSON.stringify(r.lines));
  const lead = buildVoiceDiarizedTranscript('без метки в начале\n[speaker_1] Врач\n[speaker_2] Пациент', roles);
  check('безметочная строка в самом начале — unknown, а не врач', lead.lines[0].speaker === 'unknown' && lead.lines[0].text === 'без метки в начале', JSON.stringify(lead.lines));
  const empty = buildVoiceDiarizedTranscript('[speaker_1] А\n[unknown] \n[speaker_2] Б', roles);
  check('пустой [unknown] не создаёт пустую реплику', empty.lines.length === 2, JSON.stringify(empty.lines));
  const fixed = buildVoiceDiarizedTranscript('[doctor] Д\n[unknown] У\n[patient] П\n[unknown] У2', {});
  check('фиксированные роли + unknown: порядок и роли', JSON.stringify(fixed.lines.map(l => l.speaker)) === JSON.stringify(['doctor', 'unknown', 'patient', 'unknown']), JSON.stringify(fixed.lines));
  check('flag=true и только [unknown] — не голосовой режим', shouldUseVoiceMode('[unknown] а\n[unknown] б', true) === false);
  check('normalizeLineSpeaker: null/число/объект → unknown', ['null', '7', '{}'].every(j => normalizeLineSpeaker(JSON.parse(j)) === 'unknown'));
  check('normalizeLineSpeaker: "Doctor"/"врач"/"" → unknown (не doctor)', ['Doctor', 'врач', ''].every(s => normalizeLineSpeaker(s) === 'unknown'));
  check('speakerLabel', speakerLabel('unknown') === 'Не определён' && speakerLabel('doctor') === 'Врач' && speakerLabel('patient') === 'Пациент' && speakerLabel('speaker_12') === 'Спикер 12');
  const t0 = new Date('2026-01-01T10:00:00Z');
  const at = (s: number) => new Date(t0.getTime() + s * 1000);
  const txt = toAnalyzeText([
    { speaker: 'speaker_1', text: 'Здравствуйте.', timestamp: at(0) },
    { speaker: 'unknown', text: 'кусок', timestamp: at(10) },
    { speaker: 'speaker_2', text: 'Да.', timestamp: at(20) },
  ]);
  check('toAnalyzeText передаёт метку [unknown]', txt === '[speaker_1] Здравствуйте.\n[unknown] кусок\n[speaker_2] Да.', JSON.stringify(txt));
  const spoof = toAnalyzeText([{ speaker: 'unknown', text: '[doctor] подделка', timestamp: at(0) }]);
  check('текст реплики не подделывает метку', !/^\[doctor\]/m.test(spoof), JSON.stringify(spoof));
}

console.log('P1 (экран): рендер блока стенограммы');
{
  const noop = () => {};
  const render = (lines: { speaker: string; text: string }[], isRecording: boolean) => renderToStaticMarkup(React.createElement(TranscriptBlock as any, {
    consultationType: 'primary', transcript: lines.map((l, i) => ({ id: 'l' + i, timestamp: new Date(0), ...l })),
    onOpenChecklistModal: noop, isRecording, stenographerMode: false, bufferedRef: { current: null }, bufferedElapsedMs: 0, bufferedLevel: 0,
    bufferedSegments: 0, stopBufferedAndTranscribe: noop, transcriptionProgress: null, isDiarizing: false, isRefiningTranscript: false,
    transcribingError: null, bufferedSessionId: null, retryTranscription: noop, currentSpeech: '', transcriptEndRef: { current: null },
    manualInput: '', onManualInputChange: noop, onManualSubmit: noop,
  }));
  const mixed = render([{ speaker: 'doctor', text: 'ВРАЧТЕКСТ' }, { speaker: 'unknown', text: 'НЕИЗВТЕКСТ' }, { speaker: 'patient', text: 'ПАЦТЕКСТ' }], false);
  check('после приёма среди размеченных: подпись «Не определён» есть', mixed.includes('Не определён'));
  check('«Врач» ровно один раз (только у врача)', (mixed.match(/Врач/g) || []).length === 1, String((mixed.match(/Врач/g) || []).length));
  const i = mixed.indexOf('НЕИЗВТЕКСТ');
  const block = mixed.slice(mixed.lastIndexOf('<div', mixed.lastIndexOf('Не определён')), i);
  check('подпись стоит прямо над текстом неопределённой реплики', block.includes('Не определён') && !block.includes('ВРАЧТЕКСТ') && !block.includes('ПАЦТЕКСТ'));
  const rec = render([{ speaker: 'unknown', text: 'ЖИВОЙ' }], true);
  check('идёт запись: живая строка без подписи', !rec.includes('Не определён') && rec.includes('ЖИВОЙ'));
}

console.log('P4: подсказка формы = правило сервера (дифференциальная сверка)');
{
  const origins = ['http://host.docker.internal:9911', 'http://host.docker.internal:9912', 'https://host.docker.internal:9911', 'http://HOST.docker.internal:9911', 'https://api.openai.com', 'https://openrouter.ai'];
  const paths = ['/v1', '/v1/', '/other/v2', '/v1/chat/completions', ''];
  let n = 0, mism: string[] = [];
  for (const provider of ['ollama', 'cloud'] as LlmProvider[]) for (const hasKey of [true, false]) for (const so of origins) for (const sp of paths) for (const no of origins) for (const np of paths) {
    const stored = { baseUrl: so + sp, hasKey };
    const next = { provider, baseUrl: no + np };
    const server = keyAfterUpdate({ baseUrl: stored.baseUrl, apiKey: hasKey ? 'sk-test-OLD-1111' : null }, { provider, baseUrl: next.baseUrl, apiKey: undefined }) !== null;
    const ui = keyState(stored, next) === 'kept';
    n++;
    if (server !== ui && mism.length < 5) mism.push(`${provider} ${hasKey} ${stored.baseUrl} -> ${next.baseUrl}: server=${server} ui=${ui}`);
  }
  check(`UI keyState ≡ keyAfterUpdate на ${n} комбинациях`, mism.length === 0, mism.join(' | '));
  check('apiKey="" на сервере всегда сбрасывает ключ', keyAfterUpdate({ baseUrl: 'http://a:1/v1', apiKey: 'sk-test-OLD-1111' }, { provider: 'cloud', baseUrl: 'http://a:1/v1', apiKey: '' }) === null);
}

console.log('P4: key_required');
{
  for (const p of LLM_PRESETS) {
    check(`${p.name}: облако без ключа — требуется`, keyRequired(p.url));
    check(`${p.name}: с хвостом / и другим регистром`, keyRequired(p.url.replace('https://', 'HTTPS://').toUpperCase().replace('HTTPS', 'https') + '/'));
    check(`${p.name}: нет своего ключа и сохранён чужой — keyProblem`, keyProblem({ baseUrl: 'http://x:1/v1', hasKey: true }, { provider: 'cloud', baseUrl: p.url, apiKey: '' }) !== null);
    check(`${p.name}: свой ключ — проблемы нет`, keyProblem(null, { provider: 'cloud', baseUrl: p.url, apiKey: 'sk-test-NEW-2222' }) === null);
    check(`${p.name}: прежний ключ того же сервера — проблемы нет`, keyProblem({ baseUrl: p.url, hasKey: true }, { provider: 'cloud', baseUrl: p.url, apiKey: '' }) === null);
    check(`${p.name}: ключ из пробелов не считается ключом`, keyProblem(null, { provider: 'cloud', baseUrl: p.url, apiKey: '   ' }) !== null);
  }
  check('свой/самописный адрес без ключа — разрешён', !keyRequired('http://host.docker.internal:9912/v1'));
  check('Ollama локально без ключа — разрешена', keyProblem(null, { provider: 'ollama', baseUrl: 'http://host.docker.internal:11434/v1', apiKey: '' }) === null);
  check('адрес провайдера с точкой на конце и provider=ollama — требует ключ', !keyRequired('http://x') && keyRequired('https://api.openai.com./v1') && keyProblem(null, { provider: 'ollama', baseUrl: 'https://api.openai.com./v1', apiKey: '' }) !== null);
  check('сообщение key_required определено', typeof LLM_SETTINGS_MESSAGES.key_required === 'string' && LLM_SETTINGS_MESSAGES.key_required.length > 10);
  check('validateLlmSettingsInput принимает форму без ключа (ключ проверяет роут)', validateLlmSettingsInput({ provider: 'cloud', baseUrl: LLM_PRESETS[1].url, model: 'm' }).ok === true);
}

console.log('Черновик: готов ли протокол в истории');
{
  const empty = { complaints: '', anamnesisMorbi: '', anamnesisVitae: '', allergies: '', examination: '', diagnoses: '', medications: '', plan: '' };
  const stub = { ...empty, diagnoses: '(не сформировано)' };
  check('заглушка saveDraft — не протокол', !hasProtocolContent(stub));
  check('заглушка со стенограммой — не протокол', !hasProtocolContent({ ...stub, transcript: 'текст' }));
  check('все поля пустые — не протокол', !hasProtocolContent(empty));
  check('поля из пробелов — не протокол', !hasProtocolContent({ ...empty, complaints: '   ' }));
  check('пустой диагноз при заполненных жалобах — протокол', hasProtocolContent({ ...empty, complaints: 'Головная боль' }));
  check('короткий диагноз «I10» — протокол', hasProtocolContent({ ...empty, diagnoses: 'I10' }));
  check('заполнено только одно из прочих полей (план) — протокол', hasProtocolContent({ ...stub, plan: 'ОАК' }));
  check('null — не протокол', !hasProtocolContent(null));
  check('undefined — не протокол', !hasProtocolContent(undefined));
  check('строка — не протокол', !hasProtocolContent('Гипертония'));
  check('объект без полей — не протокол', !hasProtocolContent({}));
  check('нестроковые значения не падают', !hasProtocolContent({ complaints: 5, diagnoses: null }));
  check('заголовок: диагноз', draftTitle({ ...empty, diagnoses: 'I10' }) === 'I10');
  check('заголовок: пустой диагноз при протоколе', draftTitle({ ...empty, complaints: 'Кашель' }) === 'Протокол без диагноза');
  check('заголовок: заглушка при протоколе', draftTitle({ ...stub, plan: 'ОАК' }) === 'Протокол без диагноза');
  check('заголовок: заглушка без протокола', draftTitle(stub) === 'Протокол не сформирован');
  check('заголовок: null', draftTitle(null) === 'Протокол не сформирован');
}

console.log(bad === 0 ? '\nвсе проверки пройдены' : `\nПРОВАЛЕНО: ${bad}`);
process.exit(bad === 0 ? 0 : 1);
