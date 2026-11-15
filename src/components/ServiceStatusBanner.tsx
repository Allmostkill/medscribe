import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import type { ServiceHealth } from '../services/health';

export default function ServiceStatusBanner({ health, reachable }: {
  health: ServiceHealth | null;
  reachable: boolean;
}) {
  const items: { key: string; text: string; link?: string; to?: string }[] = [];

  if (!reachable) {
    items.push({
      key: 'offline',
      text: 'Нет связи с программой. Проверьте, что Docker Desktop запущен, и выполните docker compose up -d.',
    });
  } else if (health) {
    if (!health.db) {
      items.push({
        key: 'db',
        text: 'База данных не отвечает. Подождите минуту; если не прошло — смотрите инструкцию, раздел 9.',
      });
    }
    if (!health.tone) {
      items.push({
        key: 'tone',
        text: 'Модель распознавания речи ещё загружается или не запустилась (при первом запуске — до 20 минут). Пока она не готова, речь не превращается в текст.',
      });
    }
    if (!health.llm) {
      items.push({
        key: 'llm',
        text: 'Языковая модель не подключена: стенограмма будет, а протокола и подсказок — нет.',
        link: 'Подключить',
        to: '/profile?tab=ai',
      });
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 mb-4">
      <div className="space-y-2">
        {items.map(it => (
          <div key={it.key} className="flex items-start gap-2 text-warning-900 font-semibold text-[13px]">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              {it.text}
              {it.link && (
                <>
                  {' '}
                  <Link
                    to={it.to ?? '/profile?tab=ai'}
                    className="underline hover:text-warning-700"
                  >
                    {it.link}
                  </Link>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
