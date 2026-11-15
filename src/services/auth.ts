/**
 * Auth session helper — единая точка для хранения и обновления сессии.
 *
 * Что хранится в localStorage "medscribe_session":
 *   {
 *     token: string,              // access JWT (8h)
 *     expiresAt: number,          // ms epoch
 *     refreshToken?: string,      // opaque (30d), может отсутствовать в старых сессиях
 *     refreshExpiresAt?: number,  // ms epoch
 *     doctor: { id, name, ... }
 *   }
 *
 * Использование:
 *   • ensureValidSession() — на маунте приложения. Если access токен ещё жив
 *     (с запасом 60с) — возвращает его. Если протух, но есть свежий refresh —
 *     дёргает /api/auth/refresh и обновляет localStorage. Иначе возвращает
 *     null (значит логин нужен).
 *   • saveSession() — после успешного логина/первичной настройки.
 *   • logout() — отзывает refresh на сервере + чистит localStorage.
 */

export type StoredSession = {
  token: string;
  expiresAt: number;
  refreshToken?: string;
  refreshExpiresAt?: number;
  doctor: {
    id: string;
    email: string;
    name: string;
    specialtyId: string;
    experienceYears: number;
    protocolTemplate?: string;
    isTwoFactorEnabled?: boolean;
  };
};

const KEY = 'medscribe_session';

/** Read whatever is in localStorage (no validation). */
export function getStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

/** Persist a session returned by the server. */
export function saveSession(payload: {
  token: string;
  expiresInSeconds: number;
  refreshToken?: string;
  refreshExpiresInSeconds?: number;
  doctor: StoredSession['doctor'];
}) {
  const now = Date.now();
  const session: StoredSession = {
    token: payload.token,
    expiresAt: now + payload.expiresInSeconds * 1000,
    refreshToken: payload.refreshToken,
    refreshExpiresAt: payload.refreshExpiresInSeconds
      ? now + payload.refreshExpiresInSeconds * 1000
      : undefined,
    doctor: payload.doctor,
  };
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

const REFRESH_TIMEOUT_MS = 15_000;

/**
 * Try to exchange the refresh token for a new session. Returns the new
 * session, or null when a login is really needed (сервер отказал — refresh
 * истёк/отозван — или врач вышел). Временный сбой (сеть, таймаут, 5xx, 429)
 * сессию не трогает: возвращаем текущую запись, access в ней может быть
 * просроченным — следующий вызов попробует обновить снова.
 */
async function refreshSession(refreshToken: string): Promise<StoredSession | null> {
  // Хранилище всё ещё держит тот refresh, с которым мы ушли? Нет — вышли из
  // программы или другая вкладка уже обновила пару: затирать её нельзя.
  const storageMoved = () => getStoredSession()?.refreshToken !== refreshToken;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      // Отказ сервера. Если другая вкладка успела обновить пару (ротация), в
      // хранилище уже новый refresh — отдаём её сессию, а не выкидываем врача.
      if (storageMoved()) return getStoredSession();
      clearSession();
      return null;
    }
    if (!res.ok) return getStoredSession();
    const data = await res.json();
    if (!data?.token || !data?.doctor) return getStoredSession();
    // Ответ пришёл после выхода (или после обновления в другой вкладке) — не оживляем сессию.
    if (storageMoved()) return getStoredSession();
    saveSession({
      token: data.token,
      expiresInSeconds: data.expiresInSeconds,
      refreshToken: data.refreshToken,
      refreshExpiresInSeconds: data.refreshExpiresInSeconds,
      doctor: data.doctor,
    });
    return getStoredSession();
  } catch {
    return getStoredSession();
  }
}

/**
 * Main entry. Returns a valid session or null (caller should redirect to login).
 *
 * Strategy:
 *   1. Read what's in localStorage.
 *   2. If access JWT still has > 60s of life — return it as-is.
 *   3. Otherwise, if there's a non-expired refresh token — try to refresh.
 *   4. Otherwise, give up and clear the session.
 * Временный сбой обновления (нет сети, 5xx) сессию не стирает — см. refreshSession.
 */
// Один общий refresh на вкладку: ротация refresh-токена отвечает 401 второму
// одновременному запросу, и clearSession выкинул бы врача из программы.
let refreshInFlight: Promise<StoredSession | null> | null = null;

export async function ensureValidSession(): Promise<StoredSession | null> {
  const existing = getStoredSession();
  if (!existing) return null;

  const now = Date.now();
  const accessOk = existing.token && existing.expiresAt - now > 60_000;
  if (accessOk) return existing;

  // Access токен мёртв или вот-вот умрёт — пробуем refresh
  if (existing.refreshToken && (!existing.refreshExpiresAt || existing.refreshExpiresAt > now)) {
    if (!refreshInFlight) {
      const p: Promise<StoredSession | null> = refreshSession(existing.refreshToken).finally(() => {
        if (refreshInFlight === p) refreshInFlight = null;
      });
      refreshInFlight = p;
    }
    // null здесь — сервер отказал (сессия уже стёрта) или врач вышел: чистить ещё раз не нужно
    return await refreshInFlight;
  }

  // Refresh нет или протух → чистим, пусть логинятся заново
  clearSession();
  return null;
}

/** Logout — revoke refresh on server, clear local storage. */
export async function logout(): Promise<void> {
  // Новый вход не должен подхватить refresh, начатый до выхода.
  refreshInFlight = null;
  const session = getStoredSession();
  if (session?.refreshToken) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    } catch { /* offline — pas grave, локально всё равно чистим */ }
  }
  clearSession();
}
