/**
 * Проверка деидентификации текста перед отправкой в модель.
 *
 *   npx tsx scripts/check-deidentify.ts
 *
 * Два свойства, и оба обязательны. (1) Имя, телефон, дата рождения, номер
 * документа НЕ доходят до промпта — в любом падеже и регистре, потому что
 * T-one отдаёт текст строчными. (2) После ответа модели всё возвращается на
 * место буква в букву: цитаты сверки протокола обязаны совпадать со
 * стенограммой дословно. Плюс медицинский текст рядом не должен страдать:
 * препараты, термины, дозы остаются как есть.
 *
 * И грубая проверка, что сама проводка на сервере (src/server) на месте: middleware,
 * скрытие в wrapUserContent, восстановление в llmGenerate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDeidentifier } from '../src/server/deidentify';

let bad = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(56)} ${detail}`);
};
const hides = (input: string, mustHide: string[], mustKeep: string[] = []) => {
  const d = createDeidentifier();
  const h = d.hide(input);
  for (const m of mustHide) check(`скрыто: «${m}»`, !h.includes(m), h.includes(m) ? `→ ${h}` : '');
  for (const k of mustKeep) check(`оставлено: «${k}»`, h.includes(k), h.includes(k) ? '' : `→ ${h}`);
  check(`круг замыкается: «${input.slice(0, 30)}…»`, d.restore(h) === input, d.restore(h) === input ? '' : `→ ${d.restore(h)}`);
  return { d, h };
};

console.log('— имена —');
hides('пациентка марина сергеевна петрова, 54 года, жалобы на боли', ['марина', 'сергеевна', 'петрова'], ['54 года', 'жалобы на боли']);
hides('Врач: Марину Сергеевну беспокоят головные боли. Пациент: да, у Марины давно.', ['Марину', 'Сергеевну', 'Марины'], ['головные боли']);
hides('Иванов Иван Иванович принимает бисопролол 5 мг', ['Иванов', 'Иван', 'Иванович'], ['бисопролол 5 мг']);
hides('к нам обратился магомед расулович, у него сахарный диабет', ['магомед', 'расулович'], ['сахарный диабет']);
hides('пришла патимат с дочкой айшат', ['патимат', 'айшат']);
hides('пациент гаджиев магомед расулович, сын гаджиева', ['гаджиев', 'гаджиева', 'магомед', 'расулович']);
hides('марина снова пришла, витамин д принимает, один раз в день', ['марина'], ['снова', 'витамин', 'один']);
hides('Пациент: меня зовут Ольга Черных, фамилия мужа Ткаченко', ['Ольга', 'Черных', 'Ткаченко']);

console.log('— омонимы: строчные слова остаются, заглавные имена скрываются —');
hides('у меня нет веры в лечение, надежда только на вас, роман читаю', [], ['веры', 'надежда', 'роман']);
hides('Пришла Вера с мужем Романом', ['Вера', 'Романом']);
hides('в костях ломота, кости болят, гена мутация, тема разговора', [], ['костях', 'кости', 'гена', 'тема']);

console.log('— препараты и термины не трогаем —');
hides('назначен лантус, регулон отменён, мирена стоит третий год, викторина', [], ['лантус', 'регулон', 'мирена', 'викторина']);
hides('аторвастатин 20 мг, креатинин 98 мкмоль/л, АД 140/90, температура 37,5', [], ['аторвастатин 20 мг', 'креатинин 98', '140/90', '37,5']);
hides('Марина Мирена Мария', ['Марина', 'Мария'], ['Мирена']);

console.log('— телефоны, даты, номера, почта —');
hides('телефон +7 (916) 123-45-67 или 89161234567, родилась 15.03.1987', ['916', '123-45-67', '89161234567', '15.03.1987']);
hides('дата рождения 3 марта 1987 года, снилс 123-456-789 01, полис 1234567890123456', ['3 марта 1987', '123-456-789 01', '1234567890123456']);
hides('пишите на ivanova.m@example.ru, паспорт 4510 123456', ['ivanova.m@example.ru', '4510 123456']);
hides('болеет с 2019 года, последний приступ 3 марта, курс 10 дней', [], ['2019 года', '3 марта', '10 дней']);

console.log('— одна сущность, разные формы —');
{
  const d = createDeidentifier();
  const h = d.hide('Марина пришла. Марину осмотрели. Марине назначили. Иван и Ивана.');
  const idx = [...h.matchAll(/\[ИМЯ (\d+)\.(\d+)\]/g)].map(m => `${m[1]}.${m[2]}`);
  check('падежи одного имени — один номер, разные формы', idx.slice(0, 3).every(i => i.startsWith('1.')) && new Set(idx.slice(0, 3)).size === 3, idx.join(' '));
  check('другое имя — другой номер', idx[3]?.startsWith('2.') === true, idx.join(' '));
  check('повтор той же формы — та же метка', d.hide('Марина').match(/\[ИМЯ 1\.1\]/) !== null, d.hide('Марина'));
}

console.log('— восстановление терпимо к модели —');
{
  const d = createDeidentifier();
  d.hide('Марина Сергеевна, телефон +7 916 123-45-67');
  check('метка без второго номера → первая форма', d.restore('пациентка [ИМЯ 1]') === 'пациентка Марина', d.restore('пациентка [ИМЯ 1]'));
  check('метка строчными и с пробелами', d.restore('[ имя 1.1 ] и [ имя 2 ]') === 'Марина и Сергеевна', d.restore('[ имя 1.1 ] и [ имя 2 ]'));
  check('телефон в ответе', d.restore('тел. [ТЕЛЕФОН 1.1]') === 'тел. +7 916 123-45-67');
  check('неизвестная метка не трогается', d.restore('[ИМЯ 9]') === '[ИМЯ 9]');
  check('метка внутри JSON-строки', d.restore('{"complaints":"[ИМЯ 1.1] жалуется"}') === '{"complaints":"Марина жалуется"}');
}

console.log('— проводка на сервере —');
{
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');
  const listTs = (dir: string): string[] => fs.readdirSync(path.join(root, dir), { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? listTs(`${dir}/${e.name}`) : e.name.endsWith('.ts') ? [`${dir}/${e.name}`] : []);
  check('middleware на каждый запрос', /deidContext\.run\(createDeidentifier\(\)/.test(read('src/server/app.ts')));
  check('wrapUserContent скрывает', /function wrapUserContent[\s\S]{0,400}\.hide\(/.test(read('src/server/ai/prompt.ts')));
  check('llmGenerate восстанавливает', /async function llmGenerate\([\s\S]{0,900}\.restore\(/.test(read('src/server/ai/llmGateway.ts')));
  const raw = listTs('src/server/routes').flatMap(f => read(f).match(/\$\{(transcript|patientContext|priorContext|noteBody|protocolText|templateBody)\}/g) ?? []);
  check('текст пациента не подставляется в промпт мимо ограждения', raw.length === 0, raw.join(', '));
}

console.log(bad ? `\nНЕСОВПАДЕНИЙ: ${bad}` : '\nдеидентификация работает как задумано');
process.exit(bad ? 1 : 0);
