import { useEffect, useState } from "react";
import { ExternalLink, ShieldCheck, AlertTriangle, Calculator, Pill } from "lucide-react";
import { getStoredSession } from "../../services/auth";
import GuidelineDocument from "./GuidelineDocument";
import { getCalculatorsForDiagnosis } from "../../config/diagnosisCalculators";
import { getPharmaReference } from "../../config/pharmaReference";
// Лёгкий индекс, а не catalog.ts: полный каталог весит около 300 КБ описаний
// полей, эта вкладка не ленивая, и его импорт отсюда кладёт их в основной
// бандл всем — включая врачей, которые в калькуляторы не заходят.
import { calcListing } from "../../generated/calculators/index";

interface Guideline {
  title: string;
  year: string | null;
  applyStatus: string;
  approvedByNpc: boolean;
  docId: string;
  age: string | null;
  mkb: string[];
  developers: string[];
  url: string;
}

interface GuidelinesPanelProps {
  activeDiagnosis?: { code: string; name: string; category?: string } | null;
  specialtyId: string;
  /** Открыть калькулятор на вкладке «Расчёты». */
  onOpenCalculator: (id: string) => void;
  /** Выбрать препарат — как клик по нему в фарм-справочнике. */
  onSelectDrug: (mnn: string, note?: string, group?: string) => void;
}

