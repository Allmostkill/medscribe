import { useMemo, useState, type MouseEvent } from "react";
import { Check, Copy, Search, Sparkles } from "lucide-react";
import { getIcd10Reference, type Icd10Code } from "../../config/icd10Reference";

interface Icd10BlockProps {
  specialtyId: string;
  activeCode?: string | null;
  suggestedCodes?: string[];
  isSuggesting?: boolean;
  onSelectCode?: (code: string) => void;
}

// Поиск + копирование частых кодов МКБ-10 по специальности. Поле "Диагноз"
// в протоколе приёма формируется AI после консультации отдельно (не здесь) —
// это справочный блок для консультации во время приёма, код копируется в
// буфер обмена и вставляется врачом туда, где нужно.
//
// Клик по строке выбирает её как "активный диагноз" — связывает фарм-
// справочник/калькулятор доз/шаблоны назначений (см. activeDiagnosis в
// Dashboard.tsx). Подсказки по контексту приёма (suggestedCodes) — только
// предложение: выбор всегда требует явного клика врача, ничего не
// применяется автоматически.
export default function Icd10Block({ specialtyId, activeCode = null, suggestedCodes = [], isSuggesting = false, onSelectCode }: Icd10BlockProps) {
  const [query, setQuery] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const codes = getIcd10Reference(specialtyId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return codes;
    return codes.filter(c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [codes, query]);

  const suggested: Icd10Code[] = useMemo(
    () => suggestedCodes.map(code => codes.find(c => c.code === code)).filter((c): c is Icd10Code => !!c),
    [codes, suggestedCodes]
  );

  const handleCopy = (e: MouseEvent, code: string, name: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${code} ${name}`).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(prev => (prev === code ? null : prev)), 1500);
  };

  const handleSelect = (code: string) => onSelectCode?.(code);

  const renderRow = (c: Icd10Code, variant: 'suggested' | 'default') => (
    <div
      key={`${variant}-${c.code}`}
      onClick={() => handleSelect(c.code)}
      className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-colors ${
        c.code === activeCode
          ? 'bg-primary-50 border-primary-300'
          : variant === 'suggested'
          ? 'bg-white border-primary-200 hover:border-primary-300'
          : 'bg-white border-ds-150 hover:border-ds-300'
      }`}
    >
      <div className="flex-1 min-w-0">
        <span className="bl-label font-bold text-primary-700">{c.code}</span>
        <span className="bl-label text-ds-900 ml-2">{c.name}</span>
      </div>
      {c.code === activeCode && <Check size={13} className="text-primary-600 flex-shrink-0 mt-0.5" />}
      <button
        onClick={e => handleCopy(e, c.code, c.name)}
        className="flex-shrink-0 text-ds-600 hover:text-primary-600 transition-colors"
        title="Копировать"
      >
        {copiedCode === c.code ? <Check size={13} className="text-success-600" /> : <Copy size={13} />}
      </button>
    </div>
  );

  return (
    <>
      <div className="px-[var(--bl-pad)] pt-[var(--bl-pad)]">
        <p className="bl-caption text-warning-700 bg-warning-50 border border-warning-200 rounded-md px-2 py-1.5 mb-2 leading-snug">
          Часто используемые коды, не полная база МКБ-10. Проверяйте точный код в официальном классификаторе.
        </p>

        {(suggested.length > 0 || isSuggesting) && (
          <div className="mb-2.5 bg-primary-50/50 border border-primary-100 rounded-lg p-2">
            <div className="flex items-center gap-1.5 bl-caption font-bold text-primary-700 uppercase tracking-wide mb-1.5">
              <Sparkles size={11} />
              Похоже на (по контексту приёма){isSuggesting && suggested.length === 0 ? '…' : ''}
            </div>
            <div className="space-y-1.5">
              {suggested.map(c => renderRow(c, 'suggested'))}
            </div>
          </div>
        )}

        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ds-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск по коду или названию..."
            className="w-full bg-ds-50 border border-ds-400 pl-8 pr-3 py-1.5 bl-label rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
      <div className="p-[var(--bl-pad)] space-y-[var(--bl-stack-sm)] overflow-y-auto flex-1 bg-ds-50">
        {codes.length === 0 ? (
          <p className="text-center bl-label text-ds-600 mt-6">Нет справочного списка для этой специальности</p>
        ) : filtered.length === 0 ? (
          <p className="text-center bl-label text-ds-600 mt-6">Ничего не найдено</p>
        ) : (
          filtered.map(c => renderRow(c, 'default'))
        )}
      </div>
    </>
  );
}
