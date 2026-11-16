// Для логов: только код/имя ошибки и HTTP-статус. Тело и message не пишем —
// в них бывают email врача и фрагменты запросов.
export function safeErr(e: any): string {
  const tag = e?.code || e?.name || 'Error';
  const status = e?.status ?? e?.statusCode;
  return status ? `${tag} (HTTP ${status})` : String(tag);
}

// Причины отбраковки для лога: только категории и счётчики. В строках dropped
// после «…» стоит цитата модели (возможны ФИО и клинические факты) — в лог её нельзя.
export function summarizeDropReasons(dropped: string[]): string {
  const counts = new Map<string, number>();
  for (const d of dropped) {
    const reason = d.split('«')[0].trim() || 'прочее';
    counts.set(reason, (counts.get(reason) || 0) + 1);
  }
  return [...counts].map(([r, n]) => `${r} x${n}`).join('; ');
}
