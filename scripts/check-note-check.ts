/**
 * Проверка отбора результата сверки протокола со стенограммой.
 *
 *   tsx scripts/check-note-check.ts
 *
 * Сверка (/api/ai/note-check) подкладывает под каждое поле протокола цитаты,
 * на которых оно стоит, и перечисляет, что прозвучало, но выпало. Обе части
 * держатся на одном: цитата должна быть в стенограмме дословно. Модель, которую
 * попросили цитировать, регулярно цитирует «по смыслу», и такая цитата
 * подтверждает поле ровно так же убедительно, как настоящая, — а значит,
 * сверка начнёт врать в ту же сторону, что и протокол.
 *
 * Здесь гоняется НАСТОЯЩИЙ код отбора (src/server/ai/validate.ts), не переписанная копия.
 */
import { validateNoteCheck as validate } from '../src/server/ai/validate';

const transcript = [
  'Врач: Здравствуйте, что беспокоит?',
  'Пациент: Давит в груди при ходьбе, уже недели три. На пенициллин у меня аллергия, сыпь была.',
  'Врач: Какие препараты принимаете?',
  'Пациент: Бисопролол пять миллиграмм по утрам и ещё аторвастатин двадцать.',
  'Врач: Два года назад был инфаркт, так?',
  'Пациент: Да, стентировали.',
  'Врач: Назначаю нитроглицерин под язык при приступе.',
].join('\n');

const ehr = {
  complaints: 'Давящие боли за грудиной при ходьбе.',
  anamnesisMorbi: 'Боли около трёх недель.',
  anamnesisVitae: '',
  allergies: '',
  examination: 'Живот мягкий, безболезненный. Тоны сердца ритмичные.',
  diagnoses: 'ИБС, стенокардия напряжения.',
  medications: 'Бисопролол 5 мг утром, аторвастатин 20 мг.',
  plan: 'Нитроглицерин сублингвально при приступе.',
};

const goodSources = {
  complaints: ['Давит в груди при ходьбе'],
  anamnesisMorbi: ['уже недели три'],
  medications: ['Бисопролол пять миллиграмм по утрам и ещё аторвастатин двадцать'],
  plan: ['Назначаю нитроглицерин под язык при приступе'],
};
const goodOmission = {
  category: 'allergy', field: 'allergies',
  quote: 'На пенициллин у меня аллергия, сыпь была',
  why: 'Аллергия на пенициллин влияет на выбор антибиотика.',
  suggestion: 'Аллергия на пенициллин (сыпь).',
};

