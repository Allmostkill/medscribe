import { useCallback, useEffect, useRef, useState } from 'react';
import { Save, RefreshCw, AlertCircle } from 'lucide-react';
import {
  getLlmStatus, saveLlmSettings, deleteLlmSettings, testLlm, discoverOllama,
  type LlmStatus, type LlmProvider, type LlmDraft, type LlmTestResult, type OllamaDiscovery, type OllamaModel,
} from '../services/llmSettings';
import {
  DEFAULT_OLLAMA_URL, LLM_PRESETS as PRESETS, applyPreset as presetToForm, keyState, keyProblem,
  fillFromDiscovery, foundOllamaPair, keyRequired, sameOrigin, testSnapshot, isTestCurrent, testMode, acceptTestResponse, modelOptions, offerFoundOllama, type FoundOllama,
} from '../utils/llmForm';

const TRANSFER_WARNING =
  'Текст приёма после частичного обезличивания будет отправляться этому провайдеру. Если его серверы за рубежом, это трансграничная передача данных о здоровье (152-ФЗ): нужны письменное согласие пациента и уведомление Роскомнадзора. Обезличивание неполное. Чтобы текст не покидал компьютер, используйте Ollama с локальной моделью.';
const OLLAMA_CLOUD_WARNING =
  'Модель с пометкой cloud работает не на вашем компьютере, а на серверах Ollama: текст приёма уйдёт туда.';
const ACK_LABEL = 'Я понимаю, что текст приёма уйдёт провайдеру';
// В src/config/about.ts ссылки на инструкцию пока нет, поэтому она здесь (раздел 4.4 «Подключение локальной модели (Ollama)»).
const GUIDE_URL = 'https://github.com/Allmostkill/medscribe/blob/main/docs/GUIDE.md';
const OLLAMA_GUIDE_URL = `${GUIDE_URL}#44-подключение-локальной-модели-ollama`;
const TEST_BLOCKED_HINT = 'Заполните адрес и модель — проверяется то, что введено в форме.';
const TIMEOUT_MIN = 5;
const TIMEOUT_MAX = 600;

const INPUT = 'w-full text-[13px] text-ds-900 border border-ds-200 rounded-lg px-3 py-2 focus:outline-none focus:border-primary-500';
const LABEL = 'block text-[11px] font-semibold uppercase tracking-wide text-ds-600 mb-1.5';
const BTN_SECONDARY = 'px-4 py-2 text-[12px] font-semibold border border-ds-200 text-ds-900 rounded-lg hover:bg-ds-100 disabled:opacity-50';

/** Эвристика для ручного ввода имени: у моделей Ollama Cloud в имени стоит cloud. */
const looksCloud = (name: string) => /(^|[:\-_/])cloud$/i.test(name.trim());

