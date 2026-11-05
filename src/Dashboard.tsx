import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Mic, Monitor, User, FileText, AlertCircle,
  CheckCircle, Activity, Copy,
  Settings, LogOut, ArrowLeft, X,
  Menu, Square, LayoutGrid, Printer, Wand2, Check, AlertTriangle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BrandLockup } from "./components/BrandMark";
import AutoTextarea from "./components/AutoTextarea";
import ServiceStatusBanner from "./components/ServiceStatusBanner";
import MicCheck from "./components/MicCheck";
import { ensureValidSession, getStoredSession, logout as logoutSession } from "./services/auth";
import { generateClinicalHints, analyzeConsultation, generatePharmaAnalysis, generateDiagnosisSuggestions, generatePatientSummary, ClinicalHint, DiagnosisSuggestion, requestCommunicationReview, checkNote, type NoteCheck, type NoteOmission } from "./services/ai";
import { DoctorProfile, EHRNote, TranscriptLine, PatientSummary } from "./types";
import { SecureMedicalSTT } from "./services/sttStream";
import { BufferedRecorder } from "./services/bufferedRecorder";
import { transcribeSession, type TranscriptionProgress } from "./services/sttFull";
import { EMPTY_STT_REASON, sttResultToLines, transcribeFailureMessage, planFinishTranscript, raceWithTimeout, refineTimeoutMs, FALLBACK_NOTICE_NO_AUDIO, isPendingForVisit, canRefineOnFinish, isResumedFinish, shouldDeleteAudio, INCOMPLETE_AUDIO_NOTICE, shouldClearPriorContextOnStart, type RefineOutcome } from "./utils/finishFlow";
import { listUnfinishedSessions, deleteSession, purgeOld, type SessionMeta } from "./services/audioBuffer";
import { mediaErrorMessage } from "./services/mediaErrors";
import { useServiceHealth } from "./services/health";
import { getSttEngineStatus, type SttEngine } from "./services/sttEngine";
import { ehrToMisText } from "./utils/ehrText";
import { isVoiceLabel, normalizeLineSpeaker, speakerLabel, toAnalyzeText } from "./utils/speakers";
import { formatSessionDuration } from "./utils/audioPersist";

import { MEDICAL_SPECIALTIES } from "./config/specialties";
import { SPECIALTY_UI } from "./config/checklists";
import { ChecklistPanel } from "./components/ChecklistPanel";

import { DEFAULT_LAYOUT, mergeWithDefaults, migrateLayout, findFreePlacement, type LayoutBlock, type CustomWidgetConfig } from "./config/workspace";
import { getIcd10Reference, findIcd10Categories } from "./config/icd10Reference";
import { getRedFlags } from "./config/redFlags";
import { findDoseMismatches } from "./utils/doseCheck";
import { MEMO_SECTIONS, needsDoctorWrittenCondition, isMemoBlank, memoToText } from "./utils/patientMemo";
import InsightsBlock from "./components/blocks/InsightsBlock";
import PharmaBlock from "./components/blocks/PharmaBlock";
import { COMMUNICATION_REVIEW_KEY } from "./components/CommunicationNotes";
import TranscriptBlock from "./components/blocks/TranscriptBlock";
import TranscribeStatusCard from "./components/TranscribeStatusCard";
import ChecklistBlock from "./components/blocks/ChecklistBlock";
import CustomWidgetBlock from "./components/blocks/CustomWidgetBlock";
import ReferenceBlock from "./components/blocks/ReferenceBlock";
import { type SelectedTemplate } from "./components/blocks/TemplatesBlock";
import WorkspaceGrid from "./components/blocks/WorkspaceGrid";
import WorkspaceToolbar from "./components/blocks/WorkspaceToolbar";
import WorkspaceWidgetModal from "./components/blocks/WorkspaceWidgetModal";

// Результат analyze по уточнённой стенограмме — его можно взять вместо второго платного прохода.
type DiarizeReuse = {
  data: NonNullable<Awaited<ReturnType<typeof analyzeConsultation>>['data']>;
  // с чем считали: если что-то из этого сменилось, результат не годится
  templateTitle: string | null; guideline: string; consultationType: string; priorContext: string;
};

// Подписи полей протокола для сверки со стенограммой (пропуски и статус).
const EHR_FIELD_KEYS: (keyof EHRNote)[] = ['complaints', 'anamnesisMorbi', 'anamnesisVitae', 'allergies', 'examination', 'diagnoses', 'medications', 'plan'];
const EHR_FIELD_LABELS: Record<keyof EHRNote, string> = {
  complaints: 'Жалобы', anamnesisMorbi: 'Анамнез заболевания', anamnesisVitae: 'Анамнез жизни',
  allergies: 'Аллергии', examination: 'Обследование', diagnoses: 'Диагноз',
  medications: 'Терапия', plan: 'План',
};
// Предел контекста «Из МИС» — как на сервере (PRIOR_CONTEXT_MAX).
const PRIOR_CONTEXT_MAX = 6000;

