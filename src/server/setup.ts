import crypto from "crypto";
import { TWO_FA_ENABLED } from "./config";
import { db } from "./context";

// ── Первый запуск ────────────────────────────────────────────────────────────
// Код живёт только в памяти процесса и печатается в журнал, пока аккаунта нет.
// 16 символов из 32-символьного алфавита без похожих знаков = 80 бит.
const SETUP_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789UL'; // 32 символа, без 0/O/1/I
function generateSetupToken(): string {
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += SETUP_ALPHABET[crypto.randomInt(SETUP_ALPHABET.length)];
    if (i % 4 === 3 && i < 15) out += '-';
  }
  return out;
}
let setupToken: string | null = generateSetupToken();

export function clearSetupToken(): void {
  setupToken = null;
}

function sha256(v: string): Buffer {
  return crypto.createHash('sha256').update(v).digest();
}

export function setupTokenMatches(given: unknown): boolean {
  if (!setupToken || typeof given !== 'string' || !given) return false;
  return crypto.timingSafeEqual(sha256(given.trim().toUpperCase()), sha256(setupToken));
}

/**
 * После listen: ждём ответа базы (до 5 минут, раз в 3 с). Нет врачей — печатаем
 * код первого запуска; есть — код не нужен. Заодно предупреждаем, если 2FA
 * выключена флагом, а у аккаунта она включена.
 */
export function announceSetupIfNeeded(): void {
  const startedAt = Date.now();
  let warned = false;
  const tick = async (): Promise<void> => {
    try {
      const { data, error } = await db.from('doctors')
        .select('id, is_two_factor_enabled').limit(1);
      if (error) throw error;
      if (!data || data.length === 0) {
        if (!setupToken) return;
        // на сервере за Caddy ссылка идёт на домен (PUBLIC_URL), иначе на localhost
        const publicUrl = (process.env.PUBLIC_URL || '').trim();
        const base = /^https?:\/\/[^/\s]+\/?$/.test(publicUrl)
          ? publicUrl.replace(/\/$/, '')
          : `http://localhost:${process.env.APP_PORT || 3000}`;
        console.log(`[MedScribe] Код первого запуска: ${setupToken}`);
        console.log(`[MedScribe] Откройте: ${base}/setup#token=${setupToken}`);
        return;
      }
      setupToken = null;
      if (!TWO_FA_ENABLED && data[0].is_two_factor_enabled) {
        console.warn('[MedScribe] ENABLE_2FA выключен, но у аккаунта включена 2FA — она продолжает действовать. Отключить: личный кабинет или npm run reset-password -- --disable-2fa');
      }
    } catch {
      // База ещё не готова: первые 5 минут проверяем раз в 3 с, дальше — раз в 15 с, без предела.
      const waited = Date.now() - startedAt;
      if (waited > 5 * 60 * 1000 && !warned) {
        warned = true;
        console.warn('[MedScribe] база данных пока недоступна — продолжаю ждать');
      }
      setTimeout(tick, waited > 5 * 60 * 1000 ? 15000 : 3000).unref();
    }
  };
  setTimeout(tick, 3000).unref();
}