let bad = 0;
const check = (name, ok, detail = '') => {
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(50)} ${detail}`);
};

// ── Источники ──
{
  const r = validate({ sources: goodSources, omissions: [] }, transcript, ehr, false);
  check('дословная цитата подтверждает поле', r.sources.complaints.length === 1);
  check('цитата в другом регистре и с пунктуацией', validate({ sources: { complaints: ['ДАВИТ В ГРУДИ, ПРИ ХОДЬБЕ!'] } }, transcript, ehr, false).sources.complaints.length === 1);
  check('[выброс] пересказ по смыслу', validate({ sources: { complaints: ['пациент жалуется на боль в грудной клетке'] } }, transcript, ehr, false).sources.complaints.length === 0);
  check('[выброс] слишком короткая цитата', validate({ sources: { complaints: ['груди'] } }, transcript, ehr, false).sources.complaints.length === 0);
  check('поле с текстом без цитат → «нет опоры»', r.unsupported.includes('diagnoses') && r.unsupported.includes('examination'), r.unsupported.join(','));
  check('пустому полю опора не нужна', !r.unsupported.includes('allergies') && !r.unsupported.includes('anamnesisVitae'));
  check('поле с опорой не помечено', !r.unsupported.includes('complaints'));
  const dup = validate({ sources: { complaints: ['Давит в груди при ходьбе', 'давит в груди при ходьбе,', 'уже недели три'] } }, transcript, ehr, false);
  check('повтор с другим регистром — одна цитата', dup.sources.complaints.length === 2, String(dup.sources.complaints.length));
  const many = validate({ sources: { complaints: ['Давит в груди при ходьбе', 'уже недели три', 'Какие препараты принимаете', 'Да, стентировали'] } }, transcript, ehr, false);
  check('не больше трёх цитат', many.sources.complaints.length === 3, String(many.sources.complaints.length));
}

// ── Пропуски ──
{
  const keep = validate({ sources: {}, omissions: [goodOmission] }, transcript, ehr, false);
  check('пропуск с дословной цитатой принят', keep.omissions.length === 1);
  check('[выброс] выдуманная цитата', validate({ omissions: [{ ...goodOmission, quote: 'У меня тяжёлая аллергия на все антибиотики' }] }, transcript, ehr, false).omissions.length === 0);
  check('[выброс] пересказ по смыслу', validate({ omissions: [{ ...goodOmission, quote: 'пациент сообщил об аллергии на пенициллин' }] }, transcript, ehr, false).omissions.length === 0);
  check('[выброс] без объяснения', validate({ omissions: [{ ...goodOmission, why: '' }] }, transcript, ehr, false).omissions.length === 0);
  check('[выброс] без формулировки', validate({ omissions: [{ ...goodOmission, suggestion: '' }] }, transcript, ehr, false).omissions.length === 0);
  check('[выброс] неизвестное поле', validate({ omissions: [{ ...goodOmission, field: 'notes' }] }, transcript, ehr, false).omissions.length === 0);
  check('[выброс] формулировка уже в протоколе', validate({ omissions: [{ ...goodOmission, field: 'medications', quote: 'Бисопролол пять миллиграмм по утрам', suggestion: 'Бисопролол 5 мг утром' }] }, transcript, ehr, false).omissions.length === 0);
  check('неизвестная категория → «other»', validate({ omissions: [{ ...goodOmission, category: 'ВЫДУМАННАЯ' }] }, transcript, ehr, false).omissions[0]?.category === 'other');
  const cap = validate({ omissions: Array.from({ length: 12 }, () => ({ ...goodOmission })) }, transcript, ehr, false);
  check('не больше шести пропусков', cap.omissions.length === 6, String(cap.omissions.length));
  check('[выброс] не объект', validate({ omissions: ['строка'] }, transcript, ehr, false).omissions.length === 0);
}

// ── Дистанционный приём ──
{
  check('очный приём: осмотр не помечен', validate({}, transcript, ehr, false).remoteExam === false);
  check('дистанционный: «живот мягкий» помечен', validate({}, transcript, ehr, true).remoteExam === true);
  const video = { ...ehr, examination: 'На видео: кожные покровы обычной окраски. Со слов пациента: температура 37,4, давление 130/80.' };
  check('дистанционный: видимое и со слов — не помечено', validate({}, transcript, video, true).remoteExam === false);
  check('дистанционный: пустой осмотр — не помечен', validate({}, transcript, { ...ehr, examination: '' }, true).remoteExam === false);
}

// ── Контекст «Из МИС» ──
{
  const prior = 'Диагноз: ИБС, постинфарктный кардиосклероз (2024). Аллергия: пенициллин. Терапия: бисопролол 5 мг, аторвастатин 20 мг.';
  const withPrior = { ...ehr, anamnesisVitae: 'Постинфарктный кардиосклероз (по данным предыдущего приёма).' };
  const r = validate({ sources: {}, priorSources: { anamnesisVitae: ['постинфарктный кардиосклероз (2024)'] } }, transcript, withPrior, false, prior);
  check('цитата из МИС ложится в priorSources', r.priorSources.anamnesisVitae.length === 1 && r.sources.anamnesisVitae.length === 0);
  check('поле только на МИС — не «без опоры»', !r.unsupported.includes('anamnesisVitae'));
  const misplaced = validate({ sources: { anamnesisVitae: ['постинфарктный кардиосклероз (2024)'] } }, transcript, withPrior, false, prior);
  check('цитата из МИС, поданная как стенограмма, перекладывается', misplaced.priorSources.anamnesisVitae.length === 1 && misplaced.sources.anamnesisVitae.length === 0 && misplaced.rejectedSources === 0);
  const asTranscript = validate({ priorSources: { complaints: ['Давит в груди при ходьбе'] } }, transcript, ehr, false, prior);
  check('цитата стенограммы в priorSources — в sources', asTranscript.sources.complaints.length === 1 && asTranscript.priorSources.complaints.length === 0);
  const noPrior = validate({ priorSources: { anamnesisVitae: ['постинфарктный кардиосклероз (2024)'] } }, transcript, withPrior, false);
  check('[выброс] без контекста МИС цитата «из МИС» отброшена', noPrior.priorSources.anamnesisVitae.length === 0 && noPrior.unsupported.includes('anamnesisVitae') && noPrior.rejectedSources === 1);
  check('[выброс] пересказ МИС по смыслу', validate({ priorSources: { anamnesisVitae: ['перенёс инфаркт в 2024 году'] } }, transcript, withPrior, false, prior).priorSources.anamnesisVitae.length === 0);
  const omit = validate({ omissions: [{ ...goodOmission, quote: 'Аллергия: пенициллин' }] }, transcript, withPrior, false, prior);
  check('пропуск с цитатой только из МИС не принят', omit.omissions.length === 0);
}

console.log(bad ? `\nНЕСОВПАДЕНИЙ: ${bad}` : '\nотбор сверки работает как задумано');
process.exit(bad ? 1 : 0);