const OMISSION_LABELS: Record<NoteOmission['category'], string> = {
  allergy: 'Аллергия', medication: 'Препарат', diagnosis: 'Диагноз', timing: 'Сроки', other: 'Важное',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { health, reachable } = useServiceHealth();

  const [doctor, setDoctor] = useState<DoctorProfile>({
    name: "",
    specialty: MEDICAL_SPECIALTIES.therapist,
    experienceYears: 0
  });

  // Кому принадлежат записи звука в браузере (id из сессии; имя — для старых записей). null — врач ещё не известен.
  const [doctorKey, setDoctorKey] = useState<{ id: string; name: string } | null>(null);
  const doctorKeyRef = useRef(doctorKey);
  doctorKeyRef.current = doctorKey;

  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'microphone' | 'system'>('microphone');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'transcript' | 'insights' | 'pharma' | 'checklist'>('transcript');
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [currentSpeech, setCurrentSpeech] = useState("");

  const [hints, setHints] = useState<ClinicalHint[]>([]);
  const [pharmaHints, setPharmaHints] = useState<string[]>([]);
  const [isGeneratingHints, setIsGeneratingHints] = useState(false);

  const [ehrNote, setEhrNote] = useState<EHRNote | null>(null);
  const [isGeneratingEHR, setIsGeneratingEHR] = useState(false);

  // Cached EHR from the auto-diarize step (stenographer mode). When the doctor
  // hits "Сохранить протокол", we use this instead of calling /api/ai/analyze
  // a second time. Cleared whenever transcript changes substantively.
  // Помечаем кэш названием шаблона, с которым он был собран (null — без
  // шаблона): если врач выбрал шаблон уже ПОСЛЕ диаризации, старый протокол
  // шаблона не учитывает и переиспользовать его нельзя — надо пересобрать.
  const [cachedEhrFromDiarize, setCachedEhrFromDiarize] = useState<{ ehr: EHRNote; templateTitle: string | null } | null>(null);
  const [isDiarizing, setIsDiarizing] = useState(false);
  // Текущая стенограмма получена разметкой по голосу: её повторный разбор идёт
  // в режиме «по голосу» (текст не переписывается), см. /api/ai/analyze.
  const voiceLabelledRef = useRef(false);
  // ── Сверка протокола со стенограммой ────────────────────────────────────
  // Запускается сама после сборки протокола (это второй, проверяющий проход —
  // см. /api/ai/note-check) и вручную кнопкой после правок. noteCheckSourceEhr —
  // снимок протокола на момент сверки: правки делают её устаревшей, и тогда
  // цитаты под полями прятать нельзя молча, но и показывать как актуальные —
  // тоже. consultationWasRemote запоминается на момент сборки.
  const [noteCheck, setNoteCheck] = useState<NoteCheck | null>(null);
  const [noteCheckSourceEhr, setNoteCheckSourceEhr] = useState<string | null>(null);
  const [isCheckingNote, setIsCheckingNote] = useState(false);
  const [noteCheckError, setNoteCheckError] = useState<string | null>(null);
  const [consultationWasRemote, setConsultationWasRemote] = useState(false);
  // Протокол собран по личному шаблону врача (сервер берёт его из профиля).
  const [protocolFromTemplate, setProtocolFromTemplate] = useState(false);
  // Контекст «Из МИС»: предыдущий протокол или выписка, которые врач вставил
  // перед приёмом. Только состояние приёма — не localStorage, не черновик, не
  // база: чужой протокол не должен пережить «Новый приём» (152-ФЗ). Уходит в
  // подсказки, analyze и сверку; сервер деидентифицирует его как стенограмму.
  const [priorContext, setPriorContext] = useState('');
  const [priorContextOpen, setPriorContextOpen] = useState(false);
  const [protocolWithPrior, setProtocolWithPrior] = useState(false);
  // ── Памятка пациенту ───────────────────────────────────────────────────
  // Собирается по кнопке из уже утверждённого ehrNote, а не автоматически из
  // стенограммы: врач сначала правит поля протокола, и памятка должна
  // отражать правки. memoSourceEhr — снимок протокола на момент сборки, по
  // нему определяем, что памятка протухла после дальнейших правок.
  const [patientSummary, setPatientSummary] = useState<PatientSummary | null>(null);
  const [memoSourceEhr, setMemoSourceEhr] = useState<string | null>(null);
  const [isBuildingMemo, setIsBuildingMemo] = useState(false);
  const [memoCopied, setMemoCopied] = useState(false);
  const [guideline, setGuideline] = useState<import('./types').GuidelineType>('international');

  const [viewMode, setViewMode] = useState<'consultation' | 'protocol'>('consultation');

  const [manualInput, setManualInput] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);
  // Автосохранение правок протокола в уже сохранённый черновик (см. effect ниже).
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [draftEditState, setDraftEditState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const draftEditSeqRef = useRef(0);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // ── User preferences (persisted in localStorage) ─────────────────────────
  // Распознавание речи — всегда T-one (self-host, RU, бесплатный).
  const [stenographerMode, setStenographerMode] = useState<boolean>(() => {
    return localStorage.getItem('medscribe_stenographer_mode') === 'true';
  });
  // Разбор общения после приёма: включается галочкой, результат ложится в
  // черновик и читается в истории, а не на рабочем поле.
  const [communicationReview, setCommunicationReview] = useState<boolean>(() => {
    return localStorage.getItem(COMMUNICATION_REVIEW_KEY) === 'true';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);

  // Consultation type — primary (first visit, full anamnesis required by МЗ standard)
  // vs follow-up (shorter, focus on dynamics). Drives the checklist panel.
  const [consultationType, setConsultationType] = useState<'primary' | 'follow-up'>(() => {
    const saved = localStorage.getItem('medscribe_consultation_type');
    return saved === 'follow-up' ? 'follow-up' : 'primary';
  });

  // Persist preferences
  useEffect(() => { localStorage.setItem('medscribe_stenographer_mode', String(stenographerMode)); }, [stenographerMode]);
  useEffect(() => { localStorage.setItem(COMMUNICATION_REVIEW_KEY, String(communicationReview)); }, [communicationReview]);
  useEffect(() => { localStorage.setItem('medscribe_consultation_type', consultationType); }, [consultationType]);

  // ── Настраиваемое рабочее поле приёма ────────────────────────────────────
  const [layoutBlocks, setLayoutBlocks] = useState<LayoutBlock[]>(DEFAULT_LAYOUT);
  const [workspaceEditMode, setWorkspaceEditMode] = useState(false);
  const [savingLayout, setSavingLayout] = useState(false);
  const [layoutSaveError, setLayoutSaveError] = useState<string | null>(null);
  const [showWidgetModal, setShowWidgetModal] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  // Бампается в startNewAppointment — форсирует remount CustomWidgetBlock,
  // чтобы отметки чек-боксов сбрасывались на новом приёме (сами отметки не
  // персистятся, в отличие от определения виджета).
  const [consultationSessionKey, setConsultationSessionKey] = useState(0);

  // Связка диагноз ↔ препараты/дозы/шаблоны (см. блоки icd10/pharmaRef/
  // dosageCalc/templates). Полностью локальное, эфемерное состояние — не
  // персистится, сбрасывается в startNewAppointment, как hints/pharmaHints.
  const [activeDiagnosis, setActiveDiagnosis] = useState<{ code: string; name: string; category?: string } | null>(null);
  // Шаблон назначений, выбранный врачом «для заполнения» в блоке «Шаблоны
  // назначений». Пока он выбран, протокол формируется по его каркасу: пункты
  // шаблона сохраняются, в них подставляются данные приёма (см.
  // /api/ai/analyze). Эфемерно, как activeDiagnosis — сбрасывается на новый приём.
  const [selectedTemplate, setSelectedTemplate] = useState<SelectedTemplate | null>(null);
  const [suggestedDiagnoses, setSuggestedDiagnoses] = useState<DiagnosisSuggestion[]>([]);
  const [isSuggestingDiagnosis, setIsSuggestingDiagnosis] = useState(false);

  // Клик по препарату в фарм-справочнике: показывает его описание тут же в
  // блоке и сразу подставляет этот препарат в калькулятор дозировок (если
  // для него есть пресет мг/кг — иначе калькулятор переходит в ручной ввод
  // с указанием названия). Тот же эфемерный паттерн, что activeDiagnosis.
  const [activeDrug, setActiveDrug] = useState<{ mnn: string; note?: string; group?: string } | null>(null);

  async function fetchWorkspaceLayout() {
    try {
      const token = getStoredSession()?.token;
      if (!token) return;
      const r = await fetch('/api/workspace-layout', { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return;
      const data = await r.json();
      if (Array.isArray(data.layout) && data.layout.length > 0) {
        setLayoutBlocks(mergeWithDefaults(migrateLayout(data.layout)));
      } else {
        setLayoutBlocks(DEFAULT_LAYOUT);
      }
    } catch { /* ignore — остаётся текущая (по умолчанию — DEFAULT_LAYOUT) */ }
  }
  useEffect(() => { fetchWorkspaceLayout(); }, []);

  // Ответ сервера ПРОВЕРЯЕТСЯ. Раньше результат игнорировался целиком, и
  // отказ выглядел неотличимо от успеха: сервер отвергал каждую раскладку с
  // 400 (в его списке типов блоков не было 'reference'), а врач видел
  // «Сохранение…», кнопку «Сохранить» и расставленные плитки — до
  // перезагрузки страницы, после которой всё возвращалось на место. Молча
  // проглоченная ошибка сохранения хуже отсутствия сохранения: врач считает,
  // что работа сделана.
  async function persistWorkspaceLayout(next: LayoutBlock[]) {
    setSavingLayout(true);
    try {
      const token = getStoredSession()?.token;
      if (!token) { setLayoutSaveError('Нет активной сессии — раскладка не сохранена.'); return; }
      const r = await fetch('/api/workspace-layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ layout: next }),
      });
      if (!r.ok) {
        const detail = await r.json().catch(() => null);
        setLayoutSaveError(detail?.error
          ? `Раскладка не сохранена: ${detail.error}.`
          : `Раскладка не сохранена (ошибка ${r.status}).`);
        return;
      }
      setLayoutSaveError(null);
    } catch {
      setLayoutSaveError('Раскладка не сохранена: сервер недоступен.');
    }
    finally { setSavingLayout(false); }
  }

  // Drag/resize сохраняются сразу по onDragStop/onResizeStop (не на каждый
  // пиксель). Видимость блоков и кастомные виджеты — только локально, до
  // явного нажатия «Сохранить» в WorkspaceToolbar. Раскладка больше НЕ
  // растягивается автоматически, чтобы убрать пустоты снизу — это мешало
  // врачу сознательно уменьшать блок (изменение тут же откатывалось назад
  // до полной высоты). Пустое место — нормальное состояние; при появлении
  // нового/включённого блока оно займётся через findFreePosition ниже.
  const handleGridLayoutChange = (next: LayoutBlock[]) => {
    setLayoutBlocks(next);
    persistWorkspaceLayout(next);
  };

  const handleToggleBlockVisibility = (id: string) => {
    // Апдейтер setState обязан быть чистым: React в StrictMode вызывает его
    // дважды, и window.alert внутри давал два модальных окна на одно действие.
    // Считаем всё заранее, побочные эффекты — после.
    const target = layoutBlocks.find(b => b.id === id);
    if (!target) return;
    if (!target.visible) {
      const others = layoutBlocks.filter(b => b.id !== id);
      if (!findFreePlacement(target.layout.w, target.layout.h, others)) {
        window.alert('Нет свободного места на экране. Скройте или уменьшите другой блок, чтобы освободить место.');
        return;
      }
    }
    setLayoutBlocks(prev => {
      const target = prev.find(b => b.id === id);
      if (!target) return prev;
      if (target.visible) {
        return prev.map(b => (b.id === id ? { ...b, visible: false } : b));
      }
      // Включаем блок, которого не было на поле — ставим его в первую
      // свободную клетку (приоритет — пустое место на экране, а не низ
      // сетки), а не на его старые координаты: иначе он часто оказывается
      // полностью под уже видимым блоком (см. DEFAULT_LAYOUT — справочные
      // блоки по умолчанию перекрывают основные 4 колонки).
      // ...и подгоняем под то, что реально осталось: если стандартный размер
      // блока в свободную область не влезает, findFreePlacement вернёт
      // уменьшенный. Отказ («нет места») остаётся только когда не помещается
      // даже минимальный блок.
      const others = prev.filter(b => b.id !== id);
      const spot = findFreePlacement(target.layout.w, target.layout.h, others);
      if (!spot) return prev;
      return prev.map(b => (b.id === id ? { ...b, visible: true, layout: { ...spot } } : b));
    });
  };

  // Возвращает встроенные блоки к DEFAULT_LAYOUT (позиция + видимость).
  // Кастомные виджеты врача (заметки/чек-листы) не удаляются — переставляются
  // в свободное место, а если места нет, остаются определёнными, но скрытыми.
  // Не сохраняется автоматически — как и остальные изменения в тулбаре.
  //
  // Раньше здесь было два дефекта, работавших в паре. Фильтр брал только
  // видимые виджеты, а результат собирался из DEFAULT_LAYOUT (где кастомных
  // нет) плюс отобранные — то есть скрытый виджет не прятался, а исчезал из
  // состояния. При этом видимые блоки DEFAULT_LAYOUT занимают все 12 колонок
  // на всю высоту, свободных клеток после сброса ровно ноль, и первый же
  // сброс делал все виджеты скрытыми. Второй сброс стирал их окончательно, а
  // любой последующий драг блока уносил удаление в базу.
  const handleWorkspaceToolbarReset = () => {
    const base = DEFAULT_LAYOUT.map(b => ({ ...b }));
    const placedCustom: LayoutBlock[] = [];
    let hidden = 0;
    // Берём ВСЕ кастомные виджеты, включая скрытые, и сохраняем их видимость.
    for (const w of layoutBlocks.filter(b => b.type === 'custom')) {
      const spot = w.visible ? findFreePlacement(w.layout.w, w.layout.h, [...base, ...placedCustom]) : null;
      if (!spot) {
        if (w.visible) hidden++;
        placedCustom.push({ ...w, visible: false });
        continue;
      }
      placedCustom.push({ ...w, layout: { ...spot } });
    }
    setLayoutBlocks([...base, ...placedCustom]);
    if (hidden > 0) {
      window.alert(`Стандартные блоки занимают экран целиком, поэтому ${hidden} виджет(ов) врача скрыто — они не удалены. Уменьшите любой из четырёх основных блоков и включите виджет чекбоксом.`);
    }
  };

  const handleSaveWidget = (config: CustomWidgetConfig) => {
    if (!editingWidgetId && !findFreePlacement(4, 4, layoutBlocks)) {
      window.alert('Нет свободного места на экране для нового виджета. Скройте или уменьшите другой блок и попробуйте снова.');
      return;
    }
    setLayoutBlocks(prev => {
      if (editingWidgetId) {
        return prev.map(b => (b.id === editingWidgetId ? { ...b, customConfig: config } : b));
      }
      const spot = findFreePlacement(4, 4, prev);
      if (!spot) return prev; // место заняли между проверкой выше и этим апдейтом — редкий случай, тихо отменяем
      const newBlock: LayoutBlock = {
        id: `custom_${Date.now()}`,
        type: 'custom',
        visible: true,
        layout: { ...spot },
        customConfig: config,
      };
      return [...prev, newBlock];
    });
    setShowWidgetModal(false);
    setEditingWidgetId(null);
  };

  const handleDeleteWidget = (id: string) => {
    setLayoutBlocks(prev => prev.filter(b => b.id !== id));
  };

  // Быстрое удаление прямо с полоски захвата блока (без поиска мусорной
  // корзины внутри самого блока). Кастомный виджет врача удаляется целиком
  // (как и по кнопке в его заголовке); встроенный блок нельзя удалить как
  // таковой — прячем его (как чекбоксом в тулбаре), это обратимо.
  const handleDeleteBlock = (id: string) => {
    const block = layoutBlocks.find(b => b.id === id);
    if (!block) return;
    if (block.type === 'custom') {
      handleDeleteWidget(id);
    } else {
      handleToggleBlockVisibility(id);
    }
  };

  const handleWorkspaceToolbarSave = () => {
    persistWorkspaceLayout(layoutBlocks);
    setWorkspaceEditMode(false);
  };

  const handleWorkspaceToolbarExit = () => {
    setWorkspaceEditMode(false);
    fetchWorkspaceLayout(); // отменяет несохранённые изменения видимости/виджетов
  };

  // Клик по коду МКБ-10 (из поиска или из подсказок по контексту) — общий
  // источник истины для activeDiagnosis. Повторный клик по уже активному
  // коду снимает выбор. Ничего не выбирается автоматически без этого клика.
  const handleSelectDiagnosisCode = (code: string) => {
    setActiveDiagnosis(prev => {
      if (prev?.code === code) return null;
      const entry = getIcd10Reference(doctor.specialty.id).find(c => c.code === code);
      if (!entry) return prev;
      return { code: entry.code, name: entry.name, category: entry.category };
    });
  };

  // Повторный клик по уже активному препарату снимает выбор — как с диагнозом.
  // group обязателен: без него клик по препарату терял класс, к которому тот
  // принадлежит, и справочник показывал «Описание не заполнено». Клиническая
  // справка (drugClassInfo.ts) живёт именно на уровне класса.
  // Идентичность выбора — пара «группа + МНН», а не одно МНН. Один и тот же
  // препарат встречается в двух группах одной специальности (топирамат у
  // невролога — и антиконвульсант, и профилактика мигрени), и сравнение по
  // МНН превращало клик по второй группе в снятие выбора: класс не менялся,
  // кнопка выглядела сломанной, а подсвечены оказывались обе.
  const handleSelectDrug = (mnn: string, note?: string, group?: string) => {
    setActiveDrug(prev => (prev?.mnn === mnn && prev?.group === group ? null : { mnn, note, group }));
  };

  // Страховка: кнопка «Настроить рабочее поле» видна только в состоянии
  // ожидания (см. canEditWorkspaceNow ниже), но если приём успел начаться,
  // пока доктор ещё в режиме редактирования (например нажал «Начать приём»
  // не выходя из настройки), сохраняем текущую раскладку и принудительно
  // закрываем тулбар — редактирование во время реального приёма отключено
  // (высокая частота багов при драге поверх активной консультации).
  useEffect(() => {
    if (workspaceEditMode && (isRecording || transcript.length > 0)) {
      persistWorkspaceLayout(layoutBlocks);
      setWorkspaceEditMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, transcript.length]);

  const renderWorkspaceBlockContent = (block: LayoutBlock): React.ReactNode => {
    switch (block.type) {
      case 'insights':
        return (
          <InsightsBlock
            hints={hints}
            isGeneratingHints={isGeneratingHints}
            hasTranscript={transcript.length > 0}
            onRefresh={requestHints}
          />
        );
      case 'pharma':
        return <PharmaBlock pharmaHints={pharmaHints} isGeneratingHints={isGeneratingHints} />;
      case 'transcript':
        return (
          <TranscriptBlock
            specialtyId={doctor.specialty.id}
            consultationType={consultationType}
            transcript={transcript}
            onOpenChecklistModal={() => setShowChecklistModal(true)}
            isRecording={isRecording}
            stenographerMode={stenographerMode}
            bufferedRef={bufferedRef}
            bufferedElapsedMs={bufferedElapsedMs}
            bufferedLevel={bufferedLevel}
            bufferedSegments={bufferedSegments}
            stopBufferedAndTranscribe={stopBufferedAndTranscribe}
            transcriptionProgress={transcriptionProgress}
            isDiarizing={isDiarizing}
                isRefiningTranscript={isRefiningTranscript}
            transcribingError={transcribingError}
            bufferedSessionId={bufferedSessionId}
            retryTranscription={retryTranscription}
            currentSpeech={currentSpeech}
            transcriptEndRef={transcriptEndRef}
            manualInput={manualInput}
            onManualInputChange={setManualInput}
            onManualSubmit={handleManualSubmit}
          />
        );
      case 'checklist':
        return <ChecklistBlock transcript={transcript} type={consultationType} specialtyId={doctor.specialty.id} />;
      case 'custom':
        return (
          <CustomWidgetBlock
            key={`${block.id}-${consultationSessionKey}`}
            title={block.customConfig?.title || 'Виджет врача'}
            kind={block.customConfig?.kind ?? 'checklist'}
            items={block.customConfig?.items || []}
            editMode={workspaceEditMode}
            onEdit={() => { setEditingWidgetId(block.id); setShowWidgetModal(true); }}
            onDelete={() => handleDeleteWidget(block.id)}
          />
        );
      case 'reference':
        return (
          <ReferenceBlock
            specialtyId={doctor.specialty.id}
            initialTab={block.referenceTab}
            activeDiagnosis={activeDiagnosis}
            onClearDiagnosis={() => setActiveDiagnosis(null)}
            activeDrug={activeDrug}
            onSelectDrug={handleSelectDrug}
            activeCode={activeDiagnosis?.code ?? null}
            suggestedCodes={suggestedDiagnoses.map(s => s.code)}
            isSuggesting={isSuggestingDiagnosis}
            onSelectCode={handleSelectDiagnosisCode}
            selectedTemplate={selectedTemplate}
            onSelectTemplate={setSelectedTemplate}
          />
        );
      default:
        return null;
    }
  };

  const sttRef = useRef<SecureMedicalSTT | null>(null);
  const isRecordingRef = useRef(false);
  const transcriptRef = useRef<TranscriptLine[]>([]);
  // Диаризация запускается из асинхронного колбэка записи и может видеть
  // состояние того рендера, в котором её создали, — читаем выбранный шаблон
  // через ref, как и стенограмму выше.
  const selectedTemplateRef = useRef<SelectedTemplate | null>(null);
  const priorContextRef = useRef('');
  // Контекст «Из МИС» уже ушёл в запись: следующий приём с пустого экрана его не наследует.
  const priorContextUsedRef = useRef(false);
  // Черновик текущего приёма — нужен, чтобы дописать в него памятку пациенту
  // уже после сохранения протокола (памятка собирается позже).
  const draftRef = useRef<{ id: string; content: any; transcript: string } | null>(null);
  const draftContentsRef = useRef(new Map<string, { content: any; transcript: string }>());
  const draftPatchQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // ── Stenographer buffered-record mode ────────────────────────────────────
  // When stenographerMode is on, recording uses BufferedRecorder (no live
  // transcription; full audio is sent to T-one for offline decoding on stop).
  const bufferedRef = useRef<BufferedRecorder | null>(null);
  const [bufferedElapsedMs, setBufferedElapsedMs] = useState(0);
  const [bufferedLevel, setBufferedLevel] = useState(0);
  const [bufferedSegments, setBufferedSegments] = useState(0);
  const [bufferedSessionId, setBufferedSessionId] = useState<string | null>(null);
  const [transcriptionProgress, setTranscriptionProgress] = useState<TranscriptionProgress | null>(null);
  const [transcribingError, setTranscribingError] = useState<string | null>(null);
  const [unfinishedSessions, setUnfinishedSessions] = useState<SessionMeta[]>([]);

  // ── Параллельная запись поверх живой расшифровки ─────────────────────────
  // Живой STT показывает текст сразу (стриминг), но стриминговая модель видит
  // только текущий кусок: теряет начало фразы и не может опереться на контекст
  // всего приёма. Поэтому параллельно пишем полное аудио и после приёма в
  // ФОНЕ прогоняем его целиком — врач продолжает работать с живой
  // стенограммой, а когда уточнённая готова, она её заменяет.
  //
  // Аудио живёт только в IndexedDB браузера врача и удаляется сразу после
  // уточнения (152-ФЗ: на сервер полная запись приёма не уезжает).
  const parallelRecRef = useRef<BufferedRecorder | null>(null);
  const [isRefiningTranscript, setIsRefiningTranscript] = useState(false);
  // Номер текущего приёма. Уточнение идёт в фоне и может завершиться уже
  // после того, как врач начал следующий приём — тогда его результат нужно
  // выбросить, иначе стенограмма предыдущего пациента всплывёт на чистом
  // экране нового.
  const appointmentGenRef = useRef(0);
  // Бампается при «Завершить и сформировать протокол»: уточнение стенограммы,
  // запущенное раньше, уже не должно её подменять (протокол собран по старой).
  const protocolGenRef = useRef(0);
  // Идущее сейчас уточнение по полной записи. «Завершить и сформировать
  // протокол» подхватывает его (finishRequested), а не запускает второе и не
  // выбрасывает: result приходит сразу после расшифровки, до разметки Врач/Пациент.
  const refineRef = useRef<{
    gen: number; // приём, которому принадлежит уточнение (чужое подхватывать нельзя)
    diarize?: Promise<DiarizeReuse | null>; // разметка Врач/Пациент после расшифровки (идёт или готова)
    sessionId: string;
    durationMs: number;
    controller: AbortController;
    finishRequested: boolean;
    // owned: аудио после расшифровки на совести «Завершить» (refine его не трогает)
    result: Promise<{ outcome: RefineOutcome<TranscriptLine>; owned: boolean }>;
  } | null>(null);
  // Сколько строк стенограммы было к старту текущей записи (>0 — «Продолжить запись»).
  const recordingPrefixRef = useRef(0);
  // Время последнего «Новый приём»: второй клик двойного клика не должен попасть в сдвинувшуюся «Начать приём».
  const newAppointmentAtRef = useRef(0);
  const guidelineRef = useRef<import('./types').GuidelineType>('international');
  const consultationTypeRef = useRef<'primary' | 'follow-up'>('primary');
  // Длительность последней снятой параллельной записи — для потолка ожидания.
  const lastParallelDurationRef = useRef(0);
  // Последняя снятая параллельная запись сохранена не целиком (квота, лимит при живом тексте).
  const lastParallelIncompleteRef = useRef(false);
  // «Завершить» уже работает (id) — защита от двойного клика; 0 — свободно.
  const finishActiveRef = useRef(0);
  const finishSeqRef = useRef(0);
  const [finishStage, setFinishStage] = useState<'transcribing' | 'protocol' | null>(null);
  // Живой поток распознавания оборвался посреди приёма: живой текст неполный,
  // и параллельная запись — единственная полная копия. Сбрасывается на старте
  // новой записи.
  const streamLostRef = useRef(false);
  // Ожидающая отправки правка протокола (автосохранение с задержкой): её нужно
  // отправить сразу при уходе с экрана, иначе правка за последние 1,5 с теряется.
  const pendingPatchRef = useRef<{ draftId: string; fields: Record<string, string> } | null>(null);
  // Экран ещё открыт: фоновое уточнение стенограммы не должно считать себя
  // применённым, если врач уже ушёл (setState в размонтированный компонент).
  const mountedRef = useRef(true);
  // Идущая расшифровка записи из браузерного буфера (стенограф / «Расшифровать»).
  const transcribeRunRef = useRef<AbortController | null>(null);
  // Приём, к которому относится останавливаемая запись стенографа, если «Новый приём» уже поднял appointmentGenRef.
  const stopBufferedGenRef = useRef<number | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      transcribeRunRef.current?.abort();   // запись останется в «Незавершённых»
    };
  }, []);

  // Какой движок выбран для записи: от него зависит таймаут «Завершить». Ошибку игнорируем (остаётся T-one); берём selected, а не effective — запас по времени не повредит.
  const sttEngineRef = useRef<SttEngine>('tone');
  const refreshSttEngine = () => {
    void getSttEngineStatus().then((r) => { if (r.ok && mountedRef.current) sttEngineRef.current = r.value.selected; }).catch(() => {});
  };
  useEffect(() => { refreshSttEngine(); }, []);

  // Check for recoverable sessions on mount + cleanup old ones
  useEffect(() => {
    purgeOld().catch(() => {});
    listUnfinishedSessions(doctorKey).then(setUnfinishedSessions).catch(() => {});
  }, [doctorKey]);

  // Warn before leaving the page if a buffered recording is in progress or
  // a transcription is being uploaded. The audio survives in IndexedDB but
  // the user is most likely closing by mistake.
  useEffect(() => {
    if (!isRecording && !transcriptionProgress && !finishStage) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isRecording, transcriptionProgress, finishStage]);

  const CONFIRM_LEAVE_RECORDING =
    'Идёт запись приёма. Остановить запись и перейти?\n\nЗвук сохранится в браузере, его можно будет расшифровать на стартовом экране.';

  const handleLogout = () => {
    if (isRecording && !window.confirm(CONFIRM_LEAVE_RECORDING)) return;
    logoutSession().finally(() => {
      navigate('/');
    });
  };

  const goToProfile = () => {
    if (isRecording && !window.confirm(CONFIRM_LEAVE_RECORDING)) return;
    navigate('/profile');
  };

  // Уход с экрана посреди записи (Профиль, Выйти, любая навигация): без этого
  // микрофон, показ вкладки, WebSocket и таймер записи остались бы живыми.
  // Параллельную запись именно останавливаем, а не стираем — она появится в
  // «Незавершённых» на стартовом экране.
  useEffect(() => {
    return () => {
      flushPendingPatch();
      // «Завершить» ждёт расшифровку: не ждём её после ухода, протокол соберётся по живой стенограмме, запись останется.
      if (refineRef.current?.finishRequested) refineRef.current.controller.abort();
      void stopParallelRecording(); // до disconnect: дописать хвост записи
      // Режим стенографа: stop() останавливает таймер и микрофон, сессия
      // остаётся в IndexedDB и попадёт в «Незавершённые».
      const buffered = bufferedRef.current;
      if (buffered) {
        bufferedRef.current = null;
        buffered.stop().catch(() => {});
      }
      sttRef.current?.disconnect();
      sttRef.current = null;
      isRecordingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // ensureValidSession: если access JWT свеж — отдаёт его, если протух но
      // есть живой refresh — молча обновляет пару через /api/auth/refresh и
      // возвращает обновлённую сессию. null означает что логин действительно нужен.
      const session = await ensureValidSession();
      if (cancelled) return;
      if (!session) {
        navigate('/');
        return;
      }
      setDoctorKey({ id: session.doctor.id, name: session.doctor.name });
      setDoctor({
        name: session.doctor.name,
        specialty: MEDICAL_SPECIALTIES[session.doctor.specialtyId] || MEDICAL_SPECIALTIES.therapist,
        experienceYears: session.doctor.experienceYears,
      });
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    selectedTemplateRef.current = selectedTemplate;
  }, [selectedTemplate]);

  useEffect(() => { guidelineRef.current = guideline; }, [guideline]);
  useEffect(() => { consultationTypeRef.current = consultationType; }, [consultationType]);

  useEffect(() => {
    priorContextRef.current = priorContext.trim();
  }, [priorContext]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, currentSpeech]);

  const handleStopAll = async () => {
    if (isRecordingRef.current) {
      toggleRecording();
    }
  };

  const startNewAppointment = () => {
    const hasActiveSession = isRecording || transcript.length > 0 || viewMode === 'protocol';
    if (hasActiveSession) {
      const confirmed = window.confirm(
        'Начать новый приём?\n\nТекущий приём будет завершён. Убедитесь, что протокол сохранён.'
      );
      if (!confirmed) return;
    }
    // Новый приём: всё, что относится к предыдущему, обесценивается — в том
    // числе идущее в фоне уточнение (его результат отбросится по gen) и ещё
    // не расшифрованная запись (её просто стираем, не тратя проход модели).
    if (bufferedRef.current) stopBufferedGenRef.current = appointmentGenRef.current;
    appointmentGenRef.current++;
    // «Завершить» ещё расшифровывает запись предыдущего приёма: останавливаем и
    // освобождаем кнопку (его результат отбросится по appointmentGenRef).
    if (refineRef.current?.finishRequested) refineRef.current.controller.abort();
    refineRef.current = null; // уточнение прошлого приёма отвязываем: «Завершить» нового его не подхватит
    newAppointmentAtRef.current = Date.now();
    finishActiveRef.current = 0;
    setFinishStage(null);
    setIsGeneratingEHR(false);
    flushPendingPatch();
    if (streamLostRef.current && parallelRecRef.current) {
      // Живой текст оборвался: запись — единственная полная копия, не стираем.
      void keepParallelRecording();
    } else {
      void discardParallelRecording();
    }
    if (isRecordingRef.current) {
      sttRef.current?.disconnect();
      setIsRecording(false);
      setCurrentSpeech("");
    }
    handleStopAll();
    // Идущая расшифровка прошлого приёма: отменяем, иначе зависший запрос блокирует старт.
    // Запись остаётся в «Незавершённых», а устаревший run сам ничего не тронет (см. runBufferedTranscription).
    transcribeRunRef.current?.abort();
    setTranscriptionProgress(null);
    setTranscribingError(null);
    setTranscript([]);
    voiceLabelledRef.current = false;
    setHints([]);
    setPharmaHints([]);
    setEhrNote(null);
    setViewMode('consultation');
    setConsultationSessionKey(k => k + 1); // сбрасывает отметки в кастомных виджетах
    setActiveDiagnosis(null);
    setSuggestedDiagnoses([]);
    setActiveDrug(null);
    // selectedTemplate здесь НЕ сбрасываем: шаблон — единственное состояние
    // приёма, которое врач выбирает до нажатия «Запись», а не получает по ходу.
    // Сброс стирал выбор ровно в тот момент, когда врач его только что сделал,
    // и протокол собирался без шаблона (а повторный выбор стоил второго
    // платного прохода analyze). Между пациентами шаблон чистит «Новый приём».
    setCachedEhrFromDiarize(null);
    // Протокол предыдущего пациента: без сброса «Собрать памятку» строила
    // памятку по чужим диагнозам, если врач начал запись, минуя «Новый приём».
    setEhrNote(null);
    setPatientSummary(null);
    setMemoSourceEhr(null);
    setNoteCheck(null);
    setNoteCheckSourceEhr(null);
    setNoteCheckError(null);
    setProtocolFromTemplate(false);
    setPriorContext('');
    setPriorContextOpen(false);
    priorContextUsedRef.current = false;
    setProtocolWithPrior(false);
    draftRef.current = null;
    setCurrentDraftId(null);
    setDraftEditState('idle');
    draftEditSeqRef.current++; // результат уже идущего автосохранения устарел
    // Режим звонка не должен «прилипать»: кнопка «Начать приём» в шапке
    // иначе снова открыла бы выбор вкладки.
    setRecordingMode('microphone');
  };

  // ── Buffered (stenographer) recording handlers ───────────────────────────
  /** Общий сброс состояния прошлого приёма: новая запись и «Расшифровать» из «Незавершённых» начинают чистый приём. */
  const resetAppointmentState = () => {
    // Уточнение предыдущего приёма, если ещё идёт, не должно подменить
    // стенограмму нового (см. appointmentGenRef).
    appointmentGenRef.current++;
    if (refineRef.current?.finishRequested) refineRef.current.controller.abort();
    refineRef.current = null;
    finishActiveRef.current = 0;
    setFinishStage(null);
    setIsGeneratingEHR(false);
    void discardParallelRecording();
    setTranscribingError(null);
    setTranscript([]);
    voiceLabelledRef.current = false;
    setHints([]);
    setPharmaHints([]);
    setActiveDiagnosis(null);
    setSuggestedDiagnoses([]);
    setActiveDrug(null);
    setSelectedTemplate(null);
    setCachedEhrFromDiarize(null);
    setPatientSummary(null);
    setMemoSourceEhr(null);
    draftRef.current = null;
    setCurrentDraftId(null);
    setDraftEditState('idle');
    draftEditSeqRef.current++; // результат уже идущего автосохранения устарел
  };

  /** Контекст «Из МИС» относится к приёму, который не встал на экран: пациенту Б он достаться не должен. */
  const clearPriorContext = () => {
    setPriorContext('');
    setPriorContextOpen(false);
    priorContextRef.current = '';
    priorContextUsedRef.current = false;
  };

  /**
   * Запись началась: контекст «Из МИС» считается использованным. Если он уже уходил в прошлую
   * запись, а теперь старт с пустого экрана — это приём другого пациента, контекст сбрасываем.
   * Продолжение записи в том же приёме (screenEmpty = false) контекст не трогает.
   */
  const markPriorContextUsedOnStart = (screenEmpty: boolean) => {
    if (shouldClearPriorContextOnStart({ screenEmpty, used: priorContextUsedRef.current })) {
      // Врач должен узнать, что поле опустело не само: смотрим на текст до сброса.
      const hadContext = priorContextRef.current !== '';
      clearPriorContext();
      if (hadContext) {
        setAiError('Контекст «Из МИС» прошлого приёма сброшен. Если это тот же пациент, вставьте его заново.');
        setTimeout(() => setAiError(null), 8000);
      }
    }
    priorContextUsedRef.current = true;
  };

  const startBufferedRecording = async () => {
    if (bufferedRef.current) return; // already recording
    stopBufferedGenRef.current = null;   // устаревший gen прошлой остановки не должен достаться этой записи
    // Запись кнопкой в шапке минует «Новый приём»: если на экране уже чей-то приём, контекст «Из МИС» его пациента во второй протокол не идёт.
    // С пустого стартового экрана контекст остаётся: врач вставляет его до записи.
    const hadAppointment = transcriptRef.current.length > 0 || viewMode === 'protocol';
    // Тоже новый приём.
    resetAppointmentState();
    if (hadAppointment) priorContextUsedRef.current = true; // контекст на экране относился к прошлому приёму
    markPriorContextUsedOnStart(true);
    setBufferedElapsedMs(0);
    setBufferedLevel(0);
    setBufferedSegments(0);

    const rec = new BufferedRecorder({
      onTick: (ms) => setBufferedElapsedMs(ms),
      onLevel: (level) => setBufferedLevel(level),
      onSegmentSaved: (idx) => setBufferedSegments(idx + 1),
      onMaxReached: () => setAiError('Достигнут лимит 60 минут — запись остановлена автоматически'),
      onError: (err) => setAiError(`Ошибка записи: ${err.message || err.name || 'нет места или доступа'}`),
    });

    bufferedRef.current = rec;
    setBufferedSessionId(rec.sessionId);
    setIsRecording(true);
    isRecordingRef.current = true;
    refreshSttEngine();

    try {
      await rec.start(consultationType, doctorKeyRef.current?.id ?? getStoredSession()?.doctor?.id);
    } catch (err: any) {
      setAiError(mediaErrorMessage(err, 'microphone'));
      priorContextUsedRef.current = false; // запись не началась: контекст ещё ничей
      bufferedRef.current = null;
      setBufferedSessionId(null);
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  };

  /** Освежить плашку «Незавершённые»: запись могла остаться или исчезнуть. */
  const refreshUnfinished = async (): Promise<SessionMeta[] | null> => {
    await purgeOld().catch(() => {});   // старше 7 дней; смотрит только на возраст, идущую запись не заденет
    const list = await listUnfinishedSessions(doctorKeyRef.current).catch(() => null);
    if (list && mountedRef.current) setUnfinishedSessions(list);
    return list;
  };

  /**
   * Расшифровать запись из браузерного буфера и поставить текст на экран.
   * Аудио удаляется только когда непустой текст реально встал на экран в этом же приёме:
   * при ошибке, отмене, уходе с экрана и смене приёма запись остаётся в «Незавершённых».
   */
  const runBufferedTranscription = async (sessionId: string, opts: { diarize: boolean; gen?: number; controller?: AbortController; incomplete?: boolean }) => {
    const gen = opts.gen ?? appointmentGenRef.current;
    // Контроллер мог быть заведён раньше (стенограф: до остановки записи), чтобы «Отменить» и уход
    // со страницы успели его отменить, пока дописывается хвост записи.
    const controller = opts.controller ?? new AbortController();
    if (!opts.controller) transcribeRunRef.current = controller;
    const releaseRun = () => { if (transcribeRunRef.current === controller) transcribeRunRef.current = null; };
    if (controller.signal.aborted || !mountedRef.current || appointmentGenRef.current !== gen) {
      // Отмена, уход или смена приёма, пока останавливалась запись: на сервер ничего не уходит, запись остаётся в плашке.
      // Прогресс снимаем, только если новый run его не занял.
      const mine = transcribeRunRef.current === controller;
      // Приём не встал на экран: контекст стираем, только если приём ещё тот же (новый не трогаем).
      if (mine && mountedRef.current && appointmentGenRef.current === gen) clearPriorContext();
      releaseRun();
      if (mountedRef.current) {
        if (mine) setTranscriptionProgress(null);
        await refreshUnfinished();
      }
      return;
    }
    // Отменённый run (после «Отменить») не должен возвращать прогресс на экран.
    const isCurrentRun = () => transcribeRunRef.current === controller && !controller.signal.aborted;
    const sameVisit = () => mountedRef.current && appointmentGenRef.current === gen;
    setBufferedSessionId(sessionId);
    setTranscribingError(null);
    setTranscriptionProgress({ segmentIdx: 0, totalSegments: 1, status: 'uploading' });
    try {
      const result = await transcribeSession(
        sessionId,
        (p) => { if (isCurrentRun()) setTranscriptionProgress(p); },
        controller.signal,
      );
      const lines = sttResultToLines(result);
      if (lines.length === 0) throw new Error(EMPTY_STT_REASON);
      if (!sameVisit()) {
        if (mountedRef.current) await refreshUnfinished();
        return;
      }
      setTranscript(lines);
      voiceLabelledRef.current = result.diarized;
      setTranscriptionProgress(null);
      // Звук сохранился не целиком (нет места): текст есть только по сохранённому — скажем врачу.
      if (opts.incomplete) {
        setAiError(INCOMPLETE_AUDIO_NOTICE);
        setTimeout(() => setAiError(null), 15000);
      }
      // AI-диаризация: делит текст на реплики Врач / Пациент и кэширует черновик протокола.
      if (opts.diarize) {
        await autoDiarizeAndCache(result.diarized ? toAnalyzeText(lines) : result.text);
        if (!sameVisit()) {
          if (mountedRef.current) await refreshUnfinished();
          return;
        }
      }
      deleteSession(sessionId).catch(() => {});
      setBufferedSessionId(null);
      setUnfinishedSessions(prev => prev.filter(s => s.sessionId !== sessionId));
    } catch (err: any) {
      console.error('[Stenographer]', err?.message);
      // Ни отмена, ни ошибка не дали текста на экране: контекст пациента не оставляем следующему приёму.
      // Только если run ещё текущий и приём тот же: устаревший run контекст нового приёма не стирает.
      if (transcribeRunRef.current === controller && sameVisit()) clearPriorContext();
      if (controller.signal.aborted) {
        // Прогресс снимаем, если run ещё текущий (отмена из другого места его уже сняла).
        if (mountedRef.current) {
          if (transcribeRunRef.current === controller) setTranscriptionProgress(null);
          await refreshUnfinished();
        }
        return;
      }
      if (sameVisit()) {
        setTranscriptionProgress(null);
        const list = await refreshUnfinished();
        const kept = !!list?.some(s => s.sessionId === sessionId);
        if (sameVisit()) setTranscribingError(transcribeFailureMessage(err?.message || '', kept));
      } else if (mountedRef.current) {
        await refreshUnfinished();
      }
    } finally {
      releaseRun();
    }
  };

  /** Отмена идущей расшифровки: запись остаётся в «Незавершённых». */
  const cancelTranscription = () => {
    // Приём не встал на экран, врач вернётся на стартовый экран: контекст «Из МИС» не должен достаться следующему пациенту.
    if (transcribeRunRef.current) clearPriorContext();
    transcribeRunRef.current?.abort();
    setTranscriptionProgress(null);
    void refreshUnfinished();
  };

  /** Stop the buffered recording and transcribe the whole session via T-one. */
  const stopBufferedAndTranscribe = async () => {
    const rec = bufferedRef.current;
    // Gen расходуем сразу: устаревший не должен достаться следующей остановке.
    const savedGen = stopBufferedGenRef.current;
    stopBufferedGenRef.current = null;
    if (!rec) return;
    const gen = savedGen ?? appointmentGenRef.current;

    setIsRecording(false);
    isRecordingRef.current = false;
    // Карточка «Расшифровываем…» видна сразу, пока дописывается хвост записи.
    setTranscribingError(null);
    setTranscriptionProgress({ segmentIdx: 0, totalSegments: 1, status: 'uploading' });
    // Контроллер заводим до rec.stop: «Отменить» и уход со страницы в этот момент должны остановить расшифровку до старта.
    const controller = new AbortController();
    transcribeRunRef.current = controller;

    let incomplete = false;
    try {
      incomplete = (await rec.stop()).incomplete;
    } catch (err: any) {
      console.error('[Stenographer]', err?.message);
      bufferedRef.current = null;
      const mine = transcribeRunRef.current === controller;
      if (mine) transcribeRunRef.current = null;
      // Запись не завершилась, текста на экране нет: контекст стираем, только если приём ещё тот же.
      if (mine && mountedRef.current && appointmentGenRef.current === gen) clearPriorContext();
      if (controller.signal.aborted) {
        if (mountedRef.current) {
          if (mine) setTranscriptionProgress(null);
          await refreshUnfinished();
        }
        return;
      }
      if (appointmentGenRef.current === gen && mountedRef.current) {
        setTranscriptionProgress(null);
        const list = await refreshUnfinished();
        const kept = !!list?.some(s => s.sessionId === rec.sessionId);
        if (appointmentGenRef.current === gen && mountedRef.current) {
          setTranscribingError(transcribeFailureMessage(`ошибка завершения записи: ${err?.message || ''}`, kept));
        }
      } else if (mountedRef.current) {
        await refreshUnfinished();
      }
      return;
    }

    bufferedRef.current = null;

    // The session lives in IndexedDB so we can retry or resume after a tab crash.
    await runBufferedTranscription(rec.sessionId, { diarize: true, gen, controller, incomplete });
  };

  /**
   * Run /api/ai/analyze on a raw text transcript, then:
   *   1. Replace `transcript` with the diarized version (Врач / Пациент labels)
   *   2. Cache the EHR so a later "Сохранить протокол" doesn't pay for analyze twice
   * Non-fatal: if it fails, the raw 'unknown' transcript stays visible and
   * the doctor can still hit "Сохранить" — completeConsultation will retry.
   */
  const autoDiarizeAndCache = async (rawText: string, protoGen?: number): Promise<DiarizeReuse | null> => {
    if (!rawText.trim()) return null;
    // Приём, к которому относится этот разбор. analyze идёт 5-15 секунд, за это
    // время врач успевает начать следующего пациента — и тогда результат уже
    // ничей. Без этой проверки стенограмма и EHR предыдущего пациента молча
    // попадали в приём следующего и уезжали в черновик (152-ФЗ).
    const gen = appointmentGenRef.current;
    setIsDiarizing(true);
    try {
      // Параметры снимаем до запроса: результат помечается тем, по чему он посчитан.
      const template = selectedTemplateRef.current;
      const usedPrior = priorContextRef.current;
      const usedGuideline = guidelineRef.current;
      const usedType = consultationTypeRef.current;
      const r = await analyzeConsultation(
        rawText,
        doctor.specialty.name,
        "Данные пациента хранятся в МИС, извлекайте из речи",
        usedGuideline,
        usedType,
        template,
        recordingMode === 'system',
        usedPrior,
        voiceLabelledRef.current,
      );
      if (appointmentGenRef.current !== gen) return null;   // начался другой приём
      const reuse: DiarizeReuse | null = r.data ? {
        data: r.data, templateTitle: template?.title ?? null,
        guideline: usedGuideline, consultationType: usedType, priorContext: usedPrior,
      } : null;
      // «Завершить» уже собрало протокол по уточнённой стенограмме — не подменяем,
      // но результат отдаём: оно само решит, годится ли он (тот же шаблон) вместо второго analyze.
      if (protoGen !== undefined && protocolGenRef.current !== protoGen) return reuse;
      if (r.data?.diarizedTranscript && r.data.diarizedTranscript.length > 0) {
        voiceLabelledRef.current = r.data.diarizationSource === 'voice';
        setTranscript(r.data.diarizedTranscript.map((line, idx) => ({
          id: `diarized_${Date.now()}_${idx}`,
          speaker: normalizeLineSpeaker(line.speaker),
          text: line.text,
          timestamp: new Date(),
        })));
      }
      if (r.data?.ehr) {
        setCachedEhrFromDiarize({ ehr: r.data.ehr, templateTitle: template?.title ?? null });
      }
      return reuse;
    } catch (err: any) {
      // Surface as a soft warning — transcript is still saved-able
      setAiError(`Диаризация не удалась: ${err.message}. Спикеры останутся неразмеченными.`);
      setTimeout(() => setAiError(null), 8000);
      return null;
    } finally {
      setIsDiarizing(false);
    }
  };

  /** Retry transcription on a previously failed session. */
  const retryTranscription = async () => {
    if (!bufferedSessionId || transcriptionProgress) return;
    await runBufferedTranscription(bufferedSessionId, { diarize: false });
  };

  /** Resume an unfinished session found in IndexedDB on load. */
  const resumeUnfinishedSession = async (sessionId: string) => {
    if (startBlocked) return;
    // Новый приём, как при старте записи: иначе текст лёг бы в приём прошлого пациента.
    // Строку из unfinishedSessions не удаляем: пока идёт расшифровка она спрятана, при сбое остаётся.
    resetAppointmentState();
    // Контекст «Из МИС» относится к прошлому пациенту: врач вставляет его до записи, а здесь записи ещё нет.
    const hadContext = priorContextRef.current !== '';
    clearPriorContext();
    if (hadContext) {
      setAiError('Контекст «Из МИС» сброшен: он относился к другому приёму.');
      setTimeout(() => setAiError(null), 8000);
    }
    await runBufferedTranscription(sessionId, { diarize: false });
  };

  const dismissUnfinishedSession = async (sessionId: string) => {
    await deleteSession(sessionId);
    setUnfinishedSessions(prev => prev.filter(s => s.sessionId !== sessionId));
  };

  // ── Параллельная запись + фоновое уточнение стенограммы ──────────────────

  /**
   * Пишем полное аудио приёма поверх живой расшифровки, переиспользуя её же
   * микрофонный поток. Если запись не завелась, живая расшифровка продолжает
   * работать как раньше: врач получает уведомление и останется без уточнения в конце.
   */
  const startParallelRecording = async (stt: SecureMedicalSTT) => {
    const stream = stt.getMediaStream();
    if (!stream) return;
    if (parallelRecRef.current) return;

    const rec = new BufferedRecorder({
      onError: (err) => {
        console.warn('[ParallelRec] segment save failed:', err.message);
        setAiError('Не удаётся сохранить звук приёма в браузере: ' + (err.message || err.name || 'нет места или доступа') + '. Запись продолжается.');
        setTimeout(() => setAiError(null), 15000);
      },
    }, { stream });
    parallelRecRef.current = rec;
    try {
      await rec.start(consultationType, doctorKeyRef.current?.id ?? getStoredSession()?.doctor?.id);
    } catch (err: any) {
      console.warn('[ParallelRec] start failed:', err?.message);
      // start() сам отпустил блокировку и стёр заготовку сессии (0 сегментов); поток живой расшифровки не тронут.
      if (parallelRecRef.current === rec) {
        parallelRecRef.current = null;
        setAiError(`Полная запись приёма не запустилась: ${err?.message || err?.name || 'нет доступа к записи'}. Идёт только живая расшифровка.`);
        setTimeout(() => setAiError(null), 15000);
      }
      return;
    }
    // Пока start() ждал IndexedDB, запись могли уже снять (стоп, «Завершить»,
    // новый приём) — тогда её stop() отработал вхолостую, и таймер, созданный
    // start() позже, тикал бы вечно. Останавливаем и стираем.
    if (parallelRecRef.current !== rec) {
      try { await rec.stop(); } catch { /* поток уже закрыт */ }
      deleteSession(rec.sessionId).catch(() => {});
    }
  };

  /** Показать врачу, что запись осталась в браузере, и обновить плашку «Незавершённые». */
  const notifySessionKept = (message: string) => {
    purgeOld().catch(() => {}).then(() => listUnfinishedSessions(doctorKeyRef.current)).then(setUnfinishedSessions).catch(() => {});
    setAiError(message);
    setTimeout(() => setAiError(null), 15000);
  };

  /** Остановить параллельную запись с сохранением сессии (для «Расшифровать»). */
  const keepParallelRecording = async () => {
    const sessionId = await stopParallelRecording();
    if (sessionId) {
      notifySessionKept('Живая расшифровка прерывалась, поэтому звук приёма сохранён в браузере: кнопка «Расшифровать» на стартовом экране (хранится до 7 дней).');
    }
  };

  /** Отправить ожидающую правку протокола сразу, не дожидаясь таймера. */
  const flushPendingPatch = () => {
    const pending = pendingPatchRef.current;
    if (!pending) return;
    pendingPatchRef.current = null;
    patchDraft(pending.draftId, pending.fields).catch(() => {});
  };

  /** Бросить параллельную запись, не расшифровывая (начат новый приём). */
  const discardParallelRecording = async () => {
    const rec = parallelRecRef.current;
    if (!rec) return;
    parallelRecRef.current = null;
    try { await rec.stop(); } catch { /* поток мог уже умереть — не важно */ }
    deleteSession(rec.sessionId).catch(() => {});
  };

  /**
   * Снять параллельную запись и дождаться, пока последний сегмент ляжет в
   * IndexedDB. Вызывать ДО разрыва микрофонного потока: MediaRecorder
   * дописывает хвост уже после stop(), и оборванный из-под него поток стоил
   * бы последних секунд приёма.
   */
  const stopParallelRecording = async (): Promise<string | null> => {
    const rec = parallelRecRef.current;
    if (!rec) return null;
    parallelRecRef.current = null;
    try {
      const meta = await rec.stop();
      lastParallelDurationRef.current = meta?.durationMs ?? 0;
      lastParallelIncompleteRef.current = !!meta?.incomplete;
      return rec.sessionId;
    } catch (err: any) {
      lastParallelIncompleteRef.current = false;
      console.warn('[ParallelRec] stop failed:', err?.message);
      deleteSession(rec.sessionId).catch(() => {});
      return null;
    }
  };

  /**
   * Фоновое уточнение: гоним полную запись приёма через модель целиком.
   * Живая стенограмма остаётся на экране всё это время и подменяется только
   * когда уточнённая версия реально готова — если проход упадёт, врач ничего
   * не теряет и даже не обязан это заметить.
   */
  const refineTranscriptFromRecording = async (sessionId: string, opts: { finish?: boolean } = {}) => {
    // «Продолжить запись»: запись покрывает только последний отрезок, а голоса в
    // каждой записи нумеруются заново — подменять ею всю стенограмму нельзя
    // (первая часть пропала бы). Остаёмся на живой стенограмме, как при «Завершить».
    // Так же при неполном звуке (кончилось место, лимит при идущем живом тексте): расшифровка обрезка
    // заменила бы им полный живой текст. Живой текст полный — запись стираем, иначе оставляем врачу.
    const incompleteAudio = lastParallelIncompleteRef.current;
    if (!canRefineOnFinish(recordingPrefixRef.current, incompleteAudio)) {
      if (transcriptRef.current.length > 0 && !streamLostRef.current) deleteSession(sessionId).catch(() => {});
      else notifySessionKept(incompleteAudio
        ? 'Запись приёма сохранена в браузере не целиком: часть звука не удалось записать. Кнопка «Расшифровать» на стартовом экране (хранится до 7 дней).'
        : 'Запись приёма сохранена в браузере: кнопка «Расшифровать» на стартовом экране (хранится до 7 дней).');
      return;
    }
    const gen = appointmentGenRef.current;
    const protoGen = protocolGenRef.current;
    let resolveResult!: (r: { outcome: RefineOutcome<TranscriptLine>; owned: boolean }) => void;
    const handle: NonNullable<typeof refineRef.current> = {
      gen,
      sessionId,
      durationMs: lastParallelDurationRef.current,
      controller: new AbortController(),
      finishRequested: !!opts.finish,
      result: new Promise<{ outcome: RefineOutcome<TranscriptLine>; owned: boolean }>(r => { resolveResult = r; }),
    };
    refineRef.current = handle;
    let handedOff = false;
    // Читаем ДО первого await: живая стенограмма к этому моменту ещё на экране.
    // Живой текст полон, только если поток не обрывался: иначе это лишь начало
    // приёма, и стирать по нему полную запись нельзя.
    const liveComplete = transcriptRef.current.length > 0 && !streamLostRef.current;
    let applied = false;
    let emptyResult = false;
    let sessionFailed = false;
    setIsRefiningTranscript(true);
    try {
      const result = await transcribeSession(sessionId, undefined, handle.controller.signal);
      const refined = (result.text || '').trim();
      const lines: TranscriptLine[] = refined
        ? (result.segments.length > 0
          ? result.segments.map((s, idx) => ({
              id: `refined_${idx}`,
              speaker: s.speaker ?? 'unknown',
              text: s.text,
              timestamp: new Date(),
            }))
          : [{ id: 'refined_0', speaker: 'unknown' as const, text: refined, timestamp: new Date() }])
        : [];
      // «Завершить» ждёт этот результат: отдаём сразу, не дожидаясь разметки Врач/Пациент.
      // Уже успели ли мы подхватить его до расшифровки — решает finishRequested.
      handedOff = handle.finishRequested;
      resolveResult({
        outcome: refined ? { kind: 'ok', lines, voiceLabelled: result.diarized } : { kind: 'empty' },
        owned: handedOff,
      });
      // «Завершить» взяло результат и стенограмму подменит само; аудио тоже на нём.
      if (handedOff) return;
      // Врач уже начал следующий приём — уточнение опоздало, его результат
      // относится к предыдущему пациенту и на экран попасть не должен.
      if (appointmentGenRef.current !== gen) return;
      // Протокол уже формируется/собран по живой стенограмме — не подменяем её
      // (иначе она разойдётся с протоколом и черновиком). Сессию всё равно
      // удалит finally.
      if (protocolGenRef.current !== protoGen) return;
      // Пустой результат — это не «уточнение», а потеря стенограммы. Молча
      // оставляем живую версию.
      if (refined) {
        setTranscript(lines);
        voiceLabelledRef.current = result.diarized;
        // Врач ушёл с экрана — текст никуда не попал, полную копию оставляем.
        applied = mountedRef.current;
        // Диаризация: живая версия уже была размечена по ходу приёма, а
        // уточнённая приходит сплошным текстом — прогоняем её через тот же
        // разбор на Врач/Пациент, что и режим стенографа.
        handle.diarize = autoDiarizeAndCache(result.diarized ? toAnalyzeText(lines) : refined, protoGen);
        await handle.diarize;
      } else {
        emptyResult = true;
      }
    } catch (err: any) {
      handedOff = handle.finishRequested;
      resolveResult({ outcome: { kind: 'failed' }, owned: handedOff });
      // Фоновая операция: живая стенограмма на экране осталась, приём не
      // пострадал — в лог, но не в лицо врачу.
      console.warn('[ParallelRec] refine failed:', err?.message);
      sessionFailed = true;
    } finally {
      resolveResult({ outcome: { kind: 'failed' }, owned: false }); // на случай раннего return (no-op, если уже отдано)
      if (refineRef.current === handle) refineRef.current = null;
      setIsRefiningTranscript(false);
      // «Завершить» распорядится аудио само.
      if (handedOff) return;
      // 152-ФЗ: полная запись не живёт дольше нужного. Стираем, только если
      // уточнённый текст реально встал на экран либо живой текст полный. Иначе
      // (расшифровка упала, результат отброшен новым приёмом/протоколом, а
      // живой текст неполный или пустой) это единственная полная копия приёма:
      // оставляем в браузере (purgeOld снимет через 7 дней) и говорим врачу,
      // где её взять.
      if (applied || liveComplete) {
        deleteSession(sessionId).catch(() => {});
      } else {
        notifySessionKept(sessionFailed
          ? 'Расшифровать запись не удалось. Она сохранена в браузере: кнопка «Расшифровать» на стартовом экране (хранится до 7 дней).'
          : emptyResult
          ? 'Полная расшифровка не нашла речи в записи. Звук сохранён в браузере: проверьте его кнопкой «Расшифровать» на стартовом экране или удалите.'
          : 'Запись приёма сохранена в браузере: кнопка «Расшифровать» на стартовом экране (хранится до 7 дней).');
      }
    }
  };

  const toggleRecording = (mode: 'microphone' | 'system' = recordingMode) => {
    if (startBlocked) return;   // остановка идущей записи не блокируется: startBlocked учитывает !isRecording
    // С экрана готового протокола запись не начинается: речь не попала бы в протокол, а звук стёрся бы. Следующий пациент — через «Новый приём».
    if (!isRecording && viewMode === 'protocol') return;
    // Stenographer mode + microphone → use buffered recorder for max accuracy
    if (mode === 'microphone' && stenographerMode) {
      if (isRecording) {
        stopBufferedAndTranscribe();
      } else {
        setRecordingMode('microphone');
        startBufferedRecording();
      }
      return;
    }

    if (!isRecording && Date.now() - newAppointmentAtRef.current < 500) return; // хвост двойного клика по «Новый приём»

    if (isRecording) {
      isRecordingRef.current = false;
      setIsRecording(false);
      setCurrentSpeech("");
      // Порядок строгий: дописать хвост записи → отпустить микрофон → уточнять.
      const stt = sttRef.current;
      void (async () => {
        const sessionId = await stopParallelRecording();
        stt?.disconnect();
        if (sessionId) await refineTranscriptFromRecording(sessionId);
      })();
    } else {
      // Читаем экран до любых сбросов состояния: пустой экран — новый приём.
      const screenEmpty = transcriptRef.current.length === 0 && viewMode !== 'protocol';
      markPriorContextUsedOnStart(screenEmpty);
      if (screenEmpty) {
        // Старт с пустого экрана — новый приём: фоновое уточнение прошлой записи без текста
        // не должно подменить стенограмму этого (оно отбросится по appointmentGenRef, звук останется в браузере).
        appointmentGenRef.current++;
        if (refineRef.current?.finishRequested) refineRef.current.controller.abort();
        refineRef.current = null;
      } else {
        // Продолжение приёма: уточнение первого отрезка больше не покрывает всю речь. Его результат
        // затёр бы надиктованное после продолжения — отбрасываем (см. проверки protocolGenRef).
        protocolGenRef.current++;
        refineRef.current?.controller.abort();
      }
      setTranscribingError(null);
      setRecordingMode(mode);
      setIsRecording(true);
      streamLostRef.current = false;
      // Продолжение записи в том же приёме: уже набранное — «префикс», кэш протокола по нему не годится.
      recordingPrefixRef.current = transcriptRef.current.length;
      setCachedEhrFromDiarize(null);
      // Живые строки не размечены по голосу: пока их не уточнила полная запись, режим «по голосу» выключен.
      voiceLabelledRef.current = false;
      const stt = new SecureMedicalSTT(doctor.specialty.name, (payload) => {
        if (payload.isFinal) {
          setTranscript(prev => [...prev, {
            id: payload.id,
            speaker: payload.speaker,
            text: payload.text,
            timestamp: new Date()
          }]);
          setCurrentSpeech("");
        } else {
          setCurrentSpeech(payload.text);
        }
      }, mode, (ev) => {
        if (ev.type === 'stream-lost') streamLostRef.current = true;
        if (ev.type === 'source-ended') {
          setAiError('Показ вкладки остановлен: голос собеседника больше не записывается, пишется только ваш микрофон. Завершите приём или начните запись звонка заново.');
        } else if (ev.reason === 'auth') {
          setAiError('Живая расшифровка остановилась: сессия истекла. Завершите запись и войдите заново.');
        } else if (parallelRecRef.current) {
          setAiError('Живая расшифровка прервалась: модель распознавания речи недоступна. Звук приёма продолжает сохраняться в браузере — после завершения записи программа попробует расшифровать его целиком.');
        } else {
          setAiError('Живая расшифровка прервалась: модель распознавания речи недоступна. Завершите запись и проверьте состояние программы на стартовом экране.');
        }
      });
      stt.connect().then(() => {
        void startParallelRecording(stt);
      }).catch(err => {
        // Запись не началась и текста нет: контекст ещё ничей, повторный старт его не сотрёт.
        if (transcriptRef.current.length === 0) priorContextUsedRef.current = false;
        console.error("[STT] connect failed:", err);
        setIsRecording(false);
        sttRef.current = null;
        setAiError(err.message || "Не удалось начать запись. Проверьте разрешения браузера.");
        setTimeout(() => setAiError(null), 7000);
      });
      sttRef.current = stt;
    }
  };

  // ── Памятка пациенту ──────────────────────────────────────────────────────

  // Красные флаги берём из курируемого справочника по кодам МКБ-10, найденным
  // в тексте диагноза. Модели этот раздел не доверяем: цена галлюцинации в
  // «когда вызывать скорую» несоизмерима с пользой от вариативности.
  const memoRedFlags = useMemo(() => {
    const categories = findIcd10Categories(ehrNote?.diagnoses || '', doctor.specialty.id);
    const { emergency, urgent } = getRedFlags(categories);
    return [
      ...emergency.map(f => `Вызовите скорую (103 или 112), если: ${f.charAt(0).toLowerCase()}${f.slice(1)}`),
      ...urgent.map(f => `Свяжитесь с врачом, если: ${f.charAt(0).toLowerCase()}${f.slice(1)}`),
    ];
  }, [ehrNote?.diagnoses, doctor.specialty.id]);

  // Памятка протухла: врач правил протокол после того, как её собрали.
  const isMemoStale = !!patientSummary && !!ehrNote && memoSourceEhr !== JSON.stringify(ehrNote);

  // Числа, которых нет в утверждённом протоколе. Ловит главный опасный отказ —
  // подменённую дозировку (см. utils/doseCheck.ts).
  const memoDoseMismatches = useMemo(() => {
    if (!patientSummary || !ehrNote) return [];
    // Все разделы, а не только «Лечение»: ничто не заставляет модель класть
    // дозу именно туда — «снижаем эналаприл до 20 мг» естественно попадает в
    // «что мы решили сегодня», и это число раньше не проверялось вовсе.
    const memoText = MEMO_SECTIONS.map(sec => patientSummary[sec.key] || '').join('\n');
    return findDoseMismatches(memoText, Object.values(ehrNote).join('\n'));
  }, [patientSummary, ehrNote]);

  const buildPatientMemo = async () => {
    if (!ehrNote) return;
    // Пересборка поверх правок. Врач редактирует памятку в textarea, а при
    // онко/психиатрическом диагнозе раздел «Что у вас» вообще пишет только он —
    // и баннер «протокол изменился, пересоберите» прямо толкает нажать кнопку.
    // Раньше это молча стирало написанное, причём condition модель по правилу
    // не заполняет, и раздел просто оставался пустым.
    if (patientSummary && !isMemoBlank(patientSummary)) {
      const ok = window.confirm(
        'Пересобрать памятку заново? Всё, что вы поправили в ней руками, будет заменено текстом модели.'
      );
      if (!ok) return;
    }
    setIsBuildingMemo(true);
    const snapshot = JSON.stringify(ehrNote);
    const doctorWrites = needsDoctorWrittenCondition(ehrNote.diagnoses, doctor.specialty.id);

    const r = await generatePatientSummary(ehrNote, doctor.specialty.name, memoRedFlags, doctorWrites);
    if (r.data) {
      setPatientSummary(r.data);
      setMemoSourceEhr(snapshot);
    } else {
      setAiError(`Не удалось собрать памятку: ${r.error || 'неизвестная ошибка'}`);
      setTimeout(() => setAiError(null), 8000);
    }
    setIsBuildingMemo(false);
  };

  /**
   * Дописывает памятку в черновик приёма.
   *
   * Сохраняем не сгенерированную, а отредактированную врачом версию и в тот
   * момент, когда памятка реально уходит пациенту (печать/копирование):
   * юридически значимо именно то, что человек унёс с собой. Ошибку глотаем —
   * протокол уже сохранён, и ронять из-за памятки основной сценарий нельзя.
   */
  const persistPatientMemo = async (memo: PatientSummary) => {
    const draft = draftRef.current;
    if (!draft) return;
    try {
      // Приём длинный, памятка сохраняется в самом конце — токен успевает
      // протухнуть. Молчаливый 401 означал, что врач уносит распечатку, а в
      // черновике её нет; для «юридически значимо то, что унёс пациент» это
      // ровно тот случай, когда молчать нельзя.
      if (!(await patchDraft(draft.id, { patientSummary: memo }))) {
        setAiError('Памятка не сохранилась в черновик приёма — распечатанная версия у пациента останется, в архиве её не будет.');
        setTimeout(() => setAiError(null), 10000);
      }
    } catch (e) {
      console.error("Не удалось сохранить памятку в черновик:", e);
    }
  };

  /**
   * Дописывает поля в уже сохранённый черновик.
   *
   * PATCH перезаписывает content целиком, а дописывают в черновик двое:
   * памятка (по печати) и разбор общения (сам, через несколько секунд после
   * сохранения). Параллельные PATCH затирали бы друг друга, поэтому они идут
   * одной очередью, и каждый строится на последнем известном содержимом
   * именно этого черновика — врач к тому времени мог начать новый приём, и
   * draftRef уже указывает на другой.
   */
  const patchDraft = (draftId: string, patch: Record<string, unknown>): Promise<boolean> => {
    const run = async () => {
      const known = draftContentsRef.current.get(draftId);
      if (!known) return false;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = getStoredSession()?.token;
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const content = { ...known.content, ...patch };
      const res = await fetch(`/api/drafts/${draftId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ content: { ...content, transcript: known.transcript } }),
      });
      if (!res.ok) return false;
      draftContentsRef.current.set(draftId, { ...known, content });
      if (draftRef.current?.id === draftId) draftRef.current = { ...draftRef.current, content };
      return true;
    };
    const next = draftPatchQueueRef.current.then(run);
    draftPatchQueueRef.current = next.catch(() => false);
    return next;
  };

  // Разбор общения — после приёма и молча. Ни уведомления, ни ошибки на экране:
  // врач уже перешёл к следующему пациенту, а прочитает разбор в истории. Если
  // разбор не получился, в черновик ничего не пишется, и в истории у этого
  // приёма будет кнопка «Разобрать».
  const reviewCommunicationIntoDraft = async (draftId: string, transcriptText: string) => {
    try {
      const result = await requestCommunicationReview(transcriptText, doctor.specialty.name);
      if (result.error) {
        console.warn("Разбор общения не получился:", result.error);
        return;
      }
      await patchDraft(draftId, {
        communicationReview: { notes: result.data, createdAt: new Date().toISOString() },
      });
    } catch (e) {
      console.error("Не удалось сохранить разбор общения:", e);
    }
  };

  const printPatientMemo = () => {
    if (patientSummary) void persistPatientMemo(patientSummary);
    window.print();
  };

  const copyPatientMemo = () => {
    if (!patientSummary) return;
    navigator.clipboard
      .writeText(memoToText(patientSummary, doctor.name, doctor.specialty.name))
      .then(() => {
        setMemoCopied(true);
        setTimeout(() => setMemoCopied(false), 2000);
        void persistPatientMemo(patientSummary);
      })
      .catch(() => setAiError('Не удалось скопировать памятку'));
  };

  const handleTransferToMIS = () => {
    if (!ehrNote) return;
    navigator.clipboard.writeText(ehrToMisText(ehrNote)).then(() => {
      alert("Готово! Протокол скопирован в буфер обмена.\nТеперь вы можете вставить его в ЕМИАС, Инфоклинику или любую другую МИС (Ctrl+V).");
    }).catch(() => {
      alert("Не удалось скопировать текст. Пожалуйста, выделите и скопируйте вручную.");
    });
  };

  const copyField = (text: string, fieldKey: string) => {
    if (!text || !text.trim()) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    const text = manualInput.trim();
    const newId = Date.now().toString();

    setTranscript(prev => [
      ...prev,
      { id: newId, speaker: 'doctor', text, timestamp: new Date() }
    ]);

    setTranscript(prev => prev.map(t => t.id === newId ? { ...t, speaker: 'doctor' } : t));

    setManualInput("");
  };

  // patientSummary кладём в черновик отдельным полем: юридически значимо
  // именно то, что врач отредактировал и реально выдал пациенту, а не то, что
  // сгенерировала модель. Схема БД не меняется — content шифруется целиком
  // как JSON-блоб (см. /api/drafts).
  // silent — черновик прошлого приёма: только на сервер, без состояния экрана (оно уже у нового приёма).
  const saveDraft = async (ehr: EHRNote | null, transcriptLines: typeof transcript, memo: PatientSummary | null = null, silent = false): Promise<boolean> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const token = getStoredSession()?.token;
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const transcriptText = transcriptLines.map(t => {
      const label = speakerLabel(t.speaker);
      return `[${t.timestamp.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}] ${label}: ${t.text}`;
    }).join('\n');

    const content = {
      ...(ehr || { complaints: '', anamnesisMorbi: '', anamnesisVitae: '', allergies: '', examination: '', diagnoses: '(не сформировано)', medications: '', plan: '' }),
      ...(memo ? { patientSummary: memo } : {}),
    };

    const res = await fetch("/api/drafts", {
      method: "POST",
      headers,
      body: JSON.stringify({ content, transcript: transcriptText })
    });

    if (silent) return res.ok;

    // Запоминаем черновик, чтобы позже дописать в него памятку пациенту
    // (PATCH перезаписывает content целиком, поэтому храним и то, что послали).
    try {
      const json = await res.json();
      if (json?.draftId) {
        draftRef.current = { id: json.draftId, content, transcript: transcriptText };
        draftContentsRef.current.set(json.draftId, { content, transcript: transcriptText });
        setCurrentDraftId(json.draftId);
        setDraftEditState('idle');
        if (communicationReview) void reviewCommunicationIntoDraft(json.draftId, transcriptText);
      }
    } catch { /* черновик сохранён, но id не разобрали — памятка и разбор просто не допишутся */ }

    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 4000);
    return res.ok;
  };

  const fullTranscriptText = toAnalyzeText(transcript);

  const requestHints = async () => {
    if (transcript.length === 0) return;
    // Языковая модель не подключена: плашка на стартовом экране уже сказала об
    // этом, а каждый запрос давал бы тост с ошибкой.
    if (health?.llm === false) return;
    // Stenographer mode: pure transcription, no AI hints/pharma during the session.
    // The final protocol is still generated at the end via completeConsultation().
    if (stenographerMode) return;

    setIsGeneratingHints(true);
    setIsSuggestingDiagnosis(true);
    const [hintsResult, pharmaResult, diagnosisResult] = await Promise.all([
      generateClinicalHints(fullTranscriptText, doctor.specialty.name, "Данные из диалога", priorContextRef.current),
      generatePharmaAnalysis(fullTranscriptText, doctor.specialty),
      generateDiagnosisSuggestions(fullTranscriptText, doctor.specialty)
    ]);

    if (hintsResult.error || pharmaResult.error || diagnosisResult.error) {
      setAiError(hintsResult.error || pharmaResult.error || diagnosisResult.error || 'Ошибка AI');
      setTimeout(() => setAiError(null), 6000);
    }
    if (hintsResult.data.length > 0) setHints(hintsResult.data);
    if (pharmaResult.data.length > 0) setPharmaHints(pharmaResult.data);
    // Подсказки всегда обновляются целиком (не "если не пусто") — в отличие
    // от hints/pharma, здесь пустой ответ — тоже значимый результат (по
    // выросшему транскрипту прежний код мог перестать подходить).
    setSuggestedDiagnoses(diagnosisResult.data);
    setIsGeneratingHints(false);
    setIsSuggestingDiagnosis(false);
  };

  useEffect(() => {
    if (transcript.length > 0 && transcript.length % 4 === 0) {
      requestHints();
    }
  }, [transcript, stenographerMode]);

  // Автосохранение правок протокола: врач поправил поле — через 1,5 с правка
  // уходит в уже сохранённый черновик (иначе в истории остаётся текст модели).
  // Только через patchDraft: у него общая очередь с памяткой и разбором общения.
  useEffect(() => {
    if (viewMode !== 'protocol' || !currentDraftId || !ehrNote) return;
    const known = draftContentsRef.current.get(currentDraftId);
    if (!known) return;
    if (EHR_FIELD_KEYS.every(k => (known.content?.[k] ?? '') === (ehrNote[k] ?? ''))) {
      // Врач вернул поля к сохранённым: промежуточная правка отменена, слать нечего.
      pendingPatchRef.current = null;
      return;
    }
    const draftId = currentDraftId;
    const seq = ++draftEditSeqRef.current;
    const fields = Object.fromEntries(EHR_FIELD_KEYS.map(k => [k, ehrNote[k] ?? '']));
    pendingPatchRef.current = { draftId, fields };
    setDraftEditState('idle'); // «Правки сохранены» не должно висеть над новой правкой
    const timer = setTimeout(() => {
      pendingPatchRef.current = null;
      setDraftEditState('saving');
      patchDraft(draftId, fields)
        .then(ok => ok, () => false)
        .then(ok => {
          // Устарело: врач успел поправить ещё раз или начал новый приём.
          if (draftEditSeqRef.current !== seq) return;
          setDraftEditState(ok ? 'saved' : 'error');
        });
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehrNote, currentDraftId, viewMode]);

  const runNoteCheck = async (ehr: EHRNote, transcriptText: string, remote: boolean) => {
    const gen = appointmentGenRef.current;
    setIsCheckingNote(true);
    setNoteCheckError(null);
    const r = await checkNote(transcriptText, ehr, doctor.specialty.name, remote, priorContextRef.current);
    if (appointmentGenRef.current !== gen) return;   // начался другой приём
    setIsCheckingNote(false);
    if (!r.data) { setNoteCheckError(r.error ?? 'Сверка не удалась'); return; }
    setNoteCheck(r.data);
    setNoteCheckSourceEhr(JSON.stringify(ehr));
  };

  // Врач принял пропуск: формулировка дописывается в поле, а цитата, которой
  // она подтверждена, становится опорой этого поля. Снимок обновляется, чтобы
  // собственное действие врача не объявляло всю сверку устаревшей.
  const acceptOmission = (o: NoteOmission) => {
    if (!ehrNote || !noteCheck) return;
    const prev = ehrNote[o.field] ?? '';
    const next = { ...ehrNote, [o.field]: prev.trim() ? `${prev.trimEnd()}\n${o.suggestion}` : o.suggestion };
    setEhrNote(next);
    setNoteCheck({
      ...noteCheck,
      sources: { ...noteCheck.sources, [o.field]: [...(noteCheck.sources[o.field] ?? []), o.quote] },
      unsupported: noteCheck.unsupported.filter(f => f !== o.field),
      omissions: noteCheck.omissions.filter(x => x !== o),
    });
    setNoteCheckSourceEhr(JSON.stringify(next));
  };
  const dismissOmission = (o: NoteOmission) => {
    if (!noteCheck) return;
    setNoteCheck({ ...noteCheck, omissions: noteCheck.omissions.filter(x => x !== o) });
  };
  const isNoteCheckStale = !!noteCheck && !!ehrNote && noteCheckSourceEhr !== JSON.stringify(ehrNote);

  const runCompleteConsultation = async () => {
    if (finishActiveRef.current) return; // двойной клик: протокол уже собирается
    const finishId = ++finishSeqRef.current;
    finishActiveRef.current = finishId;
    const gen = appointmentGenRef.current;
    protocolGenRef.current++;
    // Врач начал новый приём — этот проход ничей, на экран нового не лезем.
    // Уход с экрана сюда не входит: протокол всё равно дособирается и сохраняется.
    const isStale = () => appointmentGenRef.current !== gen;
    const resetFinish = () => {
      if (finishActiveRef.current === finishId) finishActiveRef.current = 0;
    };
    const KEPT_MSG = 'Запись предыдущего приёма сохранена в браузере: кнопка «Расшифровать» на стартовом экране (хранится до 7 дней).';
    // Флаг дистанционного приёма запоминается на повторные сверки.
    // Запись звука вкладки (recordingMode === 'system') и есть онлайн-приём.
    // Берём до первого await: дальше врач мог что-то переключить.
    const wasRemote = recordingMode === 'system';

    // Живая стенограмма не размечена по голосам. Если запись ещё идёт (врач не
    // нажимал «Стоп») или уточнение после «Стоп» не закончилось — расшифровываем
    // запись целиком и берём протокол по ней; не вышло — по живой, как раньше.
    let refinedLines: TranscriptLine[] | null = null;
    // Уточнение с прошлого приёма (врач ушёл «Новым приёмом») подхватывать нельзя.
    const pending = isPendingForVisit(refineRef.current?.gen, gen) ? refineRef.current : null;
    const withRefine = !!(isRecording || pending);
    // Не зависит от isRecording: после «Стоп» второго отрезка уточнение ещё может идти.
    const resumed = isResumedFinish(withRefine, recordingPrefixRef.current);
    // Аудио, которое «Завершить» обязано либо стереть после сохранённого протокола, либо оставить врачу.
    let ownedSessionId: string | null = null;
    let diarizeReuse: Promise<DiarizeReuse | null> | null = null;
    if (withRefine) {
      setIsGeneratingEHR(true);
      setViewMode('protocol');
      if (resumed) {
        // «Продолжить запись»: полная запись покрывает только последний отрезок, а
        // голоса в каждой записи нумеруются заново — склейка небезопасна, идём по
        // живой стенограмме целиком (как до уточнения).
        // Идущее уточнение второго отрезка не подхватываем: прервём (протокол уже не по нему).
        if (refineRef.current?.gen === gen) refineRef.current.controller.abort();
        if (isRecording) {
          isRecordingRef.current = false;
          setIsRecording(false);
          setCurrentSpeech("");
          const stt = sttRef.current;
          if (streamLostRef.current && parallelRecRef.current) void keepParallelRecording();
          else await discardParallelRecording();
          stt?.disconnect();
        }
        if (isStale()) { resetFinish(); return; }
        setAiError(FALLBACK_NOTICE_NO_AUDIO);
        setTimeout(() => setAiError(null), 15000);
      } else {
      setFinishStage('transcribing');
      let handle = pending;
      let incompleteAudioFinish = false;
      if (isRecording) {
        isRecordingRef.current = false;
        setIsRecording(false);
        setCurrentSpeech("");
        // Как «Стоп»: дописать хвост записи → отпустить микрофон → расшифровывать.
        const stt = sttRef.current;
        const sessionId = await stopParallelRecording();
        stt?.disconnect();
        if (sessionId && !isStale()) {
          void refineTranscriptFromRecording(sessionId, { finish: true });
          // Звук неполный: refine ушёл по ранней ветке (стёр запись или оставил врачу) и не заводил уточнение —
          // ждать нечего, протокол по живой стенограмме.
          if (lastParallelIncompleteRef.current) incompleteAudioFinish = true;
          else handle = refineRef.current;
        } else if (sessionId) {
          notifySessionKept(KEPT_MSG);
        }
      }
      let outcome: RefineOutcome<TranscriptLine> | null = null;
      let owned = false;
      if (handle && !incompleteAudioFinish) {
        handle.finishRequested = true; // refine не трогает стенограмму и аудио — этим занимаемся мы
        const raced = await raceWithTimeout(handle.result, refineTimeoutMs(handle.durationMs, sttEngineRef.current));
        if (raced.timedOut) {
          handle.controller.abort();
          outcome = { kind: 'timeout' };
          owned = true;
        } else {
          outcome = raced.value!.outcome;
          owned = raced.value!.owned;
        }
        // Поздний «Завершить»: разметку Врач/Пациент уже считали — берём её, а не платим за второй analyze.
        if (!owned) diarizeReuse = handle.diarize ?? null;
      }
      if (isStale()) {
        // Аудио нового приёма не касаемся; старое, не доведённое до протокола, оставляем врачу.
        if (handle && owned) notifySessionKept(KEPT_MSG);
        resetFinish();
        return;
      }
      const plan = planFinishTranscript(transcriptRef.current, voiceLabelledRef.current, outcome);
      if (handle && owned) ownedSessionId = handle.sessionId;
      if (plan.source === 'refined') {
        refinedLines = plan.lines;
        setTranscript(plan.lines);
        voiceLabelledRef.current = plan.voiceLabelled;
        setCachedEhrFromDiarize(null); // кэш был бы собран по живому тексту
        // Запись пока не стираем: только после того, как протокол лёг в историю.
      } else if (handle && owned && plan.keepAudio) {
        ownedSessionId = null;
        notifySessionKept(plan.notice!);
      } else {
        // Аудио не наше (refine уже распорядился им сам) либо записи нет — без слов про «Незавершённые».
        // Неполный звук: refine сам сказал врачу, что с записью, его сообщение не перекрываем.
        if (!incompleteAudioFinish) {
          setAiError(FALLBACK_NOTICE_NO_AUDIO);
          setTimeout(() => setAiError(null), 15000);
        }
      }
      }
    }
    if (withRefine && !resumed) setFinishStage('protocol');
    setIsGeneratingEHR(true);
    setViewMode('protocol');
    setConsultationWasRemote(wasRemote);

    // Use the EHR we already generated during auto-diarize (stenographer mode)
    // — saves an LLM call and 5-15 seconds of waiting for the doctor.
    let result: { ehr: EHRNote; diarizedTranscript: { speaker: string; text: string }[]; protocolTemplateUsed?: boolean; priorContextUsed?: boolean; diarizationSource?: 'voice' | 'llm' } | null = null;
    let fromCache = false;
    let analysisError = false;
    // Кэш переиспользуем, только если он собран с тем же шаблоном, что выбран
    // сейчас. Иначе врач выбрал шаблон после диаризации и получил бы протокол
    // без него — молча и необъяснимо. В этом случае платим за analyze повторно.
    // Шаблон, гайдлайн и тип приёма читаем из ref: за время расшифровки врач мог их сменить.
    const tpl = selectedTemplateRef.current;
    const templateMatchesCache = cachedEhrFromDiarize?.templateTitle === (tpl?.title ?? null);
    // После уточнения/продолжения кэш (собранный по живому тексту) не годится.
    let reused: DiarizeReuse | null = null;
    if (diarizeReuse) {
      const d = await diarizeReuse.catch(() => null);
      if (d?.data?.ehr && d.templateTitle === (tpl?.title ?? null)
        && d.guideline === guidelineRef.current && d.consultationType === consultationTypeRef.current
        && d.priorContext === priorContextRef.current) reused = d;
    }
    if (isStale()) {
      if (ownedSessionId) notifySessionKept(KEPT_MSG);
      resetFinish();
      return;
    }
    if (reused) {
      result = reused.data;
    } else if (!withRefine && cachedEhrFromDiarize && templateMatchesCache) {
      result = {
        ehr: cachedEhrFromDiarize.ehr,
        // The transcript state is already diarized — derive diarizedTranscript
        // from it so the downstream "save" code path doesn't need to special-case
        diarizedTranscript: transcriptRef.current
          .filter(t => t.speaker === 'doctor' || t.speaker === 'patient' || t.speaker === 'unknown' || isVoiceLabel(t.speaker))
          .map(t => ({ speaker: t.speaker, text: t.text })),
      };
      fromCache = true;
      setCachedEhrFromDiarize(null); // consume it
    } else {
      setCachedEhrFromDiarize(null); // если был — он не подходит под выбранный шаблон
      // Стейт после await устарел: текст берём из самих строк / ref стенограммы.
      const analyzeText = refinedLines ? toAnalyzeText(refinedLines)
        : withRefine ? toAnalyzeText(transcriptRef.current) : fullTranscriptText;
      const analyzeResult = await analyzeConsultation(analyzeText, doctor.specialty.name, "Данные пациента хранятся в МИС, извлекайте из речи", guidelineRef.current, consultationTypeRef.current, tpl, wasRemote, priorContextRef.current, voiceLabelledRef.current);
      result = analyzeResult.data;
      if (isStale()) {
        // Начат новый приём: протокол прошлого пациента на его экран не попадает,
        // но и пропасть не должен — кладём в историю тихо, не трогая состояние нового приёма.
        const staleLines = refinedLines ?? transcriptRef.current;
        const savedQuiet = result?.ehr
          ? await saveDraft(result.ehr, staleLines, null, true).catch(() => false) : false;
        if (ownedSessionId) {
          if (shouldDeleteAudio(!!result?.ehr, savedQuiet)) deleteSession(ownedSessionId).catch(() => {});
          else notifySessionKept(KEPT_MSG);
        }
        resetFinish();
        return;
      }

      if (analyzeResult.error) {
        analysisError = true;
        setAiError(`Не удалось сформировать протокол: ${analyzeResult.error}`);
        setTimeout(() => setAiError(null), 8000);
      }
    }

    // Build the diarized transcript array we'll save. Prefer the LLM diarization,
    // fall back to whatever's currently on screen (covers cases where analyze
    // failed but the doctor still wants the raw text saved).
    const diarizedLines: TranscriptLine[] = (result?.diarizedTranscript && result.diarizedTranscript.length > 0)
      ? result.diarizedTranscript.map((line, idx) => ({
          id: `diarized_${Date.now()}_${idx}`,
          speaker: normalizeLineSpeaker(line.speaker),
          text: line.text,
          timestamp: new Date(),
        }))
      : (refinedLines ?? transcriptRef.current);

    // Human-readable text with Врач/Пациент labels — used for the draft transcript field.
    const diarizedText = diarizedLines.map(t => {
      const label = speakerLabel(t.speaker);
      return `${label}: ${t.text}`;
    }).join('\n');

    if (result) {
      setEhrNote(result.ehr);
      if (result.protocolTemplateUsed !== undefined) setProtocolFromTemplate(result.protocolTemplateUsed);
      if (result.priorContextUsed !== undefined) setProtocolWithPrior(result.priorContextUsed);
      // Проверяющий проход — не ждём: врач уже читает протокол, цитаты
      // подъедут под поля через несколько секунд. Без протокола проверять
      // нечего: сервер ответил бы 400 «Нужны стенограмма и протокол».
      if (result.ehr) void runNoteCheck(result.ehr, diarizedText, wasRemote);
      else if (!analysisError && !ownedSessionId) {
        // Модель вернула ответ без протокола и ошибки нет — иначе экран остался бы немым.
        // С записью в браузере своё сообщение ниже (notifySessionKept, 15 с): два подряд и
        // таймер этого сообщения, стирающий чужое, не нужны.
        setAiError('Модель не вернула протокол. Стенограмма сохранена: сформируйте протокол заново из Истории.');
        setTimeout(() => setAiError(null), 8000);
      }

      if (result.diarizedTranscript && result.diarizedTranscript.length > 0) {
        // из кэша диаризации сюда приходит тот же текст — флаг не меняется
        if (!fromCache) voiceLabelledRef.current = result.diarizationSource === 'voice';
        setTranscript(diarizedLines);
      }
    }

    setIsGeneratingEHR(false);
    setFinishStage(null);
    resetFinish();

    // Pass the already-diarized lines directly — transcriptRef.current may not
    // have caught up with the setTranscript above yet (React batching).
    const saved = await saveDraft(result?.ehr ?? null, diarizedLines).catch(e => { console.error("Could not save draft:", e); return false; });
    // 152-ФЗ: запись стираем только когда протокол уже в истории; иначе она остаётся врачу.
    if (ownedSessionId) {
      if (shouldDeleteAudio(!!result?.ehr, saved)) deleteSession(ownedSessionId).catch(() => {});
      else notifySessionKept(result?.ehr
        ? 'Протокол не удалось сохранить в историю — запись приёма оставлена в «Незавершённых»: кнопка «Расшифровать» на стартовом экране (хранится до 7 дней).'
        : 'Протокол не сформирован — запись приёма оставлена в «Незавершённых»: кнопка «Расшифровать» на стартовом экране (хранится до 7 дней).');
    }
  };

  // Неожиданный сбой не должен оставить кнопку навсегда заблокированной.
  const completeConsultation = () => {
    const gen0 = appointmentGenRef.current;
    runCompleteConsultation().catch((e: any) => {
      console.error('[Finish] failed:', e);
      if (appointmentGenRef.current === gen0) {
        setIsGeneratingEHR(false);
        setFinishStage(null);
        finishActiveRef.current = 0;
        setAiError(`Не удалось сформировать протокол: ${e?.message || 'ошибка'}`);
        setTimeout(() => setAiError(null), 8000);
      }
    });
  };

  // Пока собирается протокол, новую запись начинать нельзя: стенограммы двух пациентов смешались бы.
  const startBlocked = !isRecording && (finishStage !== null || isGeneratingEHR || !!transcriptionProgress);

  // Строку, которую сейчас расшифровывают, прячем: при сбое она вернётся в плашку.
  const unfinishedVisible = unfinishedSessions.filter(
    s => !(transcriptionProgress && s.sessionId === bufferedSessionId),
  );

  const showNewAppointmentBtn = viewMode === 'protocol' || (viewMode === 'consultation' && (transcript.length > 0 || isRecording));
  // Настраивать рабочее поле можно ТОЛЬКО до начала приёма (idle-экран).
  // Раньше кнопка была видна и во время реальной консультации — доктора
  // жаловались на баги при драге поверх активного приёма, поэтому
  // редактирование во время приёма убрали: кнопка показывается только пока
  // приём ещё не начался (нет стенограммы/записи), сам грид при этом
  // продолжает отображаться и во время приёма — просто без возможности
  // перетаскивать/менять видимость.
  const isConsultationGridActive =
    viewMode === 'consultation' &&
    transcript.length === 0 && !currentSpeech && !isRecording;

  return (
    <div className="h-screen bg-ds-50 text-ds-950 font-sans flex flex-col overflow-hidden">

      {/* AI ERROR TOAST */}
      {aiError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-error-900 text-white text-[13px] font-medium px-4 py-3 rounded-xl shadow-xl max-w-md">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span>{aiError}</span>
          <button onClick={() => setAiError(null)} className="ml-auto opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* HEADER */}
      <header className="h-[56px] md:h-[64px] bg-white border-b border-ds-200 px-3 md:px-6 flex items-center justify-between flex-shrink-0 z-50 shadow-sm">
        <BrandLockup size={22} />

        {/* MOBILE: бургер справа */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="md:hidden p-2 -mr-1 text-ds-800 hover:bg-ds-100 rounded-lg transition-colors"
          aria-label="Меню"
        >
          <Menu size={22} />
        </button>

        {/* DESKTOP: вся панель */}
        <div className="hidden md:flex items-center gap-6">

              {showNewAppointmentBtn && (
                <button
                  onClick={startNewAppointment}
                  className="flex items-center gap-2 px-5 py-2 font-semibold text-[12px] uppercase tracking-wider rounded-lg transition-colors bg-ds-100 border border-ds-200 text-ds-800 hover:bg-ds-200"
                >
                  <ArrowLeft size={13} /> Новый приём
                </button>
              )}

              <button
                onClick={() => toggleRecording()}
                disabled={startBlocked || (!isRecording && viewMode === 'protocol')}
                title={startBlocked
                  ? 'Дождитесь, пока соберётся протокол или закончится расшифровка'
                  : (!isRecording && viewMode === 'protocol')
                  ? 'Чтобы начать следующего пациента, нажмите «Новый приём»'
                  : undefined}
                className={`flex items-center gap-2 px-5 py-2 font-semibold text-[12px] uppercase tracking-wider rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                  ${isRecording
                    ? 'bg-error-50 text-error-700 border border-error-200 hover:bg-error-100'
                    : 'bg-primary-600 text-white hover:bg-primary-700 border border-primary-600'
                  }`}
              >
                {isRecording ? (
                  <>
                    <span className="w-2 h-2 bg-error-600 rounded-full animate-pulse"></span>
                    {recordingMode === 'system' ? <Monitor size={13} /> : <Mic size={13} />}
                    Идёт приём
                  </>
                ) : viewMode === 'protocol' ? (
                  <><Mic size={15} /> Начать приём</>
                ) : recordingMode === 'system' ? (
                  <><Monitor size={15} /> {transcript.length > 0 ? 'Продолжить запись звонка' : 'Записать звонок'}</>
                ) : transcript.length > 0 && !stenographerMode ? (
                  // Живой режим со стенограммой на экране: кнопка продолжает тот же приём, а не начинает новый.
                  <><Mic size={15} /> Продолжить запись</>
                ) : (
                  <><Mic size={15} /> Начать приём</>
                )}
              </button>

              <div className="h-[24px] w-[1px] bg-black/10"></div>

              <div>
                <select
                  value={guideline}
                  onChange={(e) => setGuideline(e.target.value as import('./types').GuidelineType)}
                  className="bg-ds-100 border border-ds-400 text-ds-800 text-[11px] font-semibold uppercase tracking-wide px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 transition-colors appearance-none cursor-pointer"
                  title="Выбор медицинских рекомендаций"
                >
                  <option value="international">Международные КР</option>
                  <option value="russian">Российские КР (Минздрав)</option>
                </select>
              </div>

              <div className="h-[24px] w-[1px] bg-black/10"></div>

          <div className="text-right flex flex-col justify-center">
            <div className="font-semibold flex items-center gap-1.5 justify-end text-[13px] text-ds-900">
              <User size={13} /> <span>{doctor.name}</span>
            </div>
            <div className="text-[10px] text-ds-600 font-mono uppercase tracking-widest mt-0.5">
              {doctor.specialty?.name || 'Врач'}
            </div>
          </div>

          <div className="h-5 w-px bg-ds-200"></div>

          <div className="flex items-center gap-3">
            {isConsultationGridActive && (
              <button
                onClick={() => setWorkspaceEditMode(v => !v)}
                className={`hidden lg:flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-semibold rounded-lg border transition-all ${
                  workspaceEditMode
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'bg-ds-100 border-ds-200 text-ds-800 hover:bg-ds-200'
                }`}
              >
                <LayoutGrid size={13} /> {workspaceEditMode ? 'Готово' : 'Настроить рабочее поле'}
              </button>
            )}

            <button
              onClick={goToProfile}
              className="bg-ds-100 border border-ds-200 text-ds-800 px-3.5 py-1.5 text-[12px] font-semibold rounded-lg hover:bg-ds-200 transition-all"
            >
              Профиль
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 text-ds-600 hover:text-primary-600 transition-colors rounded-lg"
              title="Настройки"
            >
              <Settings size={16} />
            </button>

            <button
              onClick={handleLogout}
              className="p-1.5 text-ds-600 hover:text-error-600 transition-colors rounded-lg"
              title="Выйти"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER — все функции хедера */}
      {mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-[60]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="md:hidden fixed top-0 right-0 bottom-0 w-[82%] max-w-[340px] bg-white z-[70] shadow-2xl flex flex-col overflow-y-auto">
            {/* Шапка drawer */}
            <div className="flex items-center justify-between px-4 h-[56px] border-b border-ds-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <User size={16} className="text-ds-600" />
                <div className="flex flex-col leading-tight">
                  <span className="text-[14px] font-semibold text-ds-950">{doctor.name}</span>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-ds-600">
                    {doctor.specialty?.name || 'Врач'}
                  </span>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 -mr-2 text-ds-600 hover:bg-ds-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Действия */}
            <div className="flex flex-col p-2 gap-1">
              {showNewAppointmentBtn && (
                <button
                  onClick={() => { setMobileMenuOpen(false); startNewAppointment(); }}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg text-[14px] text-ds-800 hover:bg-ds-100 transition-colors text-left"
                >
                  <ArrowLeft size={17} /> Новый приём
                </button>
              )}

                <div className="px-3 py-2">
                  <label className="block text-[10px] uppercase font-semibold tracking-wide text-ds-600 mb-1.5">
                    Клинические рекомендации
                  </label>
                  <select
                    value={guideline}
                    onChange={(e) => setGuideline(e.target.value as import('./types').GuidelineType)}
                    className="w-full bg-ds-100 border border-ds-400 text-ds-800 text-[13px] px-3 py-2.5 rounded-lg outline-none"
                  >
                    <option value="international">Международные КР</option>
                    <option value="russian">Российские КР (Минздрав)</option>
                  </select>
                </div>

              <button
                onClick={() => { setMobileMenuOpen(false); goToProfile(); }}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-[14px] text-ds-800 hover:bg-ds-100 transition-colors text-left"
              >
                <User size={17} /> Профиль
              </button>

              <button
                onClick={() => { setMobileMenuOpen(false); setShowSettings(true); }}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-[14px] text-ds-800 hover:bg-ds-100 transition-colors text-left"
              >
                <Settings size={17} /> Настройки
              </button>

              <div className="h-px bg-ds-200 my-2 mx-3" />

              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-[14px] text-error-700 hover:bg-error-50 transition-colors text-left"
              >
                <LogOut size={17} /> Выйти
              </button>
            </div>
          </div>
        </>
      )}

      {/* WORKSPACE */}
      {(transcript.length === 0 && !currentSpeech && !isRecording && viewMode !== 'protocol' && !workspaceEditMode) ? (
        /* EMPTY STATE — full-width centered, NOT inside the grid. This is what
           the doctor sees before starting a consultation. Three start cards
           laid out responsively: single column on mobile, 3-up on desktop.
           Искл.: workspaceEditMode — доктор нажал «Настроить рабочее поле» до
           начала приёма, пробиваем идущий стейт и показываем грид блоков
           (последняя ветка ниже) в режиме редактирования. */
        <main className="flex-grow flex flex-col items-center justify-center p-3 md:p-6 pb-36 md:pb-6 bg-ds-50 overflow-y-auto">
          <div className="w-full max-w-5xl">
            <div className="text-center mb-6">
              <h2 className="text-[20px] font-semibold text-ds-900 mb-1">Начало приёма</h2>
              <p className="text-[13px] text-ds-600">Выберите способ записи и тип приёма</p>
            </div>

            <ServiceStatusBanner health={health} reachable={reachable} />
            <MicCheck />

            {/* Banner: unfinished sessions in IndexedDB — let the doctor recover
                a recording that was interrupted by a tab close / network drop. */}
            <TranscribeStatusCard
              progress={transcriptionProgress}
              error={transcribingError}
              onCancel={cancelTranscription}
              onDismiss={() => setTranscribingError(null)}
            />
            {unfinishedVisible.length > 0 && (
              <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 text-warning-900 font-semibold text-[13px] mb-2">
                  <AlertCircle size={14} />
                  Найдены незавершённые записи ({unfinishedVisible.length})
                </div>
                <div className="space-y-2">
                  {unfinishedVisible.map(s => (
                    <div key={s.sessionId} className="flex items-center justify-between gap-3 bg-white border border-warning-100 rounded-lg px-3 py-2">
                      <div className="text-[12px] text-ds-900 flex-1 min-w-0">
                        <div className="font-mono">
                          {new Date(s.startedAt).toLocaleString('ru-RU')}
                        </div>
                        <div className="text-[11px] text-ds-600">
                          {formatSessionDuration(s.durationMs)} · {s.consultationType === 'primary' ? 'Первичный' : 'Повторный'}
                        </div>
                        {s.status === 'recording' && (
                          <div className="text-[11px] text-ds-600">
                            Запись оборвалась, последние секунды могли не сохраниться.
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => resumeUnfinishedSession(s.sessionId)}
                          disabled={startBlocked}
                          className="text-[11px] font-semibold px-2.5 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Расшифровать
                        </button>
                        <button
                          onClick={() => dismissUnfinishedSession(s.sessionId)}
                          className="text-[11px] font-semibold px-2.5 py-1.5 text-ds-600 hover:text-error-600"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Контекст «Из МИС» — вставляется до записи, действует на весь приём */}
            <div className={`bg-white border rounded-xl shadow-sm mb-3 px-5 py-3 transition-colors ${priorContext.trim() ? 'border-primary-200' : 'border-ds-200'}`}>
              <button
                type="button"
                onClick={() => setPriorContextOpen(o => !o)}
                className="w-full flex items-center justify-between gap-3 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${priorContext.trim() ? 'bg-primary-50 text-primary-600' : 'bg-ds-100 text-ds-600'}`}>
                    <FileText size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-ds-900 text-[13px]">Из МИС: предыдущий приём</div>
                    <div className="text-[11px] text-ds-600 truncate">
                      {priorContext.trim()
                        ? `Вставлено ${priorContext.trim().length} зн. — учтётся в подсказках, протоколе и сверке`
                        : 'Вставьте прошлый протокол или выписку — модель учтёт анамнез и текущую терапию, а не выдумает их'}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-primary-600 flex-shrink-0">
                  {priorContextOpen ? 'Свернуть' : priorContext.trim() ? 'Изменить' : 'Добавить'}
                </span>
              </button>
              {priorContextOpen && (
                <div className="mt-3">
                  <textarea
                    value={priorContext}
                    onChange={e => { priorContextUsedRef.current = false; setPriorContext(e.target.value.slice(0, PRIOR_CONTEXT_MAX)); }}
                    disabled={!!transcriptionProgress || isRefiningTranscript}
                    title={transcriptionProgress || isRefiningTranscript ? 'Идёт расшифровка: контекст изменить нельзя, чтобы он не попал в чужой протокол' : undefined}
                    rows={7}
                    placeholder={'Скопируйте из МИС протокол прошлого визита или выписку: диагнозы, анамнез, текущие назначения, аллергии.\n\nМодель возьмёт из него фон (анамнез, терапию), пометит такие пункты «(по данным предыдущего приёма)» и не перенесёт прошлый осмотр и жалобы в сегодняшний протокол.'}
                    className="w-full text-[13px] text-ds-900 border border-ds-200 rounded-lg p-3 leading-relaxed focus:outline-none focus:border-primary-400 font-mono disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  <div className="flex items-center justify-between gap-3 mt-1.5 text-[10px] text-ds-600">
                    <span>Нигде не сохраняется. Действует на один приём: при следующем приёме его нужно вставить заново. В модель уходит без ФИО, телефонов и дат.</span>
                    <span className="flex items-center gap-3 flex-shrink-0">
                      <span className={priorContext.length >= PRIOR_CONTEXT_MAX ? 'text-error-600 font-semibold' : ''}>{priorContext.length}/{PRIOR_CONTEXT_MAX}</span>
                      {priorContext && (
                        <button
                          type="button"
                          onClick={() => { priorContextUsedRef.current = false; setPriorContext(''); }}
                          disabled={!!transcriptionProgress || isRefiningTranscript}
                          title={transcriptionProgress || isRefiningTranscript ? 'Идёт расшифровка: контекст изменить нельзя' : undefined}
                          className="font-semibold text-ds-600 hover:text-error-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-ds-600"
                        >Очистить</button>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {/* Очный приём */}
              <div className="bg-white border border-ds-200 p-5 rounded-xl shadow-sm hover:border-primary-200 hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center">
                    <Mic size={18} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-ds-900 text-[14px]">Очный приём</h3>
                    <p className="text-[12px] text-ds-600">Микрофон</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-3 px-1 text-[11px] text-ds-600">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    {!stenographerMode && <span className="font-semibold text-ds-900">T-one</span>}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      consultationType === 'primary' ? 'bg-primary-100 text-primary-700' : 'bg-warning-100 text-warning-700'
                    }`}>
                      {consultationType === 'primary' ? 'Первичный' : 'Повторный'}
                    </span>
                    {SPECIALTY_UI[doctor.specialty.id] && (
                      <span
                        className={`px-1.5 py-0.5 ${SPECIALTY_UI[doctor.specialty.id].bg} ${SPECIALTY_UI[doctor.specialty.id].text} rounded text-[10px] font-semibold`}
                        title={`AI настроен на ${SPECIALTY_UI[doctor.specialty.id].label.toLowerCase()}: специализированные промпты, чек-лист, фарма-проверки`}
                      >
                        {SPECIALTY_UI[doctor.specialty.id].emoji} {SPECIALTY_UI[doctor.specialty.id].label}
                      </span>
                    )}
                    {stenographerMode && <span className="px-1.5 py-0.5 bg-ds-100 rounded text-[10px]">Стенограф</span>}
                  </span>
                </div>
                <button onClick={() => toggleRecording('microphone')} disabled={startBlocked} className="w-full py-2.5 bg-primary-600 text-white font-semibold text-[13px] rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Начать приём
                </button>
                {stenographerMode && (
                  <p className="text-[10px] text-primary-600 mt-2 leading-tight">
                    🎙 Полная запись → расшифровка целиком при завершении (max точность)
                  </p>
                )}
                {/* Type toggle */}
                <div className="mt-3">
                  <div className="text-[10px] uppercase tracking-wide text-ds-600 font-semibold mb-1.5 px-1">Тип приёма</div>
                  <div className="flex gap-1 bg-ds-100 rounded-lg p-1">
                    <button
                      onClick={() => setConsultationType('primary')}
                      className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                        consultationType === 'primary'
                          ? 'bg-white text-primary-600 shadow-sm'
                          : 'text-ds-600 hover:text-ds-900'
                      }`}
                    >
                      Первичный
                    </button>
                    <button
                      onClick={() => setConsultationType('follow-up')}
                      className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                        consultationType === 'follow-up'
                          ? 'bg-white text-primary-600 shadow-sm'
                          : 'text-ds-600 hover:text-ds-900'
                      }`}
                    >
                      Повторный
                    </button>
                  </div>
                </div>
              </div>

              {/* Системное аудио */}
              <div className="bg-white border border-ds-200 p-5 rounded-xl shadow-sm hover:border-primary-200 hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center">
                    <Monitor size={18} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-ds-900 text-[14px]">Онлайн-приём</h3>
                    <p className="text-[12px] text-ds-600">Zoom / Teams / Meet в браузере</p>
                  </div>
                </div>
                <p className="text-[11px] text-ds-600 mb-3 leading-snug">
                  Пишется звук вкладки со звонком и ваш микрофон. Звонок должен идти во вкладке Chrome или Edge: в окне выбора укажите её и включите «Поделиться звуком вкладки». Лучше в наушниках — без них собеседник может попасть в запись дважды.
                </p>
                <button onClick={() => toggleRecording('system')} disabled={startBlocked} className="w-full py-2.5 bg-primary-600 text-white font-semibold text-[13px] rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Записать звонок
                </button>
              </div>

            </div>

            <div className="text-center text-[11px] text-ds-600">
              <button onClick={() => setShowSettings(true)} className="text-primary-600 hover:underline">
                Открыть настройки
              </button>
              {' · '}
              <span>Режим стенографа, разбор общения</span>
            </div>
          </div>
        </main>
      ) : viewMode === 'protocol' ? (
        /* PROTOCOL VIEW */
        <main className="flex-grow overflow-y-auto bg-ds-50 p-3 md:p-6 pb-36 md:pb-6">
          <div className="max-w-4xl mx-auto">
            {isGeneratingEHR && (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-5"></div>
                <p className="text-[13px] tracking-widest text-primary-600 font-semibold animate-pulse uppercase">
                  {finishStage === 'transcribing' ? 'Распознаём речь…' : finishStage === 'protocol' ? 'Готовим протокол…' : 'Анализ и структурирование...'}
                </p>
                {finishStage === 'transcribing' && (
                  <p className="mt-3 text-[12px] text-ds-600 max-w-sm text-center leading-relaxed">
                    Запись разбирается целиком, чтобы разделить реплики по голосам. Это может занять несколько минут.
                  </p>
                )}
              </div>
            )}

            {ehrNote && !isGeneratingEHR && (
              <>
                <div className="mb-6 p-4 bg-warning-50 border border-warning-200 rounded-lg flex items-start gap-3">
                  <AlertCircle size={16} className="text-warning-600 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-warning-800 uppercase tracking-wide font-bold leading-tight">
                    Проверьте и отредактируйте данные перед копированием в МИС. Все поля доступны для редактирования.
                  </p>
                </div>
                {protocolFromTemplate && (
                  <p className="mb-4 -mt-3 text-[11px] text-black/50">Собран по вашему личному шаблону протокола (Личный кабинет → Личный шаблон протокола).</p>
                )}
                {protocolWithPrior && (
                  <p className="mb-4 -mt-3 text-[11px] text-black/50">Учтён контекст «Из МИС»: пункты из прошлого приёма помечены «(по данным предыдущего приёма)», расхождения — в плане.</p>
                )}

                {/* ── СВЕРКА СО СТЕНОГРАММОЙ ──────────────────────────────
                    Второй, проверяющий проход по готовому протоколу: под
                    каждым полем — дословные цитаты, на которых оно стоит
                    (сервер сверил их с текстом), поле без единой цитаты
                    помечено, а ниже — то, что прозвучало и выпало. Смысл в
                    том, чтобы врач протокол СВЕРЯЛ, а не читал: гладкий
                    текст с выдуманной дозой читается так же, как верный. */}
                <div className="mb-6 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap text-[11px] p-3 rounded-lg bg-primary-50 border border-primary-100">
                    {isCheckingNote ? (
                      <span className="flex items-center gap-2 text-black/50">
                        <span className="w-3 h-3 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                        Сверяю протокол со стенограммой…
                      </span>
                    ) : noteCheckError ? (
                      <span className="text-error-700">{noteCheckError}</span>
                    ) : !noteCheck ? (
                      <span className="text-black/40">Сверка со стенограммой не выполнялась.</span>
                    ) : isNoteCheckStale ? (
                      <span className="text-warning-800">Протокол изменён после сверки — цитаты под полями могут не совпадать с текстом.</span>
                    ) : (
                      <span className="text-black/60">
                        Сверено со стенограммой: {EHR_FIELD_KEYS.filter(k => (ehrNote[k] ?? '').trim() && ((noteCheck.sources[k]?.length ?? 0) > 0 || (noteCheck.priorSources?.[k]?.length ?? 0) > 0)).length} полей с опорой,{' '}
                        {noteCheck.unsupported.length} без{noteCheck.omissions.length ? `, пропусков: ${noteCheck.omissions.length}` : ''}.
                      </span>
                    )}
                    {!isCheckingNote && (
                      <button
                        onClick={() => runNoteCheck(ehrNote, fullTranscriptText, consultationWasRemote)}
                        disabled={transcript.length === 0}
                        className="text-[9px] uppercase font-bold tracking-widest text-primary-700 hover:text-primary-900 disabled:opacity-40"
                      >
                        {noteCheck ? 'Сверить заново' : 'Сверить со стенограммой'}
                      </button>
                    )}
                  </div>

                  {noteCheck && !isNoteCheckStale && noteCheck.remoteExam && (
                    <div className="p-3 bg-error-50 border border-error-200 rounded-lg flex items-start gap-2 text-[12px] text-error-900">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>
                        Приём был дистанционным, а в «Данных обследования» есть находки, которые по видео не получить
                        (пальпация, аускультация и подобное). Проверьте поле: осмотра не было.
                      </span>
                    </div>
                  )}

                  {noteCheck && !isNoteCheckStale && noteCheck.omissions.length > 0 && (
                    <div className="border border-warning-200 rounded-lg bg-warning-50/60 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-warning-900 mb-2">
                        Прозвучало, но в протокол не попало
                      </p>
                      <div className="space-y-2">
                        {noteCheck.omissions.map((o, i) => (
                          <div key={`${o.field}-${i}`} className="bg-white border border-warning-200 border-l-4 border-l-warning-400 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1 text-[10px]">
                              <span className="px-1.5 py-0.5 rounded bg-warning-100 text-warning-900 font-bold uppercase tracking-wide">
                                {OMISSION_LABELS[o.category]}
                              </span>
                              <span className="text-black/40">→ {EHR_FIELD_LABELS[o.field]}</span>
                            </div>
                            <p className="text-[12px] text-black/60 italic leading-snug">«{o.quote}»</p>
                            <p className="text-[12px] text-black/70 mt-1 leading-snug">{o.why}</p>
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              <span className="text-[13px] font-medium text-black">{o.suggestion}</span>
                              <button onClick={() => acceptOmission(o)} className="text-[9px] uppercase font-bold tracking-widest text-primary-700 hover:text-primary-900">
                                Добавить в поле
                              </button>
                              <button onClick={() => dismissOmission(o)} className="text-[9px] uppercase font-bold tracking-widest text-black/40 hover:text-black/70">
                                Скрыть
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {[
                    { label: "Жалобы пациента", key: "complaints", val: ehrNote.complaints },
                    { label: "Анамнез заболевания (Morbi)", key: "anamnesisMorbi", val: ehrNote.anamnesisMorbi },
                    { label: "Анамнез жизни (Vitae)", key: "anamnesisVitae", val: ehrNote.anamnesisVitae },
                    { label: "Аллергологический анамнез", key: "allergies", val: ehrNote.allergies },
                    { label: "Данные обследования", key: "examination", val: ehrNote.examination },
                    { label: "Предварительный диагноз", key: "diagnoses", val: ehrNote.diagnoses, highlight: true },
                    { label: "Лекарственная терапия", key: "medications", val: ehrNote.medications },
                    { label: "План лечения / Рекомендации", key: "plan", val: ehrNote.plan },
                  ].map(({ label, key, val, highlight }) => (
                    <div key={key} className={highlight ? 'col-span-2' : 'col-span-1'}>
                      <div className="flex justify-between items-center mb-2">
                        <label className={`text-[10px] font-bold uppercase tracking-widest ${highlight ? 'text-black' : 'text-black/50'}`}>
                          {label}
                          {highlight && <span className="ml-2 px-2 py-0.5 bg-black text-white text-[8px]">КЛЮЧЕВОЕ</span>}
                          {noteCheck && !isNoteCheckStale && noteCheck.unsupported.includes(key) && (
                            <span
                              className="ml-2 px-2 py-0.5 bg-warning-100 text-warning-900 text-[8px] normal-case tracking-normal font-semibold"
                              title="В стенограмме не нашлось реплики, на которой стоит это поле. Для осмотра это обычно: врач смотрит молча. Для диагноза, препаратов и доз — повод перечитать."
                            >
                              нет опоры в стенограмме
                            </span>
                          )}
                        </label>
                        <button
                          onClick={() => copyField(val, key)}
                          className="text-black/40 hover:text-black transition-colors flex items-center gap-1 text-[9px] uppercase font-bold tracking-widest"
                        >
                          {copiedField === key
                            ? <><CheckCircle size={10} /><span>Скопировано</span></>
                            : <><Copy size={10} /><span>Поле</span></>
                          }
                        </button>
                      </div>
                      <AutoTextarea
                        value={val}
                        onChange={(e) => setEhrNote({ ...ehrNote, [key]: e.target.value })}
                        className={`w-full text-[14px] text-ds-950 font-medium border p-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 leading-relaxed rounded-lg ${
                          highlight ? 'bg-primary-50 border-primary-200' : 'bg-white border-ds-200 shadow-sm'
                        }`}
                      />
                      {noteCheck && !isNoteCheckStale && (noteCheck.sources[key]?.length ?? 0) > 0 && (
                        <details className="mt-1.5">
                          <summary className="cursor-pointer select-none text-[10px] text-primary-700 hover:text-primary-900">
                            Источник в стенограмме · {noteCheck.sources[key].length}
                          </summary>
                          <ul className="mt-1 space-y-1">
                            {noteCheck.sources[key].map((q, i) => (
                              <li key={i} className="text-[12px] text-ds-700 italic leading-snug pl-3 border-l-2 border-primary-200">«{q}»</li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {noteCheck && !isNoteCheckStale && (noteCheck.priorSources?.[key]?.length ?? 0) > 0 && (
                        <details className="mt-1.5">
                          <summary
                            className="cursor-pointer select-none text-[10px] text-warning-800/70 hover:text-warning-900"
                            title="Поле стоит на вставленном контексте «Из МИС», а не на сегодняшнем разговоре."
                          >
                            Из прошлого приёма (МИС) · {noteCheck.priorSources[key].length}
                          </summary>
                          <ul className="mt-1 space-y-1">
                            {noteCheck.priorSources[key].map((q, i) => (
                              <li key={i} className="text-[12px] text-black/60 italic leading-snug pl-3 border-l-2 border-warning-200">«{q}»</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  ))}
                </div>

                {/* ── ПАМЯТКА ПАЦИЕНТУ ─────────────────────────────────────
                    Единственный артефакт, который уходит из-под контроля
                    врача — к пациенту, который исполнит его буквально.
                    Отсюда: собирается только по кнопке, только из
                    утверждённого протокола, редактируется врачом и печатается
                    им же. Автоотправки пациенту здесь нет и быть не должно. */}
                <section className="mt-10 pt-8 border-t border-black/10">
                  <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                    <div>
                      <h2 className="text-[13px] font-bold uppercase tracking-widest text-black">Памятка пациенту</h2>
                      <p className="text-[11px] text-black/50 mt-1">
                        Простым языком, для выдачи на руки. Собирается из протокола выше.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {patientSummary && (
                        <>
                          <button
                            onClick={copyPatientMemo}
                            className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-lg bg-ds-100 border border-ds-200 text-ds-800 hover:bg-ds-200 transition-colors"
                          >
                            {memoCopied ? <Check size={13} className="text-success-600" /> : <Copy size={13} />}
                            {memoCopied ? 'Скопировано' : 'Копировать'}
                          </button>
                          <button
                            onClick={printPatientMemo}
                            className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                          >
                            <Printer size={13} /> Распечатать
                          </button>
                        </>
                      )}
                      <button
                        onClick={buildPatientMemo}
                        disabled={isBuildingMemo}
                        className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                          patientSummary
                            ? 'bg-ds-100 border border-ds-200 text-ds-800 hover:bg-ds-200'
                            : 'bg-primary-600 text-white hover:bg-primary-700'
                        }`}
                      >
                        <Wand2 size={13} />
                        {isBuildingMemo ? 'Собираем…' : patientSummary ? 'Пересобрать' : 'Собрать памятку'}
                      </button>
                    </div>
                  </div>

                  {isMemoStale && (
                    <div className="mb-4 p-3 bg-warning-50 border border-warning-200 rounded-lg flex items-start gap-2.5">
                      <AlertCircle size={15} className="text-warning-600 mt-0.5 shrink-0" />
                      <p className="text-[12px] text-warning-900 leading-snug">
                        Протокол изменился после сборки памятки. Пересоберите её, иначе пациент унесёт устаревшие назначения.
                      </p>
                    </div>
                  )}

                  {memoDoseMismatches.length > 0 && (
                    <div className="mb-4 p-3 bg-error-50 border border-error-300 rounded-lg flex items-start gap-2.5">
                      <AlertCircle size={15} className="text-error-600 mt-0.5 shrink-0" />
                      <div className="text-[12px] text-error-900 leading-snug">
                        <p className="font-bold mb-1">Проверьте числа — их нет в протоколе:</p>
                        <p className="font-data">{memoDoseMismatches.map(m => m.raw).join(' · ')}</p>
                        <p className="mt-1 text-error-800/80">
                          Это может быть безобидное уточнение, а может быть подменённая дозировка. Сверьте с протоколом перед выдачей.
                        </p>
                      </div>
                    </div>
                  )}

                  {!patientSummary && !isBuildingMemo && (
                    <p className="text-[12px] text-black/40 py-6 text-center border border-dashed border-black/10 rounded-lg">
                      Памятка ещё не собрана. Сначала проверьте протокол выше — памятка соберётся из него.
                    </p>
                  )}

                  {patientSummary && (
                    <div className="space-y-4">
                      {MEMO_SECTIONS.map(({ key, label }) => {
                        const isFlags = key === 'redFlags';
                        const needsDoctor = key === 'condition' && !patientSummary.condition.trim()
                          && needsDoctorWrittenCondition(ehrNote.diagnoses, doctor.specialty.id);
                        return (
                          <div key={key}>
                            <label className={`text-[10px] font-bold uppercase tracking-widest ${isFlags ? 'text-error-700' : 'text-black/50'}`}>
                              {label}
                              {isFlags && <span className="ml-2 font-normal tracking-normal normal-case text-black/40">из справочника, не от ИИ</span>}
                            </label>
                            {needsDoctor && (
                              <p className="mt-1 mb-1.5 text-[11px] text-warning-800 bg-warning-50 border border-warning-200 rounded px-2 py-1.5 leading-snug">
                                Диагноз этой группы ИИ не формулирует — напишите сами, в той форме, в какой считаете нужным сообщить пациенту.
                              </p>
                            )}
                            <textarea
                              value={patientSummary[key]}
                              onChange={(e) => setPatientSummary({ ...patientSummary, [key]: e.target.value })}
                              rows={isFlags ? 6 : 3}
                              placeholder={needsDoctor ? 'Формулировка врача…' : 'Пусто — в протоколе нет данных для этого раздела'}
                              className={`mt-1.5 w-full text-[13px] text-black leading-relaxed border p-3 rounded-lg focus:outline-none focus:border-black ${
                                isFlags ? 'bg-error-50/40 border-error-200' : 'bg-white border-black/10 shadow-sm'
                              }`}
                            />
                          </div>
                        );
                      })}

                      <p className="text-[11px] text-black/40 leading-snug pt-1">
                        Проверьте текст перед выдачей: пациент исполнит его буквально. Памятка не заменяет
                        разговор с пациентом и не является медицинским заключением.
                      </p>
                    </div>
                  )}
                </section>

                {/* Печатная версия — только для принтера (см. @media print в
                    index.css). На экране не показывается никогда. */}
                {patientSummary && !isMemoBlank(patientSummary) && (
                  <div id="patient-memo-print" aria-hidden="true">
                    <h1>Памятка пациенту</h1>
                    {MEMO_SECTIONS.filter(({ key }) => patientSummary[key]?.trim()).map(({ key, label }) => (
                      <section key={key}>
                        <h2>{label}</h2>
                        <p>{patientSummary[key]}</p>
                      </section>
                    ))}
                    <footer>
                      <p>{doctor.name}, {doctor.specialty.name} · {new Date().toLocaleDateString('ru-RU')}</p>
                      <p>Памятка для пациента. Не является медицинским заключением — оригинал протокола в медицинской карте.</p>
                    </footer>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      ) : (
        /* CONSULTATION VIEW — responsive grid.
           - On <lg (<1024px): stacked single column, switched via bottom tabs
             (checklist is one of the tabs)
           - On lg–xl (1024–1535px, includes 13"/14" MacBooks): 4 columns —
             checklist is a permanent column on the right (narrower widths so it
             fits); the doctor always sees coverage at a glance
           - On 2xl (≥1536px, large external monitors / iMacs): 4 columns, roomier
           - minmax(0,1fr) on the transcript column is CRITICAL — without it,
             long unbroken words push the column wider than 1fr */
        <main className="flex-grow flex flex-col min-h-0 p-3 pb-36 lg:pb-3 overflow-y-auto lg:overflow-hidden">
          {/* Desktop/планшет (lg+): настраиваемое рабочее поле — drag/resize
              блоков, хранится в layoutBlocks (см. fetchWorkspaceLayout /
              persistWorkspaceLayout выше). */}
          <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-h-0">
            {workspaceEditMode && (
              <WorkspaceToolbar
                blocks={layoutBlocks}
                onToggleVisibility={handleToggleBlockVisibility}
                onAddWidget={() => { setEditingWidgetId(null); setShowWidgetModal(true); }}
                onReset={handleWorkspaceToolbarReset}
                onSave={handleWorkspaceToolbarSave}
                onExit={handleWorkspaceToolbarExit}
                saving={savingLayout}
              />
            )}
            {/* Плитки перетаскивают и вне режима редактирования, поэтому
                сообщение стоит над сеткой, а не в панели редактирования. */}
            {layoutSaveError && (
              <div className="flex items-start gap-1.5 mb-2 px-2.5 py-1.5 rounded-lg bg-warning-50 border border-warning-300 text-warning-900 bl-label">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                <span className="flex-1">{layoutSaveError} Расположение плиток вернётся к прежнему после перезагрузки страницы.</span>
                <button onClick={() => setLayoutSaveError(null)} className="flex-shrink-0 text-warning-700 hover:text-warning-900">
                  <X size={13} />
                </button>
              </div>
            )}
            <div className="flex-1 min-h-0">
              <WorkspaceGrid
                blocks={layoutBlocks}
                editMode={workspaceEditMode}
                onLayoutChange={handleGridLayoutChange}
                onDeleteBlock={handleDeleteBlock}
                renderContent={renderWorkspaceBlockContent}
              />
            </div>
          </div>

          {/* Мобиле (<lg): прежняя фиксированная раскладка по табам —
              настраиваемое поле здесь недоступно (ненадёжный тач-драг), тот
              же набор 4 базовых блоков, что и раньше, без кастомных виджетов. */}
          <div className="flex flex-col gap-3 lg:hidden flex-1 min-h-0">
            <div className={`flex-col min-h-[280px] ${mobileTab === 'insights' ? 'flex flex-1' : 'hidden'}`}>
              <InsightsBlock hints={hints} isGeneratingHints={isGeneratingHints} hasTranscript={transcript.length > 0} onRefresh={requestHints} />
            </div>
            <div className={`flex-col min-h-[280px] ${mobileTab === 'pharma' ? 'flex flex-1' : 'hidden'}`}>
              <PharmaBlock pharmaHints={pharmaHints} isGeneratingHints={isGeneratingHints} />
            </div>
            <div className={`flex-col min-h-[320px] ${mobileTab === 'transcript' ? 'flex flex-1' : 'hidden'}`}>
              <TranscriptBlock
                specialtyId={doctor.specialty.id}
                consultationType={consultationType}
                transcript={transcript}
                onOpenChecklistModal={() => setShowChecklistModal(true)}
                isRecording={isRecording}
                stenographerMode={stenographerMode}
                bufferedRef={bufferedRef}
                bufferedElapsedMs={bufferedElapsedMs}
                bufferedLevel={bufferedLevel}
                bufferedSegments={bufferedSegments}
                stopBufferedAndTranscribe={stopBufferedAndTranscribe}
                transcriptionProgress={transcriptionProgress}
                isDiarizing={isDiarizing}
                isRefiningTranscript={isRefiningTranscript}
                transcribingError={transcribingError}
                bufferedSessionId={bufferedSessionId}
                retryTranscription={retryTranscription}
                currentSpeech={currentSpeech}
                transcriptEndRef={transcriptEndRef}
                manualInput={manualInput}
                onManualInputChange={setManualInput}
                onManualSubmit={handleManualSubmit}
              />
            </div>
            <div className={`flex-col min-h-[280px] ${mobileTab === 'checklist' ? 'flex flex-1' : 'hidden'}`}>
              <ChecklistBlock transcript={transcript} type={consultationType} specialtyId={doctor.specialty.id} />
            </div>
          </div>
        </main>
      )}

      {showWidgetModal && (
        <WorkspaceWidgetModal
          initial={editingWidgetId ? layoutBlocks.find(b => b.id === editingWidgetId)?.customConfig : undefined}
          onSave={handleSaveWidget}
          onClose={() => { setShowWidgetModal(false); setEditingWidgetId(null); }}
        />
      )}

      {/* BOTTOM ACTION BAR (desktop only) */}
        <footer className="hidden md:flex h-[64px] bg-white border-t border-ds-200 items-center justify-between px-6 flex-shrink-0 z-10 w-full shadow-[0_-1px_8px_rgba(28,25,23,0.04)]">
          {viewMode === 'protocol' ? (
            <>
              <div className="flex gap-3">
                <button
                  onClick={handleTransferToMIS}
                  disabled={!ehrNote || isGeneratingEHR}
                  className="px-6 py-2.5 font-semibold text-[13px] bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 transition-colors flex items-center gap-2"
                >
                  <Copy size={14} /> Скопировать в МИС
                </button>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest">
                {draftSaved ? (
                  <span className="flex items-center gap-1.5 text-success-700 bg-success-50 border border-success-200 px-3 py-1 rounded-full">
                    <CheckCircle size={12} /> Сохранено в историю
                  </span>
                ) : (
                  <span className={draftEditState === 'error' ? 'text-error-600' : draftEditState === 'saved' ? 'text-success-700' : 'text-ds-600'}>
                    {draftEditState === 'saving' ? 'Сохраняю правки…'
                      : draftEditState === 'saved' ? 'Правки сохранены в историю'
                      : draftEditState === 'error' ? 'Правки не сохранились — проверьте связь'
                      : 'Черновик'}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-3">
                <button
                  onClick={completeConsultation}
                  disabled={transcript.length === 0 || isGeneratingEHR}
                  className="px-6 py-2.5 font-semibold text-[13px] bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 transition-colors"
                >
                  {isGeneratingEHR ? "Формирование..." : "Завершить и сформировать протокол"}
                </button>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest">
                {draftSaved ? (
                  <span className="flex items-center gap-1.5 text-success-700 bg-success-50 border border-success-200 px-3 py-1 rounded-full">
                    <CheckCircle size={12} /> Сохранено в историю
                  </span>
                ) : (
                  <span className="text-ds-600">Протокол — после завершения записи</span>
                )}
              </div>
            </>
          )}
        </footer>

      {/* Checklist modal — opened from the mobile (<lg) chip in the transcript
          header, where the checklist isn't shown as a column */}
      {showChecklistModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowChecklistModal(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-ds-200">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-success-600" />
                <h2 className="font-semibold text-[14px] text-ds-900">
                  Стандарт {consultationType === 'primary' ? 'первичного' : 'повторного'} приёма
                </h2>
              </div>
              <button
                onClick={() => setShowChecklistModal(false)}
                className="p-1 rounded-md hover:bg-ds-100 text-ds-600"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ChecklistPanel transcript={transcript} type={consultationType} specialtyId={doctor.specialty.id} />
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────── Settings modal ───────────────────────── */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-ds-200">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-primary-600" />
                <h2 className="font-semibold text-[15px] text-ds-900">Настройки</h2>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 rounded-md hover:bg-ds-100 text-ds-600"
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Stenographer mode toggle */}
              <section>
                <div className="text-[12px] font-semibold text-ds-600 uppercase tracking-wide mb-2">
                  Режим работы
                </div>
                <button
                  onClick={() => setStenographerMode(!stenographerMode)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    stenographerMode
                      ? 'border-primary-500 bg-primary-50/40'
                      : 'border-ds-200 hover:border-ds-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-6 rounded-full flex-shrink-0 transition-colors relative ${
                      stenographerMode ? 'bg-primary-600' : 'bg-ds-300'
                    }`}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                        stenographerMode ? 'translate-x-[18px]' : 'translate-x-0.5'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px] text-ds-900">Режим стенографа</div>
                      <div className="text-[11px] text-ds-600 mt-0.5">
                        Только для очного приёма: звук пишется целиком и расшифровывается после завершения — точнее, но без текста и подсказок во время приёма. Для записи звонка не применяется.
                      </div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setCommunicationReview(!communicationReview)}
                  className={`mt-2 w-full text-left p-3 rounded-lg border transition-all ${
                    communicationReview
                      ? 'border-primary-500 bg-primary-50/40'
                      : 'border-ds-200 hover:border-ds-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-6 rounded-full flex-shrink-0 transition-colors relative ${
                      communicationReview ? 'bg-primary-600' : 'bg-ds-300'
                    }`}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                        communicationReview ? 'translate-x-[18px]' : 'translate-x-0.5'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px] text-ds-900">Разбор общения после приёма</div>
                      <div className="text-[11px] text-ds-600 mt-0.5">
                        Где ту же мысль можно сказать иначе. Появится в истории приёма, во время приёма не показывается.
                      </div>
                    </div>
                  </div>
                </button>
              </section>
            </div>

            <div className="px-5 py-3 border-t border-ds-200 flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-primary-600 text-white text-[13px] font-semibold rounded-lg hover:bg-primary-700 transition-colors"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAV — action bar + tabs (только для врача) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-ds-200 shadow-[0_-2px_12px_rgba(28,25,23,0.06)]">
          {/* Action row — контекстная кнопка действия */}
          <div className="px-3 pt-2 pb-1.5">
            {viewMode === 'protocol' ? (
              <button
                onClick={handleTransferToMIS}
                disabled={!ehrNote || isGeneratingEHR}
                className="w-full h-11 rounded-lg bg-primary-600 text-white text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.99]"
              >
                <Copy size={14} /> Скопировать в МИС
              </button>
            ) : isRecording ? (
              <button
                onClick={() => toggleRecording()}
                className="w-full h-11 rounded-lg bg-error-500 text-white text-[14px] font-semibold flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] animate-pulse"
              >
                <Square size={14} fill="white" /> Завершить запись
              </button>
            ) : transcript.length > 0 ? (
              <button
                onClick={completeConsultation}
                disabled={isGeneratingEHR}
                className="w-full h-11 rounded-lg bg-primary-600 text-white text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.99]"
              >
                <CheckCircle size={14} />
                {isGeneratingEHR ? 'Формирование…' : 'Сформировать протокол'}
              </button>
            ) : (
              <button
                onClick={() => toggleRecording()}
                disabled={startBlocked}
                className="w-full h-11 rounded-lg bg-primary-600 text-white text-[14px] font-semibold flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] disabled:opacity-40"
              >
                <Mic size={16} /> Начать приём
              </button>
            )}
          </div>

          {/* Tab bar — переключение секций (виден только в режиме consultation) */}
          {viewMode === 'consultation' && (
            <div className="grid grid-cols-4 border-t border-ds-150">
              {[
                { id: 'transcript' as const, label: 'Стенограмма', icon: <FileText size={18} /> },
                { id: 'insights' as const,   label: 'Инсайты',     icon: <Activity size={18} />, count: hints.length },
                { id: 'pharma' as const,     label: 'Фарма',       icon: <AlertCircle size={18} />, count: pharmaHints.length },
                { id: 'checklist' as const,  label: 'Стандарт',    icon: <CheckCircle size={18} /> },
              ].map(tab => {
                const active = mobileTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setMobileTab(tab.id)}
                    className={`relative flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                      active ? 'text-primary-600' : 'text-ds-600 hover:text-ds-950'
                    }`}
                  >
                    <div className="relative">
                      {tab.icon}
                      {typeof tab.count === 'number' && tab.count > 0 && (
                        <span className={`absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                          tab.id === 'pharma' ? 'bg-error-500 text-white' : 'bg-primary-600 text-white'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-medium leading-none">{tab.label}</span>
                    {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-primary-600 rounded-b" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* safe-area bottom (iOS notch) */}
          <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        </div>
    </div>
  );
}
