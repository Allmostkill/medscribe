/**
 * Проверка разбора разметки по голосу и сборки стенограммы по меткам.
 *
 *   tsx scripts/check-diarization.ts
 *
 * Ответ tone-сервиса приходит извне, поэтому разбор должен отбрасывать мусор и
 * не давать номерам спикеров «уехать»: «Спикер 3» у врача — это уже ложь в
 * протоколе. Сборка стенограммы по ролям не должна менять текст реплик.
 *
 * Здесь гоняется НАСТОЯЩИЙ код (src/utils/speakers.ts и src/server/ai/validate.ts),
 * не переписанная копия.
 */
import {
  toneToSegments, offsetSpeakers, normalizeLineSpeaker, isVoiceLabel, mergeSessionSegments, speakerLabel, toAnalyzeText, type SessionPart,
} from '../src/utils/speakers';
import {
  detectVoiceLabels, resolveSpeakerRoles, buildVoiceDiarizedTranscript, shouldUseVoiceMode,
} from '../src/server/ai/validate';

let bad = 0;
const check = (name, ok, detail = '') => {
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(56)} ${detail}`);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Разбор ответа tone ──
{
  const garbage = {
    diarization: 'ok',
    phrases: [
      { start: '1', end: 2, text: 'нечисловое начало' },
      { start: -1, end: 2, text: 'отрицательное начало' },
      { start: NaN, end: 2, text: 'NaN в начале' },
      { start: 0, text: 'нет конца' },
      { start: 0, end: 1, text: 42 },
      { start: 0, end: 1, text: '   ' },
      { start: 0, end: 1, text: 'пустой после обрезки пробелов' },
      null,
      'строка вместо объекта',
      { start: 3, end: 4, text: 'ok' },
    ],
  };
  const r = toneToSegments(garbage);
  check('мусорные поля отброшены, годная фраза осталась', r.segments.length === 2 && r.segments[1].text === 'ok', String(r.segments.length));
  check('пустые и нечисловые фразы не попадают', !r.segments.some(s => s.text === '' || s.start < 0 || Number.isNaN(s.start)));

  const empty = toneToSegments(null);
  check('ответ null → пусто и статус off', empty.segments.length === 0 && empty.diarization === 'off');

  const sp = (n) => toneToSegments({ diarization: 'ok', phrases: [{ start: 0, end: 1, text: 'а', speaker: n }] }).segments[0]?.speaker;
  check('speaker 1 → speaker_1', sp(1) === 'speaker_1');
  check('speaker 9 → speaker_9', sp(9) === 'speaker_9');
  check('speaker 0 → без метки', sp(0) === undefined);
  check('speaker 10 → без метки', sp(10) === undefined);
  check('speaker 1.5 → без метки', sp(1.5) === undefined);
  check('speaker "1" (строка) → без метки', sp('1') === undefined);

  const notOk = (status) => toneToSegments({ diarization: status, phrases: [{ start: 0, end: 1, text: 'а', speaker: 1 }] }).segments[0]?.speaker;
  check('статус single → метки убраны', notOk('single') === undefined);
  check('статус skipped → метки убраны', notOk('skipped') === undefined);
  check('статус failed → метки убраны', notOk('failed') === undefined);
  check('статус off → метки убраны', notOk('off') === undefined);

  const unknownStatus = toneToSegments({ diarization: 'что-то новое', phrases: [] });
  check('неизвестный статус → off', unknownStatus.diarization === 'off');
  check('нет статуса → off', toneToSegments({ phrases: [] }).diarization === 'off');
  check('статус ok сохраняется', toneToSegments({ diarization: 'ok', phrases: [] }).diarization === 'ok');

  const many = { diarization: 'off', phrases: Array.from({ length: 6000 }, (_, i) => ({ start: i, end: i + 1, text: 'х' })) };
  check('больше 5000 фраз — обрезка до 5000', toneToSegments(many).segments.length === 5000);

  const long = toneToSegments({ diarization: 'off', phrases: [{ start: 0, end: 1, text: 'а'.repeat(2500) }] });
  check('текст длиннее 2000 — обрезка до 2000', long.segments[0]?.text.length === 2000);
}

// ── Сквозная нумерация спикеров ──
{
  const segs = [
    { start: 0, end: 1, text: 'a', speaker: 'speaker_1' },
    { start: 1, end: 2, text: 'b', speaker: 'speaker_2' },
    { start: 2, end: 3, text: 'c' },
  ];
  const r = offsetSpeakers(segs, 2);
  check('сдвиг на 2: speaker_1/2 → speaker_3/4', r.segments[0].speaker === 'speaker_3' && r.segments[1].speaker === 'speaker_4');
  check('сдвиг: фраза без метки не меняется', r.segments[2].speaker === undefined);
  check('сдвиг: maxIndex = 4', r.maxIndex === 4, String(r.maxIndex));
  const none = offsetSpeakers([{ start: 0, end: 1, text: 'a' }], 2);
  check('без меток maxIndex = offset', none.maxIndex === 2, String(none.maxIndex));
  check('isVoiceLabel: speaker_3 да, speaker_x нет', isVoiceLabel('speaker_3') && !isVoiceLabel('speaker_x'));
}

// ── Роль строки для экрана ──
{
  check('doctor остаётся doctor', normalizeLineSpeaker('doctor') === 'doctor');
  check('patient остаётся patient', normalizeLineSpeaker('patient') === 'patient');
  check('speaker_3 остаётся speaker_3', normalizeLineSpeaker('speaker_3') === 'speaker_3');
  check('unknown остаётся unknown', normalizeLineSpeaker('unknown') === 'unknown');
  check('undefined → unknown (не doctor)', normalizeLineSpeaker(undefined) === 'unknown');
  check('speaker_x → unknown (не doctor)', normalizeLineSpeaker('speaker_x') === 'unknown');
  check('подпись unknown — «Не определён»', speakerLabel('unknown') === 'Не определён' && speakerLabel('speaker_2') === 'Спикер 2');
}

// ── Стенограмма по голосу ──
{
  const transcript = [
    '[speaker_1] Здравствуйте, что беспокоит?',
    '[speaker_2] Давит в груди.',
    '[speaker_2] Уже три недели.',
    '[speaker_1] Понятно.',
  ].join('\n');

  const ok = buildVoiceDiarizedTranscript(transcript, { speaker_1: 'doctor', speaker_2: 'patient' });
  check('роли есть: rolesOk = true', ok.rolesOk === true);
  check('роли: врач и пациент, реплики склеены', same(ok.lines, [
    { speaker: 'doctor', text: 'Здравствуйте, что беспокоит?' },
    { speaker: 'patient', text: 'Давит в груди. Уже три недели.' },
    { speaker: 'doctor', text: 'Понятно.' },
  ]), JSON.stringify(ok.lines));

  const noDoctor = buildVoiceDiarizedTranscript(transcript, { speaker_1: 'patient', speaker_2: 'patient' });
  check('без врача: rolesOk = false', noDoctor.rolesOk === false);
  check('без врача: метки speaker_N сохранены', noDoctor.lines.every(l => isVoiceLabel(l.speaker)) && noDoctor.lines[0].speaker === 'speaker_1');

  const emptyRoles = buildVoiceDiarizedTranscript(transcript, {});
  check('пустые роли: rolesOk = false, speaker_N', emptyRoles.rolesOk === false && emptyRoles.lines[0].speaker === 'speaker_1');

  const missing = buildVoiceDiarizedTranscript(transcript, { speaker_1: 'doctor' });
  check('метка без роли → other, speaker_2 сохранён', missing.rolesOk === true && missing.lines[1].speaker === 'speaker_2', JSON.stringify(missing.lines));

  const unk = buildVoiceDiarizedTranscript('[unknown] вступление\n[speaker_1] Здравствуйте\n[unknown] шум\nпродолжение без метки\n[speaker_2] Да', { speaker_1: 'doctor', speaker_2: 'patient' });
  check('[unknown] не приклеивается к соседям, безметочная строка — продолжение предыдущей', same(unk.lines, [
    { speaker: 'unknown', text: 'вступление' },
    { speaker: 'doctor', text: 'Здравствуйте' },
    { speaker: 'unknown', text: 'шум продолжение без метки' },
    { speaker: 'patient', text: 'Да' },
  ]), JSON.stringify(unk.lines));

  const merge = buildVoiceDiarizedTranscript('[speaker_1] А\n[speaker_3] Б\n[speaker_2] В', { speaker_1: 'doctor', speaker_2: 'patient', speaker_3: 'doctor' });
  check('соседние реплики одного участника склеены', same(merge.lines, [
    { speaker: 'doctor', text: 'А Б' },
    { speaker: 'patient', text: 'В' },
  ]), JSON.stringify(merge.lines));

  const other = buildVoiceDiarizedTranscript('[speaker_1] Врач\n[speaker_2] Мама\n[speaker_3] Пациент', { speaker_1: 'doctor', speaker_2: 'patient', speaker_3: 'other' });
  check('роль other → speaker_N на экране', other.lines[2].speaker === 'speaker_3');
}

// ── Метки и роли ──
{
  const labels = detectVoiceLabels('[speaker_2] a\n[speaker_1] b\n[speaker_2] c\n[unknown] d\n[speaker_10] e');
  check('detectVoiceLabels: порядок первого появления', same(labels, ['speaker_2', 'speaker_1', 'speaker_10']), labels.join(','));

  const r = resolveSpeakerRoles({ speaker_1: 'doctor', speaker_2: 'nurse', speaker_3: 42 }, ['speaker_1', 'speaker_2', 'speaker_3']);
  check('resolveSpeakerRoles: невалидные роли → other', r.roles.speaker_2 === 'other' && r.roles.speaker_3 === 'other', JSON.stringify(r.roles));
  check('resolveSpeakerRoles: врач и не-врач → ok', r.ok === true);
  check('resolveSpeakerRoles: null → ok = false', resolveSpeakerRoles(null, ['speaker_1']).ok === false);
  check('resolveSpeakerRoles: только врач → ok = false', resolveSpeakerRoles({ speaker_1: 'doctor' }, ['speaker_1']).ok === false);
}

// ── Фиксированные роли, хвосты и [unknown] ──
{
  const roles = { speaker_1: 'doctor', speaker_2: 'patient' };
  const fixed = buildVoiceDiarizedTranscript('[speaker_1] Здравствуйте\n[doctor] Ручная реплика\n[speaker_2] Давит\n[patient] Уже решено\n[speaker_1] Понятно', roles);
  check('[doctor]/[patient] — отдельные реплики с этой ролью', same(fixed.lines, [
    { speaker: 'doctor', text: 'Здравствуйте Ручная реплика' },
    { speaker: 'patient', text: 'Давит Уже решено' },
    { speaker: 'doctor', text: 'Понятно' },
  ]), JSON.stringify(fixed.lines));
  check('[doctor] не остаётся в тексте буквально', !fixed.lines.some(l => l.text.includes('[')));

  const fixedBad = buildVoiceDiarizedTranscript('[speaker_1] А\n[doctor] Б\n[speaker_2] В', {});
  check('роли негодные: [doctor] остаётся doctor, speaker_N сохранены', same(fixedBad.lines.map(l => l.speaker), ['speaker_1', 'doctor', 'speaker_2']), JSON.stringify(fixedBad.lines));

  const tail = buildVoiceDiarizedTranscript('[unknown] начало\n[unknown] ещё\n[speaker_1] Врач\n[speaker_2] Пациент\n[unknown] хвост 1\n[unknown] хвост 2', roles);
  check('[unknown] в начале и хвосте не примыкают к соседям', same(tail.lines, [
    { speaker: 'unknown', text: 'начало' },
    { speaker: 'unknown', text: 'ещё' },
    { speaker: 'doctor', text: 'Врач' },
    { speaker: 'patient', text: 'Пациент' },
    { speaker: 'unknown', text: 'хвост 1' },
    { speaker: 'unknown', text: 'хвост 2' },
  ]), JSON.stringify(tail.lines));

  const mid = buildVoiceDiarizedTranscript('[speaker_1] Какие лекарства принимаете?\n[unknown] Я принимаю препарат А.\n[unknown] В какой дозе?\n[unknown] По одной таблетке.\n[speaker_2] Спасибо.', roles);
  check('середина: три [unknown] остаются отдельными, текст и порядок целы', same(mid.lines, [
    { speaker: 'doctor', text: 'Какие лекарства принимаете?' },
    { speaker: 'unknown', text: 'Я принимаю препарат А.' },
    { speaker: 'unknown', text: 'В какой дозе?' },
    { speaker: 'unknown', text: 'По одной таблетке.' },
    { speaker: 'patient', text: 'Спасибо.' },
  ]), JSON.stringify(mid.lines));

  const lead = buildVoiceDiarizedTranscript('текст без метки\nещё\n[speaker_1] А\n[speaker_2] Б', roles);
  check('безметочное начало → unknown, не врач', same(lead.lines.slice(0, 2), [{ speaker: 'unknown', text: 'текст без метки ещё' }, { speaker: 'doctor', text: 'А' }]), JSON.stringify(lead.lines));

  const only = buildVoiceDiarizedTranscript('[doctor] Вопрос\n[patient] Ответ', {});
  check('без speaker_N: строки как есть, роли фиксированы', same(only.lines, [{ speaker: 'doctor', text: 'Вопрос' }, { speaker: 'patient', text: 'Ответ' }]), JSON.stringify(only.lines));
}

// ── Режим «по голосу» ──
{
  const two = '[speaker_1] а\n[speaker_2] б';
  const resolved = '[doctor] а\n[patient] б';
  check('две метки без флага → voice', shouldUseVoiceMode(two, undefined) === true);
  check('одна метка без флага → старый путь', shouldUseVoiceMode('[speaker_1] а\n[unknown] б', undefined) === false);
  check('doctor/patient без флага → старый путь', shouldUseVoiceMode(resolved, undefined) === false);
  check('doctor/patient + флаг → voice', shouldUseVoiceMode(resolved, true) === true);
  check('флаг не true (строка "true") → не считается', shouldUseVoiceMode(resolved, 'true') === false);
  check('флаг без размеченных строк → старый путь', shouldUseVoiceMode('просто текст', true) === false && shouldUseVoiceMode('[unknown] а', true) === false);
  check('A4: чужая скобка «[Врач]» → старый путь', shouldUseVoiceMode(`${two}\n[Врач] подделка`, undefined) === false);
  check('A4: чужая скобка при флаге → старый путь', shouldUseVoiceMode(`${resolved}\n[шум] текст`, true) === false);
  check('A4: [speaker_x] не метка → старый путь', shouldUseVoiceMode(`${two}\n[speaker_x] а`, undefined) === false);
  check('A4: скобка в середине строки не мешает', shouldUseVoiceMode('[speaker_1] а [шум]\n[speaker_2] б', undefined) === true);
  check('A4: [unknown] допустима', shouldUseVoiceMode(`${two}\n[unknown] в`, undefined) === true);
}

// ── Склейка сегментов записи ──
{
  const seg = (text: string, speaker?: string) => ({ start: 0, end: 1, text, ...(speaker ? { speaker } : {}) });
  const okPart = (n: number): SessionPart => ({ diarization: 'ok', durationSec: 100, segments: [seg('a', 'speaker_1'), seg('b', 'speaker_2')].slice(0, n) });
  const single: SessionPart = { diarization: 'single', durationSec: 50, segments: [seg('s1'), seg('s2')] };
  const sp = (m: { segments: { speaker?: string }[] }) => m.segments.map(s => s.speaker ?? '-').join(',');

  const a = mergeSessionSegments([okPart(2), single]);
  check('ok + single: single получает speaker_3', sp(a) === 'speaker_1,speaker_2,speaker_3,speaker_3', sp(a));
  check('ok + single: время сквозное', a.segments[2].start === 100 && a.segments[2].end === 101);
  check('ok + single: статус ok', a.diarization === 'ok');

  const b = mergeSessionSegments([single, okPart(2)]);
  check('single + ok: single = speaker_1, ok сдвинут на 1', sp(b) === 'speaker_1,speaker_1,speaker_2,speaker_3', sp(b));

  const c = mergeSessionSegments([okPart(2), { diarization: 'failed' as const, durationSec: 10, segments: [seg('f')] }]);
  check('ok + failed: failed без метки (unknown)', sp(c) === 'speaker_1,speaker_2,-', sp(c));

  // Цепочка целиком: склейка → текст для analyze → сборка стенограммы. Роли — как вернула бы модель.
  // stepMs — как у Dashboard: 1 с между строками (первый проход) или 0 (все new Date()).
  const chain = (m: ReturnType<typeof mergeSessionSegments>, stepMs = 1000) => {
    const t0 = Date.parse('2026-01-01T10:00:00Z');
    const lines = m.segments.map((s, i) => ({ speaker: s.speaker ?? 'unknown', text: s.text, timestamp: new Date(t0 + i * stepMs) }));
    const text = toAnalyzeText(lines);
    return { text, out: buildVoiceDiarizedTranscript(text, { speaker_1: 'doctor', speaker_2: 'patient' }) };
  };
  const failedPart = { diarization: 'failed' as const, durationSec: 10, segments: [seg('Что принимаете'), seg('Аспирин')] };
  const okFailed = chain(mergeSessionSegments([okPart(2), failedPart]));
  check('ok + failed: текст для analyze содержит [unknown]', okFailed.text.includes('[unknown] Что принимаете'), okFailed.text);
  check('ok + failed: неразмеченный диалог не подписан врачом/пациентом', same(okFailed.out.lines, [
    { speaker: 'doctor', text: 'a' }, { speaker: 'patient', text: 'b' },
    { speaker: 'unknown', text: 'Что принимаете' }, { speaker: 'unknown', text: 'Аспирин' },
  ]), JSON.stringify(okFailed.out.lines));
  const okFailed0 = chain(mergeSessionSegments([okPart(2), failedPart]), 0);
  check('ok + failed, одинаковые времена: вопрос и ответ не склеены', same(okFailed0.out.lines.slice(2), okFailed.out.lines.slice(2)), JSON.stringify(okFailed0.out.lines));
  const rawLive = toAnalyzeText([0, 1].map(i => ({ speaker: 'unknown', text: i ? 'ещё' : 'начало', timestamp: new Date(1000 * i) })));
  check('полностью неразмеченная живая стенограмма по-прежнему склеивается', rawLive === '[unknown] начало ещё', rawLive);
  const okSkipped = chain(mergeSessionSegments([okPart(2), { diarization: 'skipped' as const, durationSec: 10, segments: [seg('Хвост')] }]));
  check('ok + skipped: хвост остаётся unknown', same(okSkipped.out.lines.map(l => l.speaker), ['doctor', 'patient', 'unknown']), JSON.stringify(okSkipped.out.lines));
  const again = chain({ segments: okFailed.out.lines.map(l => ({ start: 0, end: 1, text: l.text, speaker: l.speaker === 'unknown' ? undefined : l.speaker })) }, 0);
  check('повторный разбор: тот же результат, unknown не стал врачом', same(again.out.lines, okFailed.out.lines), JSON.stringify(again.out.lines));

  const d = mergeSessionSegments([okPart(2), okPart(2)]);
  check('ok + ok: номера сквозные', sp(d) === 'speaker_1,speaker_2,speaker_3,speaker_4', sp(d));
  check('ok + ok: время второго сегмента сдвинуто', d.segments[2].start === 100);

  const e = mergeSessionSegments([single, { diarization: 'skipped' as const, durationSec: 5, segments: [seg('k')] }]);
  check('нет ok: меток нет вообще', sp(e) === '-,-,-' && e.diarization === 'single', sp(e));

  const f = mergeSessionSegments([okPart(2), { diarization: 'skipped' as const, durationSec: 5, segments: [] }, single]);
  check('пустой пропущенный сегмент не съедает номер', sp(f) === 'speaker_1,speaker_2,speaker_3,speaker_3', sp(f));
}

console.log(bad ? `\nНЕСОВПАДЕНИЙ: ${bad}` : '\nразметка по голосу работает как задумано');
process.exit(bad ? 1 : 0);
