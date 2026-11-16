// Разбор раздела «Критерии оценки качества медицинской помощи» клинической
// рекомендации в плоский список.
//
// Зачем. Этот раздел — дословно то, по чему страховая проверяет случай. Врачу
// он нужен не как страница документа, а как чек-лист: что из перечисленного в
// приёме сделано, а что нет.
//
// Почему разбор не сводится к «взять первую колонку как номер». На выборке из
// 36 документов встретились три разные вёрстки:
//   • «№ | Критерии качества | Оценка выполнения» — обычный случай;
//   • «Критерии качества | Критерии оценки» — номера нет вообще, текст в
//     первой колонке;
//   • номер сделан вордовским автосписком <ol><li>&nbsp;</li></ol>, то есть
//     в ячейке пусто, а число рисует браузер.
// Поэтому колонка с текстом ищется по шапке таблицы, а не по позиции.
//
// Четвёртый случай не лечится: у части документов раздел — просто картинка
// (base64 на сотню килобайт), разбирать там нечего. Тогда возвращается пустой
// список, и вызывающий код обязан показать исходный раздел как есть. Показать
// врачу оригинал честнее, чем уверенно показать неполный чек-лист:
// недостающий пункт здесь стоит денег.

export interface QualityCriterion {
  n: string;
  text: string;
  /** Номера в документе не было — проставлен по порядку следования строк. */
  autoNumbered?: boolean;
}

export function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/\s+/g, ' ')
    .trim();
}

const cellsOf = (row: string): string[] =>
  [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => stripTags(m[1]));

/**
 * Ищет в шапке колонку с текстом критерия и колонку с номером.
 * Возвращает null, если таблица на критерии не похожа — тогда это соседняя
 * таблица организационных условий, и трогать её не надо.
 */
function locateColumns(header: string[]): { textCol: number; numCol: number | null } | null {
  const numCol = header.findIndex(h => /^№/.test(h));

  // «Критерии качества» — именно то, что перечисляет проверяемые действия.
  // Соседняя «Критерии оценки» содержит «Да/нет» и текстом критерия не является.
  let textCol = header.findIndex(h => /критери\w*\s+качеств/i.test(h));
  if (textCol < 0) textCol = header.findIndex(h => /критери/i.test(h) && !/оценк|выполнен/i.test(h));
  if (textCol < 0 && numCol >= 0 && header.length > numCol + 1) textCol = numCol + 1;
  if (textCol < 0) return null;

  return { textCol, numCol: numCol >= 0 ? numCol : null };
}

export function parseCriteria(html: string): QualityCriterion[] {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const out: QualityCriterion[] = [];
  const seen = new Set<string>();

  for (const table of tables) {
    const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    if (rows.length < 2) continue;

    const cols = locateColumns(cellsOf(rows[0]));
    if (!cols) continue;

    let auto = 0;
    for (const row of rows.slice(1)) {
      const cells = cellsOf(row);
      if (cells.length <= cols.textCol) continue;

      const text = cells[cols.textCol];
      if (text.length < 4) continue;
      // Строка-подзаголовок внутри таблицы повторяет шапку — она не критерий.
      if (/^критери/i.test(text)) continue;

      const raw = cols.numCol !== null ? (cells[cols.numCol] || '').replace(/\.$/, '').trim() : '';
      const numbered = /^\d{1,3}$/.test(raw);
      const n = numbered ? raw : String(++auto);

      const key = `${n}|${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(numbered ? { n, text } : { n, text, autoNumbered: true });
    }
  }
  return out;
}