/** Адрес ведёт на этот компьютер или в частную сеть. Пустой — ещё ничего не введено; нечитаемый считаем внешним. */
function isLocalUrl(raw: string): boolean {
  const v = raw.trim();
  if (!v) return true;
  let host: string;
  try { host = new URL(v).hostname.toLowerCase(); } catch { return false; }
  if (host === 'localhost' || host === '[::1]' || host === 'host.docker.internal' || host === 'gateway.docker.internal') return true;
  if (/^127\.\d+\.\d+\.\d+$/.test(host) || /^10\.\d+\.\d+\.\d+$/.test(host) || /^192\.168\.\d+\.\d+$/.test(host)) return true;
  const m = /^172\.(\d+)\.\d+\.\d+$/.exec(host);
  return !!m && Number(m[1]) >= 16 && Number(m[1]) <= 31;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function LlmSettingsCard() {
  const [status, setStatus] = useState<LlmStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [provider, setProvider] = useState<LlmProvider>('ollama');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKeyRaw] = useState('');
  // Счётчик правок ключа: результат проверки привязан к нему, сам ключ в отпечаток не попадает.
  const [keyVersion, setKeyVersion] = useState(0);
  const setApiKey = (v: string) => { setApiKeyRaw(v); setKeyVersion(n => n + 1); };
  const [jsonMode, setJsonMode] = useState(true);
  const [timeoutSec, setTimeoutSec] = useState('');
  const [password, setPassword] = useState('');
  const [ack, setAck] = useState(false);
  const [serverAckMsg, setServerAckMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);

  const [discovery, setDiscovery] = useState<OllamaDiscovery | null>(null);
  const [listMode, setListMode] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  const [busy, setBusy] = useState<'save' | 'test' | 'delete' | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedSnap, setSavedSnap] = useState<string | null>(null);
  const [savePending, setSavePending] = useState(false);
  const [test, setTest] = useState<{ snap: string; result: LlmTestResult } | null>(null);
  const testReq = useRef(0);
  const snapRef = useRef('');

  const stored = status?.settings ?? null;
  const foundOllama: FoundOllama<OllamaModel> | null = discovery?.found === true ? discovery : null;

  const fillFrom = useCallback((s: LlmStatus) => {
    if (!s.settings) return;
    touched.current = false;
    setProvider(s.settings.provider);
    setBaseUrl(s.settings.baseUrl);
    setModel(s.settings.model);
    setJsonMode(s.settings.jsonMode);
    setTimeoutSec(String(Math.round(s.settings.timeoutMs / 1000)));
  }, []);

  const [reloading, setReloading] = useState(false);
  // Пользователь уже менял адрес/модель/вариант: поздний ответ поиска их не перезаписывает.
  const touched = useRef(false);
  const [edited, setEdited] = useState(false);
  const discoveryReq = useRef(0);
  const formRef = useRef({ baseUrl: '', model: '' });

  const loadStatus = useCallback(async (isCancelled: () => boolean = () => false) => {
    setReloading(true);
    const r = await getLlmStatus();
    if (isCancelled()) return;
    setReloading(false);
    if (r.ok === true) { setStatusError(null); setStatus(r.value); fillFrom(r.value); } else setStatusError(r.error);
  }, [fillFrom]);

  useEffect(() => {
    let cancelled = false;
    void loadStatus(() => cancelled);
    return () => { cancelled = true; };
  }, [loadStatus]);

  const runDiscovery = useCallback(async () => {
    const id = ++discoveryReq.current;
    setDiscovering(true);
    setDiscoveryError(null);
    const r = await discoverOllama();
    if (id !== discoveryReq.current) return;   // пришёл более новый поиск
    setDiscovering(false);
    if (r.ok === false) { setDiscoveryError(r.error); return; }
    setDiscovery(r.value);
    // Найденная Ollama сама форму не меняет: только пустую и нетронутую.
    const pair = fillFromDiscovery(formRef.current, !touched.current, r.value.found === true ? r.value : null);
    setBaseUrl(pair.baseUrl); setModel(pair.model);
  }, []);

  // Форма загружена или сохранена, а Ollama уже найдена: пересчитываем способ выбора модели.
  useEffect(() => {
    setListMode(modelOptions(formRef.current, foundOllama) !== null);
  }, [status, foundOllama]);

  // Ищем Ollama сами, как только форма загружена и выбран этот вариант.
  useEffect(() => {
    if (status && provider === 'ollama' && !discovery && !discovering && !discoveryError) void runDiscovery();
  }, [status, provider, discovery, discovering, discoveryError, runDiscovery]);

  const switchProvider = (p: LlmProvider) => {
    if (p === provider) return;
    touched.current = true;
    setProvider(p);
    setAck(false); setServerAckMsg(null); setConfirmDelete(false);
    setApiKey(''); setFormError(null); setTest(null); setSavedSnap(null);
    if (stored && stored.provider === p) {
      setBaseUrl(stored.baseUrl); setModel(stored.model);
      setListMode(!!foundOllama && modelOptions(stored, foundOllama) !== null);
    } else if (p === 'ollama') {
      const pair = foundOllama ? foundOllamaPair(foundOllama) : { baseUrl: DEFAULT_OLLAMA_URL, model: '' };
      setBaseUrl(pair.baseUrl); setModel(pair.model); setListMode(!!foundOllama && modelOptions(pair, foundOllama) !== null);
    } else {
      setBaseUrl(''); setModel('');
    }
  };

  formRef.current = { baseUrl, model };
  // Выбор из списка или ручной ввод решается не на каждый символ, а при загрузке, после поиска,
  // по выходу из поля адреса и по явному выбору найденной Ollama — иначе поле меняется под рукой.
  const options = provider === 'ollama' && listMode ? modelOptions({ baseUrl, model }, foundOllama) : null;
  const refreshListMode = () => setListMode(modelOptions(formRef.current, foundOllama) !== null);
  const selectedOllama = foundOllama?.models.find(m => m.name === model);
  const ollamaCloud = provider === 'ollama' && (selectedOllama ? selectedOllama.cloud : looksCloud(model));
  const remoteUrl = !isLocalUrl(baseUrl);
  const ackNeeded = provider === 'cloud' || ollamaCloud || remoteUrl || serverAckMsg !== null;
  const ackReason = serverAckMsg ?? (remoteUrl && provider === 'ollama' && !ollamaCloud
    ? 'Адрес не похож на локальный: текст приёма будет отправляться по этому адресу.' : null);
  const timeoutN = timeoutSec === '' ? null : parseInt(timeoutSec, 10);
  const timeoutBad = timeoutN !== null && !(timeoutN >= TIMEOUT_MIN && timeoutN <= TIMEOUT_MAX);

  // При смене адреса согласие сбрасывается: оно относится к конкретному адресу.
  const onBaseUrlChange = (v: string) => {
    touched.current = true; setEdited(true);
    // Набранный (ещё не сохранённый) ключ относился к прежнему серверу.
    if (!sameOrigin(baseUrl.trim(), v.trim())) setApiKey('');
    setBaseUrl(v); setAck(false); setServerAckMsg(null);
  };
  const onModelChange = (v: string) => { touched.current = true; setEdited(true); setModel(v); setAck(false); };
  // Пресет задаёт адрес и модель вместе; результат прежней проверки к ним уже не относится.
  const applyPreset = (p: typeof PRESETS[number]) => {
    const next = presetToForm({ baseUrl, model, apiKey }, p);
    onBaseUrlChange(next.baseUrl); setModel(next.model); setApiKey(next.apiKey);
    setFormError(null); setTest(null); setSavedSnap(null);
  };
  const chooseFoundOllama = () => {
    if (!foundOllama) return;
    const pair = foundOllamaPair(foundOllama);
    onBaseUrlChange(pair.baseUrl); setModel(pair.model);
    setListMode(true);
    setFormError(null); setTest(null);
  };
  // Прежний ключ сервер применит только к тому же серверу (keyAfterUpdate).
  const keySt = keyState(stored, { provider, baseUrl });
  const keyKept = keySt === 'kept';
  const keyIssue = keyProblem(stored, { provider, baseUrl, apiKey });

  const buildDraft = (): LlmDraft => {
    const secs = parseInt(timeoutSec, 10);
    const draft: LlmDraft = {
      provider,
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      jsonMode,
    };
    if (Number.isFinite(secs) && secs >= TIMEOUT_MIN && secs <= TIMEOUT_MAX) draft.timeoutMs = secs * 1000;
    if (provider === 'cloud' && apiKey.trim()) draft.apiKey = apiKey.trim();
    return draft;
  };

  const fieldsOk = baseUrl.trim().length > 0 && model.trim().length > 0;
  const canSave = fieldsOk && !keyIssue && !timeoutBad && password.length > 0 && (!ackNeeded || ack) && busy === null;

  const onSave = async () => {
    setBusy('save'); setFormError(null); setSavedSnap(null);
    const r = await saveLlmSettings(buildDraft(), password, ackNeeded && ack);
    setBusy(null);
    // Пароль и ключ не остаются в форме ни при успехе, ни при ошибке сервера.
    setPassword(''); setApiKey('');
    if (r.ok === false) {
      if (r.code === 'ack_required') { setServerAckMsg(r.error); setAck(false); } else setFormError(r.error);
      return;
    }
    setServerAckMsg(null);
    setStatus(r.value); fillFrom(r.value);
    setSavePending(true); setTest(null);
  };

  const formNow = { provider, baseUrl, model, jsonMode, timeoutSec, keyVersion };
  const snap = testSnapshot(formNow);
  snapRef.current = snap;
  const testCurrent = isTestCurrent(test, formNow);
  const testResult = testCurrent ? test!.result : null;
  const saved = savedSnap === snap;

  // «Сохранено» относится к форме, какой она стала после сохранения; любая правка снимает отметку.
  useEffect(() => {
    if (savePending) { setSavedSnap(snap); setSavePending(false); }
  }, [savePending, snap]);

  const mode = testMode({ provider, baseUrl, model, jsonMode, timeoutSec, apiKey }, stored);
  const onTest = async () => {
    const reqId = ++testReq.current;
    const testedSnap = snap;
    setBusy('test'); setTest(null);
    if (mode === 'blocked') { setBusy(null); return; }
    const r = await testLlm(mode === 'draft' ? buildDraft() : undefined);
    setBusy(null);
    if (acceptTestResponse(reqId, testReq.current, testedSnap, snapRef.current)) setTest({ snap: testedSnap, result: r });
  };

  const onDelete = async () => {
    if (!password) { setFormError('Введите пароль в поле «Ваш пароль» выше, чтобы отключить модель.'); return; }
    setBusy('delete'); setFormError(null); setSavedSnap(null);
    const r = await deleteLlmSettings(password);
    setBusy(null);
    setPassword('');
    if (r.ok === false) { setFormError(r.error); return; }
    setConfirmDelete(false);
    setStatus(r.value);
    setBaseUrl(''); setModel(''); setApiKey(''); setAck(false); setServerAckMsg(null); setTest(null);
  };

  return (
    <div className="bg-white border border-ds-200 p-5 md:p-7 rounded-xl shadow-sm">
      <h4 className="text-[14px] font-semibold text-ds-900 mb-1">Языковая модель</h4>
      <p className="text-[12px] text-ds-600 mb-5 pb-4 border-b border-ds-200">Составляет протокол и подсказки по тексту приёма</p>

      {statusError ? (
        <p className="text-[13px] text-error-700">{statusError}</p>
      ) : !status ? (
        <p className="text-[13px] text-ds-600">Проверяю состояние…</p>
      ) : status.unavailable ? (
        <div className="space-y-3">
          <p className="text-[13px] text-warning-900">Не удалось прочитать настройки (база данных недоступна). Повторите через минуту.</p>
          <button type="button" onClick={() => void loadStatus()} disabled={reloading} className={`${BTN_SECONDARY} inline-flex items-center gap-2`}>
            <RefreshCw size={12} className={reloading ? 'animate-spin' : ''} /> Обновить
          </button>
        </div>
      ) : (
        <>
          {/* Текущее состояние */}
          {status.configured ? (
            <p className="text-[13px] text-ds-900 mb-5">
              Подключена: <span className="font-mono break-all">{status.model}</span> · <span className="font-mono break-all">{status.host}</span>
              {' '}· ключ: {status.hasKey ? (stored?.keyMask ?? 'задан') : 'не задан'}
              {status.source === 'cabinet' && ' · из личного кабинета'}
              {status.source === 'env' && ' · из файла .env'}
              {stored?.transferAckAt && formatDate(stored.transferAckAt) && (
                <span className="block text-[11px] text-ds-600 mt-1">передача подтверждена {formatDate(stored.transferAckAt)}</span>
              )}
            </p>
          ) : (
            <p className="text-[13px] text-warning-900 mb-5">Не подключена — протокола и подсказок не будет. Выберите вариант ниже.</p>
          )}

          {/* Вариант подключения */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5" role="radiogroup" aria-label="Вариант подключения">
            {([
              ['ollama', 'Ollama на этом компьютере', 'Текст приёма остаётся у вас (если модель локальная)'],
              ['cloud', 'Облачная модель', 'Адрес API и ключ от провайдера'],
            ] as const).map(([id, title, hint]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={provider === id}
                onClick={() => switchProvider(id)}
                className={`text-left p-3 border rounded-xl transition-all ${provider === id ? 'border-primary-500 ring-2 ring-primary-500 bg-primary-50' : 'border-ds-200 hover:border-primary-200'}`}
              >
                <div className="text-[13px] font-semibold text-ds-900">{title}</div>
                <div className="text-[11px] text-ds-600 mt-0.5">{hint}</div>
              </button>
            ))}
          </div>

          {provider === 'ollama' ? (
            <div className="space-y-4">
              {discovering ? (
                <p className="text-[13px] text-ds-600">Ищу Ollama на этом компьютере…</p>
              ) : discoveryError ? (
                <p className="text-[13px] text-error-700">{discoveryError}</p>
              ) : discovery?.found === true ? (
                <p className="text-[13px] text-success-700">Ollama найдена, моделей: {discovery.models.length}</p>
              ) : discovery?.found === false ? (
                <p className="text-[13px] text-warning-900">
                  {discovery.hint}{' '}
                  <a href={OLLAMA_GUIDE_URL} target="_blank" rel="noopener noreferrer" className="underline text-primary-700">Инструкция по подключению Ollama</a>
                </p>
              ) : null}

              {foundOllama && offerFoundOllama({ baseUrl, model }, foundOllama) && (
                <div className="text-[13px] text-ds-900 space-y-2">
                  <p>Найдена Ollama на этом компьютере: <span className="font-mono break-all">{foundOllama.baseUrl}</span>. Сейчас в форме другой адрес: <span className="font-mono break-all">{baseUrl || 'не задан'}</span>.</p>
                  <button type="button" onClick={chooseFoundOllama} className={BTN_SECONDARY}>Использовать найденную Ollama</button>
                </div>
              )}

              {discovery?.found === true && discovery.models.length === 0 && (
                <p className="text-[13px] text-warning-900">
                  Скачайте модель: в терминале выполните <code className="font-mono">ollama pull qwen2.5:7b</code> и нажмите «Найти ещё раз».
                </p>
              )}

              <button type="button" onClick={() => { void runDiscovery(); }} disabled={discovering} className={`${BTN_SECONDARY} inline-flex items-center gap-2`}>
                <RefreshCw size={12} className={discovering ? 'animate-spin' : ''} /> {discovery ? 'Найти ещё раз' : 'Найти Ollama'}
              </button>

              {listMode ? (
                <div>
                  <label className={LABEL} htmlFor="llm-model-select">Модель</label>
                  {options ? (
                    <>
                      <select id="llm-model-select" value={model} onChange={e => onModelChange(e.target.value)} className={INPUT}>
                        {!model && <option value="" disabled>Выберите модель</option>}
                        {options.map(o => {
                          const m = foundOllama?.models.find(x => x.name === o.name);
                          return (
                            <option key={o.name} value={o.name}>
                              {o.name}{o.saved ? ' · сохранена, не найдена в списке' : ''}
                              {m?.parameterSize ? ` · ${m.parameterSize}` : ''}{m?.sizeGb ? ` · ${m.sizeGb} ГБ` : ''}{m?.cloud ? ' · cloud' : ''}
                            </option>
                          );
                        })}
                      </select>
                      {!model && <p className="text-[12px] text-warning-900 mt-1">Выберите модель из списка: пока она не выбрана, сохранить настройки нельзя.</p>}
                    </>
                  ) : (
                    <input id="llm-model-select" value={model} onChange={e => onModelChange(e.target.value)} className={`${INPUT} font-mono`} />
                  )}
                </div>
              ) : (discovery || baseUrl || model) && !discovering ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL} htmlFor="llm-base-url">Адрес Ollama</label>
                    <input id="llm-base-url" value={baseUrl} onChange={e => onBaseUrlChange(e.target.value)} onBlur={refreshListMode} placeholder={DEFAULT_OLLAMA_URL} className={`${INPUT} font-mono`} />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="llm-model">Модель</label>
                    <input id="llm-model" value={model} onChange={e => onModelChange(e.target.value)} placeholder="например, qwen2.5:7b" className={`${INPUT} font-mono`} />
                  </div>
                </div>
              ) : null}

              {keyIssue && <p className="text-[12px] text-error-700">{keyIssue}</p>}

              {ollamaCloud && (
                <p className="flex items-start gap-2 text-[12px] text-warning-900 bg-warning-50 border border-warning-200 rounded-lg p-3">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> {OLLAMA_CLOUD_WARNING}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="flex items-start gap-2 text-[12px] text-warning-900 bg-warning-50 border border-warning-200 rounded-lg p-3">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> {TRANSFER_WARNING}
              </p>
              <div>
                <div className={LABEL}>Быстрый выбор провайдера</div>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map(p => (
                    <button key={p.name} type="button" onClick={() => applyPreset(p)} className={BTN_SECONDARY}>{p.name}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={LABEL} htmlFor="llm-base-url">Адрес API</label>
                <input id="llm-base-url" value={baseUrl} onChange={e => onBaseUrlChange(e.target.value)} placeholder="https://api.example.com/v1" className={`${INPUT} font-mono`} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL} htmlFor="llm-model">Модель</label>
                  <input id="llm-model" value={model} onChange={e => onModelChange(e.target.value)} placeholder="название модели" className={`${INPUT} font-mono`} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="llm-key">Ключ API</label>
                  <input
                    id="llm-key"
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder={keyKept ? `${stored?.keyMask ?? '••••'} — оставьте пустым, чтобы не менять` : 'вставьте ключ'}
                    className={`${INPUT} font-mono`}
                  />
                  {keySt === 'origin_changed' && !apiKey.trim() && (
                    <p className="text-[12px] text-warning-900 mt-1">
                      {keyRequired(baseUrl)
                        ? 'Адрес изменился: сохранённый ключ к новому провайдеру не передаётся. Нужен ключ этого провайдера.'
                        : 'Прежний ключ на новый адрес не передаётся. Если API требует ключ — вставьте его.'}
                    </p>
                  )}
                  {keyIssue && keySt !== 'origin_changed' && <p className="text-[12px] text-error-700 mt-1">{keyIssue}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Дополнительно */}
          <details className="mt-5" open={advOpen} onToggle={e => setAdvOpen(e.currentTarget.open)}>
            <summary className="text-[12px] font-semibold text-ds-700 cursor-pointer">Дополнительно</summary>
            <div className="mt-3 space-y-3">
              {provider === 'ollama' && listMode && (
                <div>
                  <label className={LABEL} htmlFor="llm-base-url-adv">Адрес Ollama</label>
                  <input id="llm-base-url-adv" value={baseUrl} onChange={e => onBaseUrlChange(e.target.value)} onBlur={refreshListMode} className={`${INPUT} font-mono`} />
                </div>
              )}
              <label className="flex items-center gap-2 text-[13px] text-ds-900">
                <input type="checkbox" checked={jsonMode} onChange={e => setJsonMode(e.target.checked)} />
                Режим JSON (отключите, если модель его не поддерживает)
              </label>
              <div className="max-w-[200px]">
                <label className={LABEL} htmlFor="llm-timeout">Ожидание ответа, с</label>
                <input
                  id="llm-timeout"
                  inputMode="numeric"
                  value={timeoutSec}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '');
                    setTimeoutSec(v);
                    if (v !== '' && !(Number(v) >= TIMEOUT_MIN && Number(v) <= TIMEOUT_MAX)) setAdvOpen(true);
                  }}
                  placeholder={provider === 'ollama' ? '180' : '60'}
                  aria-invalid={timeoutBad}
                  className={`${INPUT} ${timeoutBad ? 'border-error-700' : ''}`}
                />
                {timeoutBad && <p className="text-[12px] text-error-700 mt-1">Укажите число секунд от {TIMEOUT_MIN} до {TIMEOUT_MAX}</p>}
              </div>
            </div>
          </details>

          {/* Согласие и пароль */}
          <div className="mt-5 pt-4 border-t border-ds-200 space-y-4">
            {ackNeeded && (
              <div className="space-y-1.5">
                {ackReason && <p className="text-[12px] text-warning-900">{ackReason}</p>}
                <label className="flex items-start gap-2 text-[13px] text-ds-900">
                  <input type="checkbox" className="mt-0.5" checked={ack} onChange={e => setAck(e.target.checked)} />
                  {ACK_LABEL}
                </label>
              </div>
            )}
            <div className="max-w-sm">
              <label className={LABEL} htmlFor="llm-password">Ваш пароль (для подтверждения)</label>
              <input id="llm-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={INPUT} />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={onSave}
                disabled={!canSave}
                className="px-4 py-2 text-[12px] font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Save size={13} /> {busy === 'save' ? 'Сохраняю…' : 'Сохранить'}
              </button>
              <button type="button" onClick={onTest} disabled={busy !== null || timeoutBad || !!keyIssue || mode === 'blocked'} title={keyIssue ?? (mode === 'blocked' ? TEST_BLOCKED_HINT : undefined)} className={BTN_SECONDARY}>
                {busy === 'test' ? 'Проверяю…' : 'Проверить подключение'}
              </button>
              {stored && !confirmDelete && (
                <button type="button" onClick={() => { setConfirmDelete(true); setFormError(null); }} disabled={busy !== null} className="px-4 py-2 text-[12px] font-medium text-error-700 hover:underline disabled:opacity-50">
                  Отключить
                </button>
              )}
            </div>

            {stored && confirmDelete && (
              <div className="border border-error-700 rounded-lg p-3 space-y-2" role="alertdialog" aria-label="Подтверждение удаления">
                <p className="text-[13px] text-ds-900">Удалить сохранённые настройки и ключ? Вернуть ключ будет нельзя.</p>
                {status.envConfigured && <p className="text-[12px] text-ds-600">После этого будет использоваться модель из .env.</p>}
                <div className="flex items-center gap-3 flex-wrap">
                  <button type="button" onClick={onDelete} disabled={busy !== null} className="px-4 py-2 text-[12px] font-semibold bg-error-700 text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                    {busy === 'delete' ? 'Отключаю…' : 'Да, удалить'}
                  </button>
                  <button type="button" onClick={() => { setConfirmDelete(false); setFormError(null); }} disabled={busy !== null} className={BTN_SECONDARY}>Отмена</button>
                </div>
              </div>
            )}
            {stored && !confirmDelete && status.envConfigured && (
              <p className="text-[11px] text-ds-600">«Отключить» удалит настройки из кабинета; будет использоваться модель из .env.</p>
            )}

            {mode === 'blocked' && edited && <p className="text-[12px] text-warning-900">{TEST_BLOCKED_HINT}</p>}
            {saved && <p className="text-[12px] text-success-700">Сохранено. Новые протоколы будут составляться этой моделью.</p>}
            {formError && <p className="text-[12px] text-error-700">{formError}</p>}
            {testResult?.ok === true && (
              <>
                <p className="text-[12px] text-success-700">Работает, ответ за {testResult.latencyMs} мс</p>
                {!testResult.jsonOk && (
                  <p className="text-[12px] text-warning-900">
                    Модель отвечает, но не в нужном формате. Откройте «Дополнительно» и отключите режим JSON, если модель его не поддерживает.
                  </p>
                )}
              </>
            )}
            {testResult?.ok === false && <p className="text-[12px] text-error-700">{testResult.error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
