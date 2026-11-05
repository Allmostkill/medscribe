#!/usr/bin/env node
/**
 * Перепись качества по строкам [quality] из логов приложения.
 *
 *   node scripts/quality-report.mjs [дней=30]     (на сервере: cd medscribe)
 *
 * В логе — только числа и имена полей, никакого содержимого приёмов. Отчёт
 * отвечает на вопросы, на которые до этого отвечало ощущение врача:
 * - как часто модель цитирует «по смыслу» (rejectedSources) — если это
 *   большинство, сверка честно, но бесполезно красит все поля в «без опоры»;
 * - какие поля протокола чаще всего без опоры в стенограмме;
 * - что чаще выпадает из протокола — аллергии, препараты, диагнозы, сроки;
 * - сколько раз дистанционный приём получил осмотр, которого не было;
 * - сколько имён/телефонов/дат ушло бы в модель без деидентификации.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const days = Number(process.argv[2] ?? 30);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const since = Date.now() - days * 86_400_000;
const files = fs.existsSync(path.join(ROOT, 'logs'))
  ? fs.readdirSync(path.join(ROOT, 'logs')).filter(f => /^app-\d{4}-\d{2}-\d{2}\.log$/.test(f))
      .filter(f => new Date(f.slice(4, 14)).getTime() >= since - 86_400_000)
  : [];

const kv = line => Object.fromEntries([...line.matchAll(/(\w+)=(\S+)/g)].map(m => [m[1], m[2]]));
const count = (map, key, n = 1) => map.set(key, (map.get(key) ?? 0) + n);

const note = { n: 0, fields: 0, unsupported: new Map(), omissions: new Map(), rejected: 0, droppedOmissions: 0, remote: 0, remoteExam: 0, clean: 0, prior: 0, priorOnly: 0 };
const analyze = { n: 0, prior: 0, priorChars: 0, template: 0, remote: 0 };
const comm = { n: 0, notes: 0, dropped: 0 };
const deid = { n: 0, names: 0, phones: 0, dates: 0, numbers: 0, emails: 0 };
const byDay = new Map();

for (const f of files) {
  for (const line of fs.readFileSync(path.join(ROOT, 'logs', f), 'utf8').split('\n')) {
    if (!line.includes('[quality]')) continue;
    const day = f.slice(4, 14);
    const d = kv(line);
    if (line.includes('note-check')) {
      note.n++; count(byDay, day);
      note.fields += Number(d.fields ?? 0);
      note.rejected += Number(d.rejectedSources ?? 0);
      note.droppedOmissions += Number(d.droppedOmissions ?? 0);
      note.remote += Number(d.remote ?? 0);
      note.remoteExam += Number(d.remoteExam ?? 0);
      note.prior += Number(d.prior ?? 0);
      note.priorOnly += Number(d.priorOnly ?? 0);
      const uns = d.unsupported === '-' ? [] : (d.unsupported ?? '').split(',');
      if (!uns.length && (d.omissions === '-' || !d.omissions)) note.clean++;
      for (const u of uns) count(note.unsupported, u);
      if (d.omissions && d.omissions !== '-') for (const o of d.omissions.split(',')) count(note.omissions, o);
    } else if (line.includes('analyze')) {
      analyze.n++; analyze.prior += Number(d.prior ?? 0); analyze.priorChars += Number(d.priorChars ?? 0);
      analyze.template += Number(d.template ?? 0); analyze.remote += Number(d.remote ?? 0);
    } else if (line.includes('communication')) {
      comm.n++; comm.notes += Number(d.notes ?? 0); comm.dropped += Number(d.dropped ?? 0);
    } else if (line.includes('deid')) {
      deid.n++; for (const k of ['names', 'phones', 'dates', 'numbers', 'emails']) deid[k] += Number(d[k] ?? 0);
    }
  }
}

const pct = (a, b) => (b ? `${Math.round(100 * a / b)}%` : '—');
const top = map => [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '—';

console.log(`Перепись качества за ${days} дн. (файлов лога: ${files.length})\n`);
console.log(`Сверка протокола: ${note.n} приёмов`);
if (note.n) {
  const totalUns = [...note.unsupported.values()].reduce((a, b) => a + b, 0);
  console.log(`  полей без опоры:        ${pct(totalUns, note.fields)} от заполненных (${totalUns} из ${note.fields})`);
  console.log(`  чаще всего без опоры:   ${top(note.unsupported)}`);
  console.log(`  пропуски по категориям: ${top(note.omissions)}`);
  console.log(`  чистых протоколов:      ${pct(note.clean, note.n)} (ни поля без опоры, ни пропуска)`);
  console.log(`  цитаты «по смыслу»:     ${note.rejected} отброшено сервером (в среднем ${(note.rejected / note.n).toFixed(1)} на приём)`);
  console.log(`  пропуски-выдумки:       ${note.droppedOmissions} отброшено`);
  console.log(`  дистанционных приёмов:  ${note.remote}, из них с осмотром в протоколе: ${note.remoteExam}`);
  console.log(`  с контекстом из МИС:    ${note.prior}, полей только на МИС: ${note.priorOnly} (много — модель тащит прошлый визит в протокол)`);
  console.log(`  по дням:                ${[...byDay.entries()].sort().map(([d, n]) => `${d.slice(5)}:${n}`).join(' ')}`);
}
console.log(`\nСборка протокола: ${analyze.n} вызовов — с контекстом из МИС ${analyze.prior}${analyze.prior ? ` (в среднем ${Math.round(analyze.priorChars / analyze.prior)} зн.)` : ''}, по личному шаблону ${analyze.template}, дистанционных ${analyze.remote}`);
console.log(`\nРазбор общения: ${comm.n} запросов, пунктов ${comm.notes}, отброшено ${comm.dropped}`);
console.log(`\nДеидентификация: ${deid.n} вызовов модели с находками — имён ${deid.names}, телефонов ${deid.phones}, дат ${deid.dates}, номеров ${deid.numbers}, почт ${deid.emails}`);
