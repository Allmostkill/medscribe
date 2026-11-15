import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { getDosagePresets } from "../../config/dosageReference";
import { getDrugClassKey } from "../../config/drugClassInfo";

/** Препарат из перечня возрастных запретов — считать ему дозу нечего. */
const isBannedForAge = (group?: string, mnn?: string): boolean =>
  getDrugClassKey(group, mnn) === 'Противопоказано в детском возрасте';

interface ActiveDiagnosis {
  code: string;
  name: string;
  category?: string;
}

interface ActiveDrug {
  mnn: string;
  note?: string;
  /** Группа справочника — нужна, чтобы отличить перечень возрастных запретов. */
  group?: string;
}

interface DosageCalcBlockProps {
  specialtyId: string;
  activeDiagnosis?: ActiveDiagnosis | null;
  onClearDiagnosis?: () => void;
  activeDrug?: ActiveDrug | null;
}

const CUSTOM = '__custom__';

// Калькулятор доз по массе тела: разовая/суточная доза = вес × мг/кг.
// Пресеты — из dosageReference.ts (сейчас только педиатрия, единственная
// область с явно зафиксированными в проекте дозами по весу); для остальных
// специальностей — только ручной ввод своего мг/кг.
//
// При активном диагнозе совпадающие пресеты поднимаются наверх — это
// разовая доза по весу, не схема титрации, поэтому только подсветка/порядок,
// без авто-выбора (калькулятор дозы — более чувствительный случай, чем
// справочные списки, авто-подстановка здесь нежелательна).
//
// activeDrug (клик по препарату в фарм-справочнике) — исключение: явного
// клика врача на конкретный препарат достаточно, чтобы сразу подставить его
// сюда — если для него есть пресет мг/кг, он выбирается; если нет,
// калькулятор переходит в ручной ввод с указанием названия (саму дозу
// мг/кг всё равно вводит врач, ничего не считается без его цифр).
export default function DosageCalcBlock({ specialtyId, activeDiagnosis = null, onClearDiagnosis, activeDrug = null }: DosageCalcBlockProps) {
  const rawPresets = getDosagePresets(specialtyId);
  const presets = useMemo(() => {
    const cat = activeDiagnosis?.category;
    if (!cat) return rawPresets;
    const matched = rawPresets.filter(p => p.relatedCategories?.includes(cat));
    const rest = rawPresets.filter(p => !p.relatedCategories?.includes(cat));
    return [...matched, ...rest];
  }, [rawPresets, activeDiagnosis]);
  const [selected, setSelected] = useState<string>(presets.length > 0 ? presets[0].drug : CUSTOM);
  const [weight, setWeight] = useState("");
  const [manualMgPerKg, setManualMgPerKg] = useState("");
  const [manualFrequency, setManualFrequency] = useState("1");

  useEffect(() => {
    if (!activeDrug) return;
    const match = rawPresets.find(p => p.drug.trim().toLowerCase() === activeDrug.mnn.trim().toLowerCase());
    setSelected(match ? match.drug : CUSTOM);
  }, [activeDrug, rawPresets]);

  const preset = presets.find(p => p.drug === selected);
  const w = parseFloat(weight.replace(',', '.'));

  const result = useMemo(() => {
    if (!Number.isFinite(w) || w <= 0) return null;
    if (preset) {
      const singleDoseMg = preset.perDay ? (w * preset.mgPerKg) / preset.frequencyPerDay : w * preset.mgPerKg;
      const dailyMg = preset.perDay ? w * preset.mgPerKg : singleDoseMg * preset.frequencyPerDay;
      return { singleDoseMg, dailyMg, frequency: preset.frequencyPerDay, note: preset.note };
    }
    const mgPerKg = parseFloat(manualMgPerKg.replace(',', '.'));
    const freq = parseInt(manualFrequency, 10) || 1;
    if (!Number.isFinite(mgPerKg) || mgPerKg <= 0) return null;
    const singleDoseMg = w * mgPerKg;
    return { singleDoseMg, dailyMg: singleDoseMg * freq, frequency: freq };
  }, [w, preset, manualMgPerKg, manualFrequency]);

  // Препарат, которому в этом возрасте дозу не считают ни при каких
  // обстоятельствах: калькулятор для него не показывается совсем.
  const banned = !!activeDrug && isBannedForAge(activeDrug.group, activeDrug.mnn);

  return (
    <>
      <div className="p-[var(--bl-pad)] space-y-[var(--bl-stack-lg)] overflow-y-auto flex-1 bg-ds-50">
        <p className="bl-caption text-warning-700 bg-warning-50 border border-warning-200 rounded-md px-2 py-1.5 leading-snug">
          Справочный расчёт, не заменяет клиническое суждение и инструкцию препарата.
        </p>

        {activeDiagnosis && (
          <div className="flex items-center gap-1.5 bg-primary-50 border border-primary-200 rounded-md px-2 py-1 bl-label text-primary-800">
            <span className="truncate">Диагноз: {activeDiagnosis.code} {activeDiagnosis.name}</span>
            <button onClick={onClearDiagnosis} className="ml-auto flex-shrink-0 text-primary-600 hover:text-primary-800">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Препарат из запрещающей группы не «подставляется в калькулятор» —
            для него не существует детской дозы, и приглашение её посчитать
            было прямо опасным. Показываем запрет вместо поля ввода. */}
        {banned && activeDrug && (
          <div className="flex items-start gap-1.5 bg-warning-50 border border-warning-300 rounded-md px-2 py-1.5 bl-label text-warning-900">
            <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
            <span>
              <span className="capitalize font-semibold">{activeDrug.mnn}</span> — противопоказан в детском возрасте
              {activeDrug.note ? ` (${activeDrug.note})` : ''}. Дозу не рассчитывать, подобрать препарат другого класса.
            </span>
          </div>
        )}

        {activeDrug && !banned && (
          <div className="flex items-center gap-1.5 bg-primary-50 border border-primary-200 rounded-md px-2 py-1 bl-label text-primary-800">
            <span className="truncate capitalize">
              Препарат из справочника: {activeDrug.mnn}
              {!preset && ' — введите дозу вручную ниже'}
            </span>
          </div>
        )}

        {/* Пока выбран препарат из перечня возрастных запретов, полей ввода
            здесь нет вовсе. Раньше плашка «дозу не рассчитывать» висела над
            полностью рабочим калькулятором: врач видел запрет и тут же под ним
            считал ту самую дозу. Предупреждение, которое ничего не
            предотвращает, хуже отсутствия предупреждения. */}
        {!banned && (
          <>
          <div>
            <label className="bl-caption font-bold text-ds-600 uppercase tracking-wide mb-1 block">Вес пациента, кг</label>
            <input
              type="text"
              inputMode="decimal"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="Например: 18"
              className="w-full bg-white border border-ds-400 px-3 py-2 bl-body rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {presets.length > 0 && (
            <div>
              <label className="bl-caption font-bold text-ds-600 uppercase tracking-wide mb-1 block">Препарат</label>
              <select
                value={selected}
                onChange={e => setSelected(e.target.value)}
                className="w-full bg-white border border-ds-400 px-3 py-2 bl-body rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {presets.map(p => {
                  const isMatch = !!activeDiagnosis?.category && p.relatedCategories?.includes(activeDiagnosis.category);
                  return (
                    <option key={p.drug} value={p.drug}>
                      {isMatch ? '★ ' : ''}{p.drug} ({p.mgPerKg} мг/кг{p.perDay ? '/сут' : ''})
                    </option>
                  );
                })}
                <option value={CUSTOM}>Свой препарат (ручной ввод)</option>
              </select>
            </div>
          )}

          {!preset && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="bl-caption font-bold text-ds-600 uppercase tracking-wide mb-1 block">Доза, мг/кг (разовая)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={manualMgPerKg}
                  onChange={e => setManualMgPerKg(e.target.value)}
                  placeholder="Например: 10"
                  className="w-full bg-white border border-ds-400 px-3 py-2 bl-body rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="w-24">
                <label className="bl-caption font-bold text-ds-600 uppercase tracking-wide mb-1 block">Раз/сут</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={manualFrequency}
                  onChange={e => setManualFrequency(e.target.value)}
                  className="w-full bg-white border border-ds-400 px-3 py-2 bl-body rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {result ? (
            <div className="bg-white border border-primary-200 rounded-lg p-3 space-y-1">
              <div className="flex justify-between bl-body">
                <span className="text-ds-600">Разовая доза</span>
                <span className="font-bold text-ds-900">{result.singleDoseMg.toFixed(1)} мг</span>
              </div>
              <div className="flex justify-between bl-body">
                <span className="text-ds-600">Суточная доза (× {result.frequency})</span>
                <span className="font-bold text-ds-900">{result.dailyMg.toFixed(1)} мг</span>
              </div>
              {result.note && <p className="bl-caption text-ds-600 pt-1">{result.note}</p>}
            </div>
          ) : (
            <p className="text-center bl-label text-ds-600 mt-4">Введите вес{!preset ? ' и дозу' : ''} для расчёта</p>
          )}
          </>
        )}
      </div>
    </>
  );
}
