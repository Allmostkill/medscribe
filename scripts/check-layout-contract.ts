/**
 * Сверка контракта раскладки рабочего поля между клиентом и сервером.
 *
 *   tsx scripts/check-layout-contract.ts
 *
 * Типы блоков перечислены дважды: объединением BlockType в
 * src/config/workspace.ts и списком-разрешением ALLOWED_BLOCK_TYPES в
 * src/server/workspaceLayout.ts. Ничто их не связывает, и разойтись они могут молча.
 *
 * Так и вышло, когда четыре справочных блока слили в один блок с вкладками:
 * на клиенте появился тип 'reference', на сервере — нет. Дальше каждая
 * раскладка отвергалась с 400 «Некорректная раскладка», а клиент ответ не
 * проверял. Внешне это выглядело как «плитки не сохраняются»: врач двигал
 * блоки, видел «Сохранение…», а после перезагрузки всё возвращалось. Ни
 * сборка, ни типы этого поймать не могли — обе стороны по отдельности
 * совершенно корректны.
 *
 * То же и со списком вкладок справочника: ReferenceTab на клиенте и
 * проверка referenceTab на сервере.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_LAYOUT } from '../src/config/workspace';
import { ALLOWED_BLOCK_TYPES, ALLOWED_REFERENCE_TABS, isValidWorkspaceLayout as isValid } from '../src/server/workspaceLayout';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const problems: string[] = [];

/** Значения строкового union: `export type X = 'a' | 'b';` */
function unionValues(src: string, name: string): string[] | null {
  const m = src.match(new RegExp(`export type ${name} =([\\s\\S]*?);`));
  if (!m) return null;
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
}

const workspace = read('src/config/workspace.ts');

const clientTypes = unionValues(workspace, 'BlockType');
const serverTypes: string[] = [...ALLOWED_BLOCK_TYPES];
const clientTabs = unionValues(workspace, 'ReferenceTab');
const serverTabs: string[] = [...ALLOWED_REFERENCE_TABS];

const compare = (what: string, client: string[] | null, server: string[] | null, note?: string) => {
  if (!client || !server) { problems.push(`${what}: не удалось разобрать список (клиент: ${!!client}, сервер: ${!!server})`); return; }
  const missing = client.filter(v => !server.includes(v));
  if (missing.length) problems.push(`${what}: сервер отвергнет ${missing.map(v => `'${v}'`).join(', ')} — клиент их отправляет${note ? `\n    ${note}` : ''}`);
  // Обратное расхождение — не ошибка: устаревшие значения сервер принимает
  // намеренно, ради вкладок со старым закэшированным бандлом.
};

compare('типы блоков', clientTypes, serverTypes,
  'каждая раскладка с таким блоком получит 400 и не сохранится');
compare('вкладки справочника', clientTabs, serverTabs);

console.log(`типы блоков      — клиент: ${clientTypes?.join(', ') ?? '?'}`);
console.log(`                   сервер: ${serverTypes?.join(', ') ?? '?'}`);
console.log(`вкладки          — клиент: ${clientTabs?.join(', ') ?? '?'}`);
console.log(`                   сервер: ${serverTabs?.join(', ') ?? '?'}`);

// ── прогон настоящего валидатора на настоящих раскладках ──────────────────
//
// Сверки списков мало: отвергнуть раскладку может любое другое правило
// валидатора. Поэтому гоняем сам isValidWorkspaceLayout и настоящий
// DEFAULT_LAYOUT, а не переписанные копии.
{
  const cases: [string, unknown, boolean][] = [
    ['раскладка по умолчанию', DEFAULT_LAYOUT, true],
    ['после перетаскивания плиток', DEFAULT_LAYOUT.map((b, i) => ({ ...b, layout: { ...b.layout, x: (i * 2) % 8, y: i * 3 } })), true],
    ['со скрытым блоком', DEFAULT_LAYOUT.map((b, i) => (i === 0 ? { ...b, visible: false } : b)), true],
    ['с открытой вкладкой справочника', DEFAULT_LAYOUT.map(b => (b.type === 'reference' ? { ...b, referenceTab: 'dosageCalc' } : b)), true],
    ['с виджетом врача', [...DEFAULT_LAYOUT, { id: 'custom-1', type: 'custom', visible: true, layout: { x: 0, y: 20, w: 3, h: 4 }, customConfig: { title: 'Мой чек-лист', kind: 'checklist', items: [{ id: 'a', label: 'пункт' }] } }], true],
    ['неизвестный тип блока', DEFAULT_LAYOUT.map((b, i) => (i === 0 ? { ...b, type: 'whatever' } : b)), false],
    ['чужая вкладка справочника', DEFAULT_LAYOUT.map(b => (b.type === 'reference' ? { ...b, referenceTab: 'nope' } : b)), false],
  ];
  console.log();
  for (const [name, layout, want] of cases) {
    const got = isValid(layout);
    console.log(`  ${got === want ? '✓' : '✗'} ${name.padEnd(34)} ${got ? 'принято' : 'отвергнуто'}`);
    if (got !== want) problems.push(`валидатор: «${name}» ${got ? 'принято' : 'отвергнуто'}, а должно быть наоборот`);
  }
}

if (problems.length) {
  console.log(`\nпроблемы (${problems.length}):`);
  for (const p of problems) console.log('  · ' + p);
  process.exit(1);
}
console.log('\nконтракт раскладки сходится');
