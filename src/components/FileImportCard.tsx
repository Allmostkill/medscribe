import { useEffect, useRef, useState } from "react";
import { FolderOpen, AlertCircle } from "lucide-react";
import { ACCEPT, defaultVisitDate, precheckFile } from "../utils/fileImport";
import type { ImportProgress } from "../services/fileImport";

export interface FileImportRequest {
  consultationType: 'primary' | 'follow-up';
  /** YYYY-MM-DD */
  visitDate: string;
  /** «Это был звонок»: протокол собирается как по дистанционному приёму. */
  wasCall: boolean;
  signal: AbortSignal;
  onProgress: (p: ImportProgress) => void;
}

interface FileImportCardProps {
  /** Кнопки старта неактивны (идёт запись, расшифровка или сборка протокола). */
  blocked: boolean;
  consultationType: 'primary' | 'follow-up';
  /** Длина контекста «Из МИС» в знаках; 0 — контекста нет. */
  priorContextLength: number;
  /** Загрузить и поставить на расшифровку. Бросает Error с текстом для врача; AbortError — отмена. */
  onImport: (file: File, req: FileImportRequest) => Promise<void>;
}

type Stage = 'idle' | 'confirm' | 'busy' | 'error';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} ГБ`;
  return `${Math.max(1, Math.round(bytes / 1024 / 1024))} МБ`;
}

function extOf(name: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name);
  return m ? m[1].toLowerCase() : '?';
}

/** Сегодня, YYYY-MM-DD (локально). */
const todayIso = () => defaultVisitDate(Date.now(), Date.now());

export default function FileImportCard({ blocked, consultationType, priorContextLength, onImport }: FileImportCardProps) {
  const [stage, setStage] = useState<Stage>('idle');
  // Имя файла живёт только в этом состоянии: на сервер, в журнал, в черновик и в IndexedDB оно не уходит.
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<'primary' | 'follow-up'>(consultationType);
  const [visitDate, setVisitDate] = useState('');
  const [wasCall, setWasCall] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      controllerRef.current?.abort();   // уход с экрана: загрузка не должна идти в пустоту
    };
  }, []);

  const pick = () => inputRef.current?.click();

  const accept = (f: File | undefined | null) => {
    if (!f) return;
    const problem = precheckFile(f);
    setFile(f);
    if (problem) {
      setError(problem);
      setStage('error');
      return;
    }
    setError(null);
    setType(consultationType);
    setVisitDate(defaultVisitDate(f.lastModified, Date.now()));
    setWasCall(false);
    setStage('confirm');
  };

  const reset = () => {
    setStage('idle');
    setFile(null);
    setProgress(null);
    setError(null);
  };

  const start = async () => {
    if (!file || blocked) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setProgress({ phase: 'upload', loaded: 0, total: file.size });
    setError(null);
    setStage('busy');
    try {
      await onImport(file, {
        consultationType: type,
        visitDate: /^\d{4}-\d{2}-\d{2}$/.test(visitDate) ? visitDate : todayIso(),
        wasCall,
        signal: controller.signal,
        onProgress: (p) => { if (aliveRef.current && !controller.signal.aborted) setProgress(p); },
      });
      if (aliveRef.current) reset();   // дальше ход показывает карточка расшифровки
    } catch (err: any) {
      if (!aliveRef.current) return;
      if (controller.signal.aborted || err?.name === 'AbortError') { reset(); return; }
      setError(err?.message || 'Не удалось загрузить файл');
      setStage('error');
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  const pct = progress?.phase === 'upload' && progress.total
    ? Math.min(100, Math.round(((progress.loaded ?? 0) / progress.total) * 100))
    : 100;

  const fileRow = file && (
    <div className="flex items-center gap-2.5 bg-ds-50 border border-ds-200 rounded-lg px-3 py-2 mb-3">
      <div className="w-9 h-9 rounded-md bg-primary-50 text-primary-700 text-[10px] font-semibold uppercase flex items-center justify-center flex-shrink-0">
        {extOf(file.name)}
      </div>
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-ds-900 truncate">{file.name}</div>
        <div className="text-[11px] text-ds-600">{formatSize(file.size)}</div>
      </div>
    </div>
  );

  return (
    <div className="bg-white border border-ds-200 p-5 rounded-xl shadow-sm hover:border-primary-200 hover:shadow-md transition-all">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; accept(f); }}
      />
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center">
          <FolderOpen size={18} />
        </div>
        <div>
          <h3 className="font-semibold text-ds-900 text-[14px]">Запись из файла</h3>
          <p className="text-[12px] text-ds-600">Диктофон, телефон, петличка</p>
        </div>
      </div>

      {stage === 'idle' && (
        <>
          {/* Компьютер: зона перетаскивания; телефон: обычная кнопка */}
          <div
            onDragOver={(e) => { e.preventDefault(); if (!blocked) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!blocked) accept(e.dataTransfer.files?.[0]); }}
            className={`hidden md:flex flex-col items-center justify-center text-center rounded-lg border-2 border-dashed px-3 py-5 text-[12px] text-ds-600 transition-colors ${
              dragOver ? 'border-primary-500 bg-primary-50' : 'border-ds-200 bg-ds-50'
            } ${blocked ? 'opacity-40' : ''}`}
          >
            <span className="font-semibold text-ds-900">Перетащите файл сюда</span>
            <button
              type="button"
              onClick={pick}
              disabled={blocked}
              className="text-primary-600 hover:underline disabled:cursor-not-allowed disabled:no-underline"
            >
              или выберите на компьютере
            </button>
          </div>
          <button
            type="button"
            onClick={pick}
            disabled={blocked}
            className="md:hidden w-full py-2.5 bg-white border border-primary-200 text-primary-700 font-semibold text-[13px] rounded-lg hover:bg-primary-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Выбрать файл
          </button>
          <p className="text-[11px] text-ds-600 mt-3 leading-snug">mp3, m4a, wav, ogg, amr, flac · до 2 часов</p>
        </>
      )}

      {stage === 'confirm' && file && (
        <div>
          {fileRow}
          <div className="flex gap-1 bg-ds-100 rounded-lg p-1 mb-3">
            {(['primary', 'follow-up'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                  type === t ? 'bg-white text-primary-600 shadow-sm' : 'text-ds-600 hover:text-ds-900'
                }`}
              >
                {t === 'primary' ? 'Первичный' : 'Повторный'}
              </button>
            ))}
          </div>
          <label className="flex items-center justify-between gap-3 text-[12px] text-ds-900 mb-1">
            <span className="font-semibold">Дата приёма</span>
            <input
              type="date"
              value={visitDate}
              max={todayIso()}
              onChange={(e) => setVisitDate(e.target.value)}
              className="border border-ds-200 rounded-md px-2 py-1 text-[12px] text-ds-900 bg-white"
            />
          </label>
          <p className="text-[11px] text-ds-600 mb-3 leading-snug">Взята из файла. Если запись пересылали — проверьте.</p>
          <label className="flex items-center gap-2 text-[12px] text-ds-900 mb-3 cursor-pointer">
            <input type="checkbox" checked={wasCall} onChange={(e) => setWasCall(e.target.checked)} />
            Это был звонок
          </label>
          {priorContextLength > 0 && (
            <p className="text-[11px] text-primary-700 bg-primary-50 rounded-md px-2.5 py-1.5 mb-3">
              Учтён контекст «Из МИС» ({priorContextLength} знаков)
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={reset}
              className="text-[12px] font-semibold px-3 py-2 text-ds-600 hover:text-ds-900"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={start}
              disabled={blocked || !visitDate}
              className="flex-1 py-2.5 bg-primary-600 text-white font-semibold text-[13px] rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Расшифровать
            </button>
          </div>
        </div>
      )}

      {stage === 'busy' && (
        <div aria-live="polite">
          {fileRow}
          <div className="flex items-center gap-2.5 text-[12px] font-semibold text-primary-800">
            <div className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin flex-shrink-0" />
            {progress?.phase === 'prepare' ? 'Подготовка записи' : `Загрузка на сервер · ${pct} %`}
          </div>
          <div className="w-full h-1.5 bg-ds-200 rounded-full overflow-hidden mt-3">
            <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-ds-600 mt-2 leading-snug">Не закрывайте вкладку, пока файл загружается.</p>
          <div className="flex justify-end mt-3">
            <button
              type="button"
              onClick={() => controllerRef.current?.abort()}
              className="text-[11px] font-semibold px-2.5 py-1.5 bg-white border border-primary-200 text-primary-700 rounded hover:bg-primary-100"
            >
              Отменить
            </button>
          </div>
        </div>
      )}

      {stage === 'error' && (
        <div aria-live="polite">
          {fileRow}
          <div className="bg-error-50 border border-error-200 rounded-lg p-3 mb-3 flex items-start gap-2">
            <AlertCircle size={14} className="text-error-800 mt-0.5 flex-shrink-0" />
            <p className="text-[12px] text-error-800 leading-relaxed">{error}</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={reset} className="text-[12px] font-semibold px-3 py-2 text-ds-600 hover:text-ds-900">
              Закрыть
            </button>
            <button
              type="button"
              onClick={pick}
              disabled={blocked}
              className="flex-1 py-2.5 bg-primary-600 text-white font-semibold text-[13px] rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Выбрать другой файл
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
