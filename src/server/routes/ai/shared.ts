import express from "express";
import { rateLimit } from "../../middleware/rateLimit";
import { LlmError, llmErrorMessage } from "../../llm";

// ── AI rate limits ────────────────────────────────────────────────────────
// Один общий лимит на IP для всех ИИ-маршрутов: запросы к модели могут быть платными
// у провайдера. 45 в минуту с запасом хватает на обычный приём; подсказки,
// разбор общения и предложение диагноза опрашиваются периодически и делят этот лимит.
export const aiRateLimit = rateLimit(45, 60 * 1000);

// Ответ на сбой ИИ-маршрута: ошибки модели получают понятную причину и код
// (llm_*), остальное — прежний текст маршрута. extra (hints: [] и т. п.) сохраняется.
export function sendAiError(res: express.Response, err: unknown, fallback: string, extra: Record<string, unknown> = {}): void {
  if (err instanceof LlmError) {
    res.status(err.code === 'not_configured' ? 503 : 502)
      .json({ ...extra, error: llmErrorMessage(err.code), code: `llm_${err.code}` });
    return;
  }
  // JSON.parse ответа модели: SyntaxError (текст ошибки не логируем и не отдаём — там может быть кусок ответа).
  if (err instanceof SyntaxError) {
    res.status(502).json({ ...extra, error: llmErrorMessage('bad_json'), code: 'llm_bad_json' });
    return;
  }
  res.status(500).json({ ...extra, error: fallback });
}
