import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useBlockDensity } from "./blockDensity";

interface BlockShellProps {
  /** Иконка слева от названия. У стенограммы её нет — заголовок без иконки. */
  icon?: LucideIcon;
  /**
   * Название блока. Без него шапки нет вовсе: так устроен блок чек-листа —
   * ChecklistPanel рисует собственную шапку с прогрессом, вторая была бы лишней.
   */
  title?: string;
  /** Правая часть шапки: «Обновить», «Изменить», чип прогресса. */
  actions?: ReactNode;
  /** Danger preserves safety semantics; assistant uses the soft brand surface. */
  tone?: 'default' | 'danger' | 'assistant';
  /** Доп. классы контейнера. Нужны ровно одному блоку — relative у стенограммы. */
  className?: string;
  children: ReactNode;
}

// Единственное место, где задаётся внешняя рамка блока рабочего поля.
//
// До этого все девять блоков открывались посимвольно одинаковой строкой из
// девяти классов, а шапку каждый собирал сам — с одним и тем же px-4 py-3,
// той же границей, тем же 11-пиксельным капсом. Любая правка вида блока
// означала девять одинаковых правок, и расхождения уже накопились: где-то
// иконка flex-shrink-0, где-то нет; где-то заголовок обрезается, где-то
// выталкивает кнопку за край.
//
// Отсюда же будут расти плотности: класс, зависящий от размера блока в
// клетках сетки, вешается на этот контейнер и один раз, а не в девяти файлах.
export default function BlockShell({
  icon: Icon,
  title,
  actions,
  tone = 'default',
  className = '',
  children,
}: BlockShellProps) {
  const danger = tone === 'danger';
  const density = useBlockDensity();
  // Значения ряда 'cozy' — ровно те, что стояли в шапках до появления ярусов.
  // Вся дефолтная раскладка попадает в 'cozy', то есть врач, который ничего не
  // двигал, не увидит никакой разницы.
  //
  // Кегля названия здесь нет намеренно: он задан ролью bl-label, а роль уже
  // зависит от яруса. Если задать его ещё и тут, масштаб применится дважды.
  const chrome = {
    compact: { pad: 'px-2.5 py-1.5', icon: 11 },
    cozy:    { pad: 'px-4 py-3',     icon: 12 },
    roomy:   { pad: 'px-4 py-3.5',   icon: 13 },
  }[density];

  return (
    <div
      data-density={density}
      className={`bg-white border border-ds-200 flex flex-col shadow-sm rounded-xl overflow-hidden h-full min-w-0 ${className}`}
    >
      {title && (
        <div className={`${chrome.pad} border-b border-ds-200 ${tone === 'assistant' ? 'bg-primary-50' : 'bg-ds-100'} flex justify-between items-center gap-2 sticky top-0 z-10`}>
          <div className={`flex items-center gap-2 min-w-0 bl-label font-semibold uppercase tracking-wide ${danger ? 'text-error-700' : 'text-ds-600'}`}>
            {Icon && <Icon size={chrome.icon} className={`flex-shrink-0 ${danger ? 'text-error-600' : 'text-primary-500'}`} />}
            {/* Заголовок обрезается многоточием, а не выталкивает кнопки из
                шапки: блок сужается до двух колонок сетки, и там места нет. */}
            <span className="truncate">{title}</span>
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