// Действующие клинические рекомендации Минздрава по выбранному коду МКБ-10.
//
// Здесь НЕТ модели. Список приходит из рубрикатора как есть, поэтому ссылка,
// год и статус применения проверяемы: именно это спрашивают при проверке ОМС —
// «на основании какого документа». Подсказка, сгенерированная языковой моделью,
// на такой вопрос ответить не может, а придуманный ею номер документа выглядит
// достовернее, чем отсутствие ссылки, и потому опаснее.
//
// Автовыбора нет намеренно. По одному коду рекомендаций обычно несколько —
// «Дети» и «Взрослые» как минимум, — и подставить не ту значит подсунуть врачу
// чужую возрастную группу. Та же причина, по которой калькулятор доз не
// выбирает препарат сам.
export default function GuidelinesPanel({
  activeDiagnosis = null, specialtyId, onOpenCalculator, onSelectDrug,
}: GuidelinesPanelProps) {
  const [items, setItems] = useState<Guideline[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [openDoc, setOpenDoc] = useState<Guideline | null>(null);
  const code = activeDiagnosis?.code ?? null;

  useEffect(() => {
    setOpenDoc(null);
    if (!code) { setItems([]); setState('idle'); return; }
    let cancelled = false;
    setState('loading');
    const token = getStoredSession()?.token;
    fetch(`/api/guidelines?code=${encodeURIComponent(code)}`,
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        setItems(d.items || []);
        // Недоступность рубрикатора нельзя показывать как «рекомендаций нет»:
        // врач решит, что их не существует, а они просто не загрузились.
        setState(d.error ? 'error' : 'idle');
      })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [code]);

  if (openDoc) {
    return (
      <GuidelineDocument
        docId={openDoc.docId}
        title={openDoc.title}
        url={openDoc.url}
        onBack={() => setOpenDoc(null)}
      />
    );
  }

  return (
    <>
      <div className="px-[var(--bl-pad)] pt-[var(--bl-pad)]">
        {code ? (
          <div className="flex items-center gap-1.5 bg-primary-50 border border-primary-200 rounded-md px-2 py-1 bl-label text-primary-800">
            <span className="truncate">Код: {code} {activeDiagnosis?.name}</span>
          </div>
        ) : (
          <p className="bl-caption text-ds-600 bg-ds-100 border border-ds-200 rounded-md px-2 py-1.5 leading-snug">
            Выберите код на вкладке «МКБ-10» — покажу действующие клинические рекомендации Минздрава по нему.
          </p>
        )}
      </div>

      <div className="p-[var(--bl-pad)] space-y-[var(--bl-stack-sm)] overflow-y-auto flex-1 bg-ds-50">
        <DiagnosisLinks
          category={activeDiagnosis?.category}
          specialtyId={specialtyId}
          onOpenCalculator={onOpenCalculator}
          onSelectDrug={onSelectDrug}
        />

        {state === 'loading' && <p className="text-center bl-label text-ds-600 mt-6">Запрос в рубрикатор…</p>}

        {state === 'error' && (
          <div className="flex items-start gap-1.5 bg-warning-50 border border-warning-200 rounded-md px-2 py-1.5 bl-label text-warning-800">
            <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
            <span>Рубрикатор Минздрава не отвечает. Это не значит, что рекомендаций нет — повторите позже.</span>
          </div>
        )}

        {state === 'idle' && code && items.length === 0 && (
          <p className="text-center bl-label text-ds-600 mt-6">По этому коду действующих рекомендаций не найдено</p>
        )}

        {items.map(g => (
          <div
            key={g.docId}
            className="block bg-white border border-ds-200 rounded-lg p-2.5 hover:border-primary-300 transition-colors"
          >
            <div className="flex items-start gap-1.5">
              <button
                onClick={() => setOpenDoc(g)}
                className="bl-label font-semibold text-ds-900 leading-snug flex-1 text-left hover:text-primary-700 transition-colors"
              >
                {g.title}
              </button>
              <a href={g.url} target="_blank" rel="noopener noreferrer"
                title="Открыть оригинал на сайте Минздрава"
                className="text-ds-400 hover:text-primary-600 flex-shrink-0 mt-0.5 transition-colors">
                <ExternalLink size={12} />
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {g.age && (
                <span className="bl-caption px-1.5 py-0.5 rounded bg-primary-50 text-primary-800 border border-primary-200">{g.age}</span>
              )}
              {g.year && <span className="bl-caption text-ds-600">{g.year}</span>}
              {/* Статус применения — главное здесь. Ссылка на отменённую
                  рекомендацию хуже отсутствия ссылки. */}
              <span className={`bl-caption px-1.5 py-0.5 rounded ${
                g.applyStatus === 'применяется'
                  ? 'bg-success-50 text-success-700 border border-success-200'
                  : 'bg-warning-50 text-warning-800 border border-warning-200'
              }`}>
                {g.applyStatus}
              </span>
              {g.approvedByNpc && (
                <span className="bl-caption text-success-700 inline-flex items-center gap-1">
                  <ShieldCheck size={11} /> одобрено НПС
                </span>
              )}
            </div>

            {g.developers.length > 0 && (
              <p className="bl-caption text-ds-600 mt-1 leading-snug">{g.developers.join('; ')}</p>
            )}
            {g.mkb.length > 0 && (
              <p className="bl-caption font-mono text-ds-600 mt-1 truncate">{g.mkb.join(', ')}</p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

interface DiagnosisLinksProps {
  category?: string;
  specialtyId: string;
  onOpenCalculator: (id: string) => void;
  onSelectDrug: (mnn: string, note?: string, group?: string) => void;
}

// Что ещё в системе привязано к выбранному диагнозу: шкалы и препараты.
//
// Врач, выбрав код, идёт за одним и тем же набором — рекомендация, шкала для
// стратификации риска, схема лечения, — и раньше собирал это по трём вкладкам,
// каждый раз вспоминая, какая шкала к этому диагнозу вообще относится.
//
// Связь тут ровно та же, что у фарм-справочника и шаблонов: тег сценария из
// Icd10Code.category. Ничего не считается и не подставляется — это перечень
// того, что открыть, а решение остаётся за врачом. Нажатие переключает на
// соответствующую вкладку: дублировать здесь целиком калькулятор или карточку
// препарата значило бы завести им второе место жизни.
//
// Блок не показывается, когда привязок нет: у 74 кодов из 158 тега нет вовсе,
// а у части тегов (мигрень, ГЭРБ) подходящих шкал в наборе не существует.
// Пустой заголовок «Под этот диагноз» без содержимого читается как поломка.
function DiagnosisLinks({ category, specialtyId, onOpenCalculator, onSelectDrug }: DiagnosisLinksProps) {
  const calcIds = getCalculatorsForDiagnosis(category);
  const calcs = calcIds
    .map(id => calcListing.find(e => e.id === id))
    .filter((e): e is NonNullable<typeof e> => !!e);

  const drugGroups = category
    ? getPharmaReference(specialtyId).filter(g => g.relatedCategories?.includes(category))
    : [];

  if (calcs.length === 0 && drugGroups.length === 0) return null;

  return (
    <div className="bg-primary-50/50 border border-primary-100 rounded-lg p-2 space-y-2">
      {calcs.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 bl-caption font-bold text-primary-700 uppercase tracking-wide mb-1.5">
            <Calculator size={11} /> Шкалы под этот диагноз
          </div>
          <div className="flex flex-wrap gap-1">
            {calcs.map(c => (
              <button
                key={c.id}
                onClick={() => onOpenCalculator(c.id)}
                title={c.description}
                className="bl-caption px-2 py-1 rounded-md bg-white border border-ds-300 text-ds-900 hover:border-primary-400 hover:text-primary-700 transition-colors"
              >
                {c.shortName ?? c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {drugGroups.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 bl-caption font-bold text-primary-700 uppercase tracking-wide mb-1.5">
            <Pill size={11} /> Препараты под этот диагноз
          </div>
          <div className="space-y-1.5">
            {drugGroups.map(g => (
              <div key={g.group}>
                <p className="bl-caption text-ds-600 mb-0.5">{g.group}</p>
                <div className="flex flex-wrap gap-1">
                  {g.drugs.map(d => (
                    <button
                      key={d.mnn}
                      onClick={() => onSelectDrug(d.mnn, d.note, g.group)}
                      title={d.note}
                      className="bl-caption px-2 py-1 rounded-md bg-white border border-ds-300 text-ds-900 lowercase first-letter:uppercase hover:border-primary-400 hover:text-primary-700 transition-colors"
                    >
                      {d.mnn}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
