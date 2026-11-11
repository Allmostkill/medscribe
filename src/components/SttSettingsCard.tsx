import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  getSttEngineStatus, setSttEngine, retryGigaamDownload,
  type SttEngineStatus, type SttEngine,
} from '../services/sttEngine';

// Цифры для врача: меняются вместе с моделью, поэтому в одном месте.
const GIGAAM_DOWNLOAD_MB = 227;
const GIGAAM_EXTRA_MEMORY_GB = '0,3';
const POLL_MS = 2000;
const PRIVACY_NOTE =
  'Звук не покидает компьютер: обе модели работают здесь. В интернет программа обращается только один раз, чтобы скачать модель по вашей команде. Файлы сверяются по контрольным суммам.';

const BTN_PRIMARY = 'px-4 py-2 text-[12px] font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50';
const BTN_SECONDARY = 'px-4 py-2 text-[12px] font-semibold border border-ds-200 text-ds-900 rounded-lg hover:bg-ds-100 disabled:opacity-50';

const toMb = (bytes: number) => Math.round(bytes / 1e6);
const isBusyState = (s: string) => s === 'downloading' || s === 'verifying' || s === 'loading';

export default function SttSettingsCard() {
  const [status, setStatus] = useState<SttEngineStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Плитка GigaAM раскрыта (пояснение и кнопка «Скачать и включить»), хотя выбор ещё не сохранён.
  const [gigaamOpen, setGigaamOpen] = useState(false);
  const mounted = useRef(true);
  // Номер действия врача: ответ опроса, начатый до него, устарел и не должен затирать свежее состояние.
  const actionSeq = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    const seq = actionSeq.current;
    const r = await getSttEngineStatus();
    if (!mounted.current || seq !== actionSeq.current) return false;
    if (r.ok === false) { setLoadError(r.error); return false; }
    setLoadError(null);
    setStatus(r.value);
    return true;
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Опрос раз в 2 с только пока модель грузится; при ошибке чтения опрос останавливается.
  const gState = status?.gigaam.state;
  const polling = !!gState && isBusyState(gState) && !loadError;
  useEffect(() => {
    if (!polling) return;
    const t = setInterval(() => { void refresh(); }, POLL_MS);
    return () => clearInterval(t);
  }, [polling, refresh]);

  const choose = async (engine: SttEngine) => {
    actionSeq.current++;
    setBusy(true); setActionError(null);
    const r = await setSttEngine(engine);
    if (!mounted.current) return;
    setBusy(false);
    if (r.ok === false) { setActionError(r.error); return; }
    setStatus(r.value);
    setLoadError(null);
    if (engine === 'tone') setGigaamOpen(false);
  };

  const retry = async () => {
    actionSeq.current++;
    setBusy(true); setActionError(null);
    const r = await retryGigaamDownload();
    if (!mounted.current) return;
    setBusy(false);
    if (r.ok === false) { setActionError(r.error); return; }
    setStatus(r.value);
    setLoadError(null);
  };

  const selected = status?.selected ?? 'tone';
  const gigaamSelected = selected === 'gigaam';
  const gigaamExpanded = gigaamOpen || gigaamSelected;
  const g = status?.gigaam;
  const unreachable = status ? !status.toneReachable : false;
  const tile = (active: boolean) =>
    `text-left p-4 border rounded-xl ${active ? 'border-primary-500 bg-primary-50' : 'border-ds-200 bg-white hover:bg-ds-50'}`;

  const totalMb = g && g.totalBytes > 0 ? toMb(g.totalBytes) : GIGAAM_DOWNLOAD_MB;
  const percent = g && g.totalBytes > 0 ? Math.min(100, Math.round((g.downloadedBytes / g.totalBytes) * 100)) : 0;

  return (
    <div className="bg-white border border-ds-200 p-5 md:p-7 rounded-xl shadow-sm">
      <h4 className="text-[14px] font-semibold text-ds-900 mb-1">Распознавание речи</h4>
      <p className="text-[12px] text-ds-600 mb-5 pb-4 border-b border-ds-200">Движок, преобразующий голос в текст. Живой текст во время приёма всегда от T-one, выбор влияет на итоговую расшифровку после «Завершить».</p>

      {loadError && !status && (
        <div className="space-y-3">
          <p className="text-[13px] text-error-700">{loadError}</p>
          <button type="button" onClick={() => { void refresh(); }} className={BTN_SECONDARY}>Повторить</button>
        </div>
      )}
      {!status && !loadError && <p className="text-[13px] text-ds-600">Проверяю состояние…</p>}

      {status && (
        <div className="space-y-4">
          {unreachable && (
            <p role="alert" className="flex items-start gap-2 text-[12px] text-warning-900 bg-warning-50 border border-warning-200 rounded-lg p-3">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> Служба распознавания речи недоступна
            </p>
          )}
          {status.settingsUnavailable && (
            <p className="text-[12px] text-warning-900">Не удалось прочитать сохранённый выбор (база данных недоступна): показан T-one по умолчанию.</p>
          )}
          {loadError && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[12px] text-error-700">Не удалось обновить состояние: {loadError}</p>
              <button type="button" onClick={() => { void refresh(); }} className={BTN_SECONDARY}>Повторить</button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Движок распознавания речи">
            <button
              type="button" role="radio" aria-checked={!gigaamSelected}
              disabled={busy}
              onClick={() => { if (gigaamSelected) void choose('tone'); else setGigaamOpen(false); }}
              className={tile(!gigaamSelected && !gigaamOpen)}
            >
              <div className="text-[13px] font-semibold text-ds-900">T-one (Т-Банк) · по умолчанию</div>
              <div className="text-[11px] text-ds-600 mt-1">Уже установлена, быстрая. Хуже слышит собеседника вдали от микрофона.</div>
            </button>
            <button
              type="button" role="radio" aria-checked={gigaamSelected} aria-expanded={gigaamExpanded}
              disabled={busy}
              onClick={() => setGigaamOpen(true)}
              className={tile(gigaamExpanded)}
            >
              <div className="text-[13px] font-semibold text-ds-900">GigaAM v3 (Сбер) · точнее</div>
              <div className="text-[11px] text-ds-600 mt-1">
                Разовая загрузка ≈{GIGAAM_DOWNLOAD_MB} МБ, немного больше памяти (≈{GIGAAM_EXTRA_MEMORY_GB} ГБ). Слышит больше речи, в том числе собеседника вдали от микрофона, и на нашем Mac расшифровывает быстрее T-one. Живой текст во время приёма — по-прежнему T-one.
              </div>
            </button>
          </div>

          {gigaamExpanded && g && (
            <div className="p-4 border border-ds-200 bg-ds-50 rounded-xl space-y-3">
              {!gigaamSelected && (
                <>
                  <p className="text-[13px] text-ds-900">
                    {g.state === 'ready'
                      ? 'GigaAM точнее расшифровывает запись целиком. Модель уже скачана, качать заново не нужно.'
                      : `GigaAM точнее расшифровывает запись целиком. Модель скачивается один раз (≈${GIGAAM_DOWNLOAD_MB} МБ), после этого работает без интернета.`}
                  </p>
                  <button type="button" onClick={() => { void choose('gigaam'); }} disabled={busy || unreachable} className={BTN_PRIMARY}>
                    {busy ? 'Включаю…' : g.state === 'ready' ? 'Включить GigaAM' : `Скачать и включить (≈${GIGAAM_DOWNLOAD_MB} МБ)`}
                  </button>
                </>
              )}

              {gigaamSelected && isBusyState(g.state) && (
                <div className="space-y-2">
                  <p className="text-[13px] text-ds-900">
                    {g.state === 'downloading' && `Загружено ${toMb(g.downloadedBytes)} из ${totalMb} МБ`}
                    {g.state === 'verifying' && 'Проверяю контрольные суммы…'}
                    {g.state === 'loading' && 'Запускаю модель…'}
                  </p>
                  <div
                    role="progressbar" aria-label="Загрузка модели GigaAM"
                    aria-valuemin={0} aria-valuemax={100} aria-valuenow={g.state === 'downloading' ? percent : 100}
                    className="h-2 bg-ds-200 rounded-full overflow-hidden"
                  >
                    <div className="h-full bg-primary-600" style={{ width: `${g.state === 'downloading' ? percent : 100}%` }} />
                  </div>
                  <p className="text-[12px] text-ds-600">Пока модель загружается, расшифровка идёт через T-one.</p>
                </div>
              )}

              {gigaamSelected && g.state === 'failed' && (
                <div className="space-y-2">
                  <p role="alert" className="text-[13px] text-error-700">{g.error || 'Не удалось подготовить модель. Нажмите «Повторить».'}</p>
                  <p className="text-[12px] text-ds-600">Пока расшифровка идёт через T-one.</p>
                  <button type="button" onClick={() => { void retry(); }} disabled={busy || unreachable} className={BTN_SECONDARY}>Повторить</button>
                </div>
              )}

              {gigaamSelected && g.state === 'ready' && (
                <p className="text-[13px] text-success-700 font-semibold">Работает: GigaAM</p>
              )}

              {gigaamSelected && (g.state === 'absent' || g.state === 'unknown') && (
                <div className="space-y-2">
                  <p className="text-[12px] text-ds-600">
                    {g.state === 'absent' ? 'Модель ещё не скачана. Пока расшифровка идёт через T-one.' : 'Состояние модели неизвестно. Пока расшифровка идёт через T-one.'}
                  </p>
                  <button type="button" onClick={() => { void retry(); }} disabled={busy || unreachable} className={BTN_SECONDARY}>Скачать модель</button>
                </div>
              )}

              {gigaamSelected && (
                <button type="button" onClick={() => { void choose('tone'); }} disabled={busy} className={BTN_SECONDARY}>Вернуться к T-one</button>
              )}
            </div>
          )}

          {actionError && <p role="alert" className="text-[12px] text-error-700">{actionError}</p>}
          <p className="text-[11px] text-ds-600">{PRIVACY_NOTE}</p>
        </div>
      )}
    </div>
  );
}
