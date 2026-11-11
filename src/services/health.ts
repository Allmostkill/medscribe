import { useEffect, useState } from 'react';

export interface ServiceHealth { llm: boolean; tone: boolean; db: boolean }

const OK_INTERVAL_MS = 60_000;
const RETRY_INTERVAL_MS = 15_000;
const TIMEOUT_MS = 5_000;

/**
 * Состояние сервисов программы (GET /api/health). Опрашивает раз в минуту,
 * а пока что-то не готово или связи нет — раз в 15 секунд.
 */
export function useServiceHealth(): { health: ServiceHealth | null; reachable: boolean } {
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      let next = RETRY_INTERVAL_MS;
      try {
        const res = await fetch('/api/health', { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        const h: ServiceHealth = { llm: !!body.llm, tone: !!body.tone, db: !!body.db };
        if (cancelled) return;
        setHealth(h);
        setReachable(true);
        if (h.llm && h.tone && h.db) next = OK_INTERVAL_MS;
      } catch {
        if (cancelled) return;
        setReachable(false);
      }
      if (!cancelled) timer = setTimeout(poll, next);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return { health, reachable };
}
