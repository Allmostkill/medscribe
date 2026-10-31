import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Wand2, X } from "lucide-react";
import { getPrescriptionTemplates } from "../../config/prescriptionTemplates";

interface ActiveDiagnosis {
  code: string;
  name: string;
  category?: string;
}

export interface SelectedTemplate {
  title: string;
  body: string;
}

interface TemplatesBlockProps {
  specialtyId: string;
  activeDiagnosis?: ActiveDiagnosis | null;
  onClearDiagnosis?: () => void;
  // Шаблон, выбранный «для заполнения»: при формировании протокола его пункты
  // станут каркасом полей «Лекарственная терапия» и «План лечения». null —
  // ничего не выбрано, протокол формируется как раньше.
  selectedTemplate?: SelectedTemplate | null;
  onSelectTemplate?: (template: SelectedTemplate | null) => void;
}

// Готовые шаблоны типовых схем назначений по специальности — карточка с
// кнопкой "Копировать" (тот же паттерн, что копирование полей EHR в МИС).
// Справочный шаблон, требует адаптации под конкретного пациента.
//
// Это основное место, где реально живут схемы титрации (см. body) — в
// отличие от DosageCalcBlock (только разовая доза по весу). При активном
// диагнозе совпадающий шаблон поднимается наверх, подсвечивается и в поле
// зрения прокручивается автоматически — ничего не скрывается и не
// копируется без явного клика врача.
export default function TemplatesBlock({
  specialtyId,
  activeDiagnosis = null,
  onClearDiagnosis,
  selectedTemplate = null,
  onSelectTemplate,
}: TemplatesBlockProps) {
  const [copiedTitle, setCopiedTitle] = useState<string | null>(null);
  const rawTemplates = getPrescriptionTemplates(specialtyId);
  const matchedRef = useRef<HTMLDivElement>(null);

  const templates = useMemo(() => {
    const cat = activeDiagnosis?.category;
    if (!cat) return rawTemplates;
    const matched = rawTemplates.filter(t => t.relatedCategories?.includes(cat));
    const rest = rawTemplates.filter(t => !t.relatedCategories?.includes(cat));
    return [...matched, ...rest];
  }, [rawTemplates, activeDiagnosis]);

  useEffect(() => {
    if (activeDiagnosis?.category && matchedRef.current) {
      matchedRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDiagnosis?.category]);

  const handleCopy = (title: string, body: string) => {
    navigator.clipboard.writeText(body).catch(() => {});
    setCopiedTitle(title);
    setTimeout(() => setCopiedTitle(prev => (prev === title ? null : prev)), 1500);
  };

  // Повторный клик по выбранному шаблону снимает выбор — тот же паттерн, что
  // у activeDiagnosis: ничего не выбирается и не отменяется само.
  const toggleSelect = (t: SelectedTemplate) => {
    if (!onSelectTemplate) return;
    onSelectTemplate(selectedTemplate?.title === t.title ? null : { title: t.title, body: t.body });
  };

  let firstMatchAssigned = false;

  return (
    <>
      {selectedTemplate && (
        <div className="px-[var(--bl-pad)] pt-[var(--bl-pad)]">
          <div className="flex items-center gap-1.5 bg-primary-600 rounded-md px-2 py-1 bl-label text-white">
            <Wand2 size={11} className="flex-shrink-0" />
            <span className="truncate">Протокол заполнится по шаблону: {selectedTemplate.title}</span>
            <button
              onClick={() => onSelectTemplate?.(null)}
              title="Не использовать шаблон"
              className="ml-auto flex-shrink-0 text-white/70 hover:text-white"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}
      {activeDiagnosis && (
        <div className="px-[var(--bl-pad)] pt-[var(--bl-pad)]">
          <div className="flex items-center gap-1.5 bg-primary-50 border border-primary-200 rounded-md px-2 py-1 bl-label text-primary-800">
            <span className="truncate">Диагноз: {activeDiagnosis.code} {activeDiagnosis.name}</span>
            <button onClick={onClearDiagnosis} className="ml-auto flex-shrink-0 text-primary-600 hover:text-primary-800">
              <X size={12} />
            </button>
          </div>
        </div>
      )}
      <div className="p-[var(--bl-pad)] space-y-[var(--bl-stack)] overflow-y-auto flex-1 bg-ds-50">
        {templates.length === 0 ? (
          <p className="text-center bl-label text-ds-600 mt-6">Нет шаблонов для этой специальности</p>
        ) : (
          templates.map(t => {
            const isMatch = !!activeDiagnosis?.category && t.relatedCategories?.includes(activeDiagnosis.category);
            const isFirstMatch = isMatch && !firstMatchAssigned;
            if (isFirstMatch) firstMatchAssigned = true;
            const isSelected = selectedTemplate?.title === t.title;
            const border = isSelected ? 'border-primary-500 ring-2 ring-primary-200'
              : isMatch ? 'border-primary-300 ring-1 ring-primary-100'
              : 'border-ds-150';
            return (
              <div
                key={t.title}
                ref={isFirstMatch ? matchedRef : undefined}
                className={`bg-white border rounded-lg p-2.5 ${border}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="bl-label font-semibold text-ds-900 flex items-center gap-1.5">
                    {t.title}
                    {isMatch && <span className="px-1.5 py-0.5 bg-primary-100 text-primary-700 rounded bl-caption font-semibold uppercase tracking-wide">рекомендовано</span>}
                  </span>
                  <button
                    onClick={() => handleCopy(t.title, t.body)}
                    className="flex-shrink-0 text-ds-600 hover:text-primary-600 transition-colors"
                    title="Копировать"
                  >
                    {copiedTitle === t.title ? <Check size={13} className="text-success-600" /> : <Copy size={13} />}
                  </button>
                </div>
                <p className="bl-label text-ds-600 leading-snug whitespace-pre-line">{t.body}</p>
                {onSelectTemplate && (
                  <button
                    onClick={() => toggleSelect({ title: t.title, body: t.body })}
                    title={isSelected
                      ? 'Не заполнять протокол по этому шаблону'
                      : 'При формировании протокола подставить данные приёма в пункты этого шаблона'}
                    className={`mt-2 w-full flex items-center justify-center gap-1.5 rounded-md px-2 py-1 bl-label font-semibold transition-colors ${
                      isSelected
                        ? 'bg-primary-600 text-white hover:bg-primary-700'
                        : 'bg-ds-100 text-ds-800 hover:bg-primary-50 hover:text-primary-700'
                    }`}
                  >
                    <Wand2 size={11} />
                    {isSelected ? 'Заполняем этот шаблон' : 'Заполнить протоколом'}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
