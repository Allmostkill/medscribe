/**
 * Выбор модели распознавания речи из личного кабинета: таблица stt_settings (одна строка).
 * Нет строки или база недоступна — T-one, он работает всегда.
 */
import { db } from '../context';
import { logWarn } from '../errors/logger';
import { safeErr } from '../logSafe';
import { isSttEngine, type SttEngine } from '../../utils/sttEngine';

// Без своего срока клиент базы при сбое повторяет запрос около 7 секунд.
const DB_TIMEOUT_MS = 1500;

// Один сбой чтения — одно предупреждение, пока база не ответит снова.
let failing = false;

const dbSignal = () => AbortSignal.timeout(DB_TIMEOUT_MS);

// Для кабинета: ok=false — выбор прочитать не удалось (показываем T-one и предупреждение).
export async function readSttEngine(): Promise<{ engine: SttEngine; ok: boolean }> {
  try {
    const { data, error } = await db.from('stt_settings').select('engine').eq('id', 1)
      .abortSignal(dbSignal()).maybeSingle();
    if (error) throw error;
    failing = false;
    return { engine: isSttEngine(data?.engine) ? data.engine : 'tone', ok: true };
  } catch (e) {
    if (!failing) logWarn('DB_013', safeErr(e));
    failing = true;
    return { engine: 'tone', ok: false };
  }
}

export async function loadSttEngine(): Promise<SttEngine> {
  return (await readSttEngine()).engine;
}

export async function saveSttEngine(engine: SttEngine): Promise<void> {
  const { error } = await db.from('stt_settings').upsert({
    id: 1, engine, updated_at: new Date().toISOString(),
  }).abortSignal(dbSignal());
  if (error) throw error;
}
