import { lazy, Suspense, useState } from "react";
import { BookText, Calculator, FileStack, ListChecks, Pill } from "lucide-react";
import BlockShell from "./BlockShell";
import { useBlockDensity } from "./blockDensity";
import {
  REFERENCE_TABS, REFERENCE_TAB_LABELS, REFERENCE_TAB_TITLES, type ReferenceTab,
} from "../../config/workspace";
import PharmaReferencePanel from "./PharmaReferenceBlock";
import Icd10Panel from "./Icd10Block";
import GuidelinesPanel from "./GuidelinesPanel";
// Каталог калькуляторов — 296 КБ описаний полей, и он нужен только тому, кто
// открыл эту вкладку. Статический импорт клал его в основной бандл всем, включая
// врачей, которые за смену туда ни разу не заходят.
const CalculatorsPanel = lazy(() => import("./CalculatorsBlock"));
import TemplatesPanel, { type SelectedTemplate } from "./TemplatesBlock";

const TAB_ICONS = {
  icd10: ListChecks, guidelines: BookText, pharmaRef: Pill, dosageCalc: Calculator, templates: FileStack,
} as const;

interface ActiveDiagnosis { code: string; name: string; category?: string }
interface ActiveDrug { mnn: string; note?: string; group?: string }

interface ReferenceBlockProps {
  specialtyId: string;
  /** Вкладка, открытая последней в сохранённой раскладке. */
  initialTab?: ReferenceTab;
  activeDiagnosis: ActiveDiagnosis | null;
  onClearDiagnosis: () => void;
  activeDrug: ActiveDrug | null;
  onSelectDrug: (mnn: string, note?: string, group?: string) => void;
  activeCode: string | null;
  suggestedCodes: string[];
  isSuggesting: boolean;
  onSelectCode: (code: string) => void;
  selectedTemplate: SelectedTemplate | null;
  onSelectTemplate: (t: SelectedTemplate | null) => void;
}

// Четыре справочника одним блоком с вкладками.
//
// Раньше это были четыре отдельных блока по 4×6 клеток: чтобы пройти путь
// «код МКБ-10 → препараты по нему → доза по весу», врач должен был держать
// открытой половину рабочего поля. Инструменты однотипные (поиск по перечню) и
// связаны по цепочке, поэтому им хватает одного места на поле и полосы вкладок.
//
// Активная вкладка живёт в локальном состоянии, а не в раскладке. Иначе
// каждое переключение помечало бы раскладку изменённой и требовало от врача
// «Сохранить» — цена не соответствует тому, что он всего лишь заглянул в
// соседний справочник. Начальная вкладка из раскладки берётся: её туда
// записывает миграция с прежних четырёх блоков.
export default function ReferenceBlock({
  specialtyId, initialTab,
  activeDiagnosis, onClearDiagnosis, activeDrug, onSelectDrug,
  activeCode, suggestedCodes, isSuggesting, onSelectCode,
  selectedTemplate, onSelectTemplate,
}: ReferenceBlockProps) {
  const [tab, setTab] = useState<ReferenceTab>(initialTab ?? 'icd10');
  // Калькулятор, открытый переходом с вкладки клинреков. Живёт здесь, а не в
  // блоке расчётов: тот монтируется только при переключении на свою вкладку и
  // до перехода состояния принять не может.
  const [pendingCalculator, setPendingCalculator] = useState<string | null>(null);

  // Переходы с вкладки клинреков по связкам диагноза. Переключение вкладки —
  // часть действия: врач нажал «CHA₂DS₂-VASc», он ожидает открытый
  // калькулятор, а не отметку где-то в соседней вкладке, о которой он не
  // узнает.
  const openCalculator = (id: string) => { setPendingCalculator(id); setTab('dosageCalc'); };
  const openDrug = (mnn: string, note?: string, group?: string) => { onSelectDrug(mnn, note, group); setTab('pharmaRef'); };
  const density = useBlockDensity();
  // В сжатом блоке на четыре подписи ширины нет — остаются иконки, а полное
  // название уходит в title кнопки и в aria-label.
  const iconsOnly = density === 'compact';

  return (
    // Без title: полоса вкладок сама и есть шапка этого блока. Второй ряд
    // с названием «Справочники» съел бы строку сетки, не сказав ничего нового.
    <BlockShell>
      <div
        role="tablist"
        aria-label="Справочники"
        className="flex items-stretch border-b border-ds-200 bg-ds-100 sticky top-0 z-10 flex-shrink-0"
      >
        {REFERENCE_TABS.map(t => {
          const Icon = TAB_ICONS[t];
          const active = t === tab;
          return (
            <button
              key={t}
              role="tab"
              aria-selected={active}
              aria-label={REFERENCE_TAB_TITLES[t]}
              title={REFERENCE_TAB_TITLES[t]}
              onClick={() => setTab(t)}
              className={`flex items-center justify-center gap-1.5 min-w-0 flex-1 px-2 py-2 bl-label font-semibold uppercase tracking-wide border-b-2 transition-colors ${
                active
                  ? 'border-primary-600 text-primary-700 bg-white'
                  : 'border-transparent text-ds-600 hover:text-ds-800 hover:bg-ds-150'
              }`}
            >
              <Icon size={13} className="flex-shrink-0" />
              {!iconsOnly && <span className="truncate">{REFERENCE_TAB_LABELS[t]}</span>}
            </button>
          );
        })}
      </div>

      {tab === 'icd10' && (
        <Icd10Panel
          specialtyId={specialtyId}
          activeCode={activeCode}
          suggestedCodes={suggestedCodes}
          isSuggesting={isSuggesting}
          onSelectCode={onSelectCode}
        />
      )}
      {tab === 'guidelines' && (
        <GuidelinesPanel
          activeDiagnosis={activeDiagnosis}
          specialtyId={specialtyId}
          onOpenCalculator={openCalculator}
          onSelectDrug={openDrug}
        />
      )}
      {tab === 'pharmaRef' && (
        <PharmaReferencePanel
          specialtyId={specialtyId}
          activeDiagnosis={activeDiagnosis}
          onClearDiagnosis={onClearDiagnosis}
          activeDrug={activeDrug}
          onSelectDrug={onSelectDrug}
        />
      )}
      {tab === 'dosageCalc' && (
        <Suspense fallback={<p className="p-[var(--bl-pad)] text-center bl-label text-ds-600">Загрузка калькуляторов…</p>}>
          <CalculatorsPanel
            specialtyId={specialtyId}
            initialCalculatorId={pendingCalculator}
            onConsumeInitial={() => setPendingCalculator(null)}
            activeDiagnosis={activeDiagnosis}
            onClearDiagnosis={onClearDiagnosis}
            activeDrug={activeDrug}
          />
        </Suspense>
      )}

      {tab === 'templates' && (
        <TemplatesPanel
          specialtyId={specialtyId}
          activeDiagnosis={activeDiagnosis}
          onClearDiagnosis={onClearDiagnosis}
          selectedTemplate={selectedTemplate}
          onSelectTemplate={onSelectTemplate}
        />
      )}
    </BlockShell>
  );
}
