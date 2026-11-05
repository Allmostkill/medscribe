import { useMemo, useState } from "react";
import { Search, X, Eye, AlertTriangle } from "lucide-react";
import { getPharmaReference } from "../../config/pharmaReference";
import { getDrugClassInfo, getDrugClassKey } from "../../config/drugClassInfo";

interface ActiveDiagnosis {
  code: string;
  name: string;
  category?: string;
}

interface ActiveDrug {
  mnn: string;
  note?: string;
  // Группа (класс), из которой препарат выбрали — ключ к клинической справке
  // в drugClassInfo.ts. Без неё блок не знает, что показывать.
  group?: string;
}

interface PharmaReferenceBlockProps {
  specialtyId: string;
  activeDiagnosis?: ActiveDiagnosis | null;
  onClearDiagnosis?: () => void;
  activeDrug?: ActiveDrug | null;
  onSelectDrug?: (mnn: string, note?: string, group?: string) => void;
}

// Справочный список МНН по специальности — быстро посмотреть/найти препарат,
// не диктовать вслух. Контент курирован вручную (не полная фармакопея),
// специальность берётся из doctor.specialty.id.
//
// При активном диагнозе (см. Dashboard.tsx activeDiagnosis) группы,
// совпадающие по category/relatedCategories, поднимаются наверх и
// подсвечиваются — остальное остаётся видимым, ничего не скрывается.
//
// Клик по препарату выбирает его как "активный" (см. activeDrug в
// Dashboard.tsx) — показывает его описание тут же и подставляет в
// калькулятор дозировок (DosageCalcBlock). Повторный клик снимает выбор.
export default function PharmaReferenceBlock({ specialtyId, activeDiagnosis = null, onClearDiagnosis, activeDrug = null, onSelectDrug }: PharmaReferenceBlockProps) {
  const [query, setQuery] = useState("");
  const groups = getPharmaReference(specialtyId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = !q
      ? groups
      : groups
          .map(g => ({ ...g, drugs: g.drugs.filter(d => d.mnn.toLowerCase().includes(q) || d.note?.toLowerCase().includes(q)) }))
          .filter(g => g.drugs.length > 0);

    const cat = activeDiagnosis?.category;
    if (!cat) return base;
    const matched = base.filter(g => g.relatedCategories?.includes(cat));
    const rest = base.filter(g => !g.relatedCategories?.includes(cat));
    return [...matched, ...rest];
  }, [groups, query, activeDiagnosis]);

  return (
    <>
      <div className="p-[var(--bl-pad)] pb-0 space-y-2">
        {activeDiagnosis && (
          <div className="flex items-center gap-1.5 bg-primary-50 border border-primary-200 rounded-md px-2 py-1 bl-label text-primary-800">
            <span className="truncate">Диагноз: {activeDiagnosis.code} {activeDiagnosis.name}</span>
            <button onClick={onClearDiagnosis} className="ml-auto flex-shrink-0 text-primary-600 hover:text-primary-800">
              <X size={12} />
            </button>
          </div>
        )}
        {activeDrug && (() => {
          // МНН вперёд группы: класс принадлежит молекуле, а не вкладке, из
          // которой по ней кликнули (см. DRUG_CLASS_BY_MNN).
          const info = getDrugClassInfo(activeDrug.group, activeDrug.mnn);
          const classKey = getDrugClassKey(activeDrug.group, activeDrug.mnn);
          return (
            <div className="bg-primary-50 border border-primary-200 rounded-md px-2.5 py-2 bl-label text-primary-900">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold capitalize truncate">{activeDrug.mnn}</span>
                <button
                  onClick={() => onSelectDrug?.(activeDrug.mnn, activeDrug.note, activeDrug.group)}
                  className="ml-auto flex-shrink-0 text-primary-600 hover:text-primary-800"
                  title="Снять выбор"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Заметка препарата — отдельной строкой на всю ширину. Inline-span
                  с truncate схлопывал её в «— < 12 л…», а у групп без справки
                  по классу это единственный носитель информации о запрете. */}
              {activeDrug.note && activeDrug.note !== classKey && (
                <p className="text-primary-800 leading-snug mt-0.5">{activeDrug.note}</p>
              )}

              {(classKey || activeDrug.group) && (
                <p className="bl-caption font-semibold tracking-wide text-primary-600/80 mt-0.5">{classKey || activeDrug.group}</p>
              )}

              {info ? (
                <div className="mt-1.5 space-y-1.5">
                  <p className="text-primary-800 leading-snug">{info.about}</p>

                  {info.monitor && info.monitor.length > 0 && (
                    <div>
                      <p className="flex items-center gap-1 font-semibold text-primary-700">
                        <Eye size={10} className="flex-shrink-0" /> Контроль
                      </p>
                      <ul className="mt-0.5 space-y-0.5">
                        {info.monitor.map(m => (
                          <li key={m} className="text-primary-800/90 leading-snug pl-2.5 -indent-2.5">· {m}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {info.cautions && info.cautions.length > 0 && (
                    <div>
                      <p className="flex items-center gap-1 font-semibold text-warning-800">
                        <AlertTriangle size={10} className="flex-shrink-0" /> Осторожно
                      </p>
                      <ul className="mt-0.5 space-y-0.5">
                        {info.cautions.map(c => (
                          <li key={c} className="text-warning-900/90 leading-snug pl-2.5 -indent-2.5">· {c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="bl-caption text-primary-700/60 leading-snug pt-0.5">
                    Справка по классу. Дозы и полный перечень противопоказаний — в инструкции препарата.
                  </p>
                </div>
              ) : (
                // «Подставлен в калькулятор дозировок» здесь стояло безусловно —
                // в том числе для группы «Запрещено по возрасту», где педиатр,
                // кликнув аспирин, получал приглашение посчитать ребёнку дозу и
                // ни от одного блока не слышал слова «противопоказан».
                <p className="text-primary-700/70 mt-1">
                  Справки по этому классу пока нет — сверяйтесь с инструкцией препарата.
                </p>
              )}
            </div>
          );
        })()}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ds-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск препарата..."
            className="w-full bg-ds-50 border border-ds-400 pl-8 pr-3 py-1.5 bl-label rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
      <div className="p-[var(--bl-pad)] space-y-[var(--bl-stack-lg)] overflow-y-auto flex-1 bg-ds-50">
        {groups.length === 0 ? (
          <p className="text-center bl-label text-ds-600 mt-6">Нет справочного списка для этой специальности</p>
        ) : filtered.length === 0 ? (
          <p className="text-center bl-label text-ds-600 mt-6">Ничего не найдено</p>
        ) : (
          filtered.map(g => {
            const isMatch = !!activeDiagnosis?.category && g.relatedCategories?.includes(activeDiagnosis.category);
            return (
              <div key={g.group} className={isMatch ? 'rounded-lg border border-primary-200 bg-primary-50/40 p-2 -m-2' : ''}>
                <div className="bl-caption font-bold text-ds-600 tracking-wide mb-1.5 flex items-center gap-1.5">
                  {g.group}
                  {isMatch && <span className="px-1.5 py-0.5 bg-primary-100 text-primary-700 rounded bl-caption normal-case font-semibold">по диагнозу</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.drugs.map(d => {
                    const isActive = activeDrug?.mnn === d.mnn && activeDrug?.group === g.group;
                    return (
                      <button
                        key={d.mnn}
                        type="button"
                        title={d.note}
                        onClick={() => onSelectDrug?.(d.mnn, d.note, g.group)}
                        className={`px-2 py-1 border rounded-md bl-label transition-colors ${
                          isActive
                            ? 'bg-primary-600 border-primary-600 text-white'
                            : 'bg-white border-ds-150 text-ds-900 hover:border-primary-300'
                        }`}
                      >
                        {d.mnn}
                        {d.note && <span className={isActive ? 'text-white/70' : 'text-ds-600'}> — {d.note}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
