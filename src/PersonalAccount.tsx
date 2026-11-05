import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User, ArrowLeft, Activity, X, Key, Save, Filter, Calendar, Trash2, Shield, Sparkles, Copy, CheckCircle, MessageCircleHeart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MEDICAL_SPECIALTIES } from './config/specialties';
import CommunicationNotes, { COMMUNICATION_REVIEW_KEY } from './components/CommunicationNotes';
import { requestCommunicationReview } from './services/ai';
import { BrandLockup } from './components/BrandMark';
import { saveSession, logout, getStoredSession } from './services/auth';
import { ehrToMisText } from './utils/ehrText';
import { hasProtocolContent, draftTitle, DRAFT_PLACEHOLDER } from './utils/draftProtocol';
import LlmSettingsCard from './components/LlmSettingsCard';
import SttSettingsCard from './components/SttSettingsCard';

export default function PersonalAccount() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'ai' | 'history'>(() => {
    const t = searchParams.get('tab');
    return t === 'ai' || t === 'security' || t === 'history' ? t : 'general';
  });
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<any | null>(null);

  // Security States
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  const [show2FAModal, setShow2FAModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  // Пароль при включении 2FA: и секрет, и код задаёт вызывающий, поэтому без
  // пароля обладатель угнанного токена привязывал свой аутентификатор.
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [show2FADisableModal, setShow2FADisableModal] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  // Сервер с ENABLE_2FA!=='true' не даёт включать 2FA; отключить уже включённую можно всегда.
  const [twoFactorAvailable, setTwoFactorAvailable] = useState(false);

  // AI Settings States
  const [stenographerMode, setStenographerMode] = useState<boolean>(false);
  const [communicationReview, setCommunicationReview] = useState<boolean>(false);

  const authData = getStoredSession();
  const token = authData?.token;
  const doctor = authData?.doctor;

  // Profile Edit
  const [profileName, setProfileName] = useState(doctor?.name || '');
  const [profileSpecialty, setProfileSpecialty] = useState(doctor?.specialtyId || 'therapist');
  const [profileSaving, setProfileSaving] = useState(false);

  // ── Личный шаблон протокола ─────────────────────────────────────────────
  // Хранится на сервере (doctors.protocol_template), сервер сам подставляет
  // его в analyze. Здесь — только редактор. Значение из сессии может быть
  // старым (сессия выдана до появления поля), поэтому при открытии
  // перечитываем профиль.
  const [protocolTemplate, setProtocolTemplate] = useState<string>(doctor?.protocolTemplate ?? '');
  const [protocolTemplateSavedValue, setProtocolTemplateSavedValue] = useState<string>(doctor?.protocolTemplate ?? '');
  const [protocolTemplateSaving, setProtocolTemplateSaving] = useState(false);
  const [protocolTemplateError, setProtocolTemplateError] = useState<string | null>(null);
  const PROTOCOL_TEMPLATE_MAX = 4000;

  useEffect(() => {
    if (!token) return;
    fetch('/api/auth/profile', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data?.doctor) return;
        setProtocolTemplate(data.doctor.protocolTemplate ?? '');
        setProtocolTemplateSavedValue(data.doctor.protocolTemplate ?? '');
        localStorage.setItem('medscribe_session', JSON.stringify({ ...authData, doctor: data.doctor }));
      })
      .catch(() => { /* останется значение из сессии */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProtocolTemplate = async () => {
    setProtocolTemplateSaving(true);
    setProtocolTemplateError(null);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ protocolTemplate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setProtocolTemplateError(data.error || `Не сохранилось (HTTP ${res.status})`); return; }
      setProtocolTemplateSavedValue(data.doctor?.protocolTemplate ?? protocolTemplate.trim());
      setProtocolTemplate(data.doctor?.protocolTemplate ?? protocolTemplate.trim());
      localStorage.setItem('medscribe_session', JSON.stringify({ ...authData, doctor: data.doctor }));
    } catch {
      setProtocolTemplateError('Нет связи с сервером');
    } finally {
      setProtocolTemplateSaving(false);
    }
  };
  const protocolTemplateDirty = protocolTemplate.trim() !== protocolTemplateSavedValue.trim();

  // Filters
  const [filterQuery, setFilterQuery] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    setIs2FAEnabled(doctor?.isTwoFactorEnabled || false);
    setProfileName(doctor?.name || '');
    setProfileSpecialty(doctor?.specialtyId || 'therapist');
    fetchDrafts();

    // Load STT preferences (shared with Dashboard quick-settings modal via same keys)
    try {
      setStenographerMode(localStorage.getItem('medscribe_stenographer_mode') === 'true');
      setCommunicationReview(localStorage.getItem(COMMUNICATION_REVIEW_KEY) === 'true');
    } catch {}
  }, [token, navigate, doctor?.isTwoFactorEnabled, doctor?.id]);

  useEffect(() => {
    fetch('/api/auth/config')
      .then(r => r.ok ? r.json() : null)
      .then(c => setTwoFactorAvailable(!!c?.twoFactor))
      .catch(() => setTwoFactorAvailable(false));
  }, []);

  // Новая пара токенов (смена пароля, 2FA) — сохраняем целиком с актуальным врачом.
  // Без токенов в ответе — только обновляем врача в сохранённой сессии.
  const storeSession = (data: any, newDoctor: any) => {
    if (data?.token && data?.expiresInSeconds) {
      saveSession({
        token: data.token,
        expiresInSeconds: data.expiresInSeconds,
        refreshToken: data.refreshToken,
        refreshExpiresInSeconds: data.refreshExpiresInSeconds,
        doctor: newDoctor,
      });
    } else {
      try {
        const cur = getStoredSession() || {};
        localStorage.setItem('medscribe_session', JSON.stringify({ ...cur, doctor: newDoctor }));
      } catch {}
    }
  };

  const handleUpdateProfile = async () => {
    setProfileSaving(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: profileName, specialtyId: profileSpecialty })
      });
      if (res.ok) {
        const data = await res.json();
        const newData = { ...authData, doctor: data.doctor };
        localStorage.setItem('medscribe_session', JSON.stringify(newData));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "Ошибка при сохранении профиля");
      }
    } catch (e) {
       alert("Ошибка сети");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleDeleteDraft = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Вы уверены, что хотите удалить этот черновик?")) return;
    try {
      const res = await fetch(`/api/drafts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setDrafts(prev => prev.filter(d => d.id !== id));
      }
    } catch (err) { alert("Ошибка сети"); }
  };

  const handleGenerate2FA = async () => {
    try {
      const res = await fetch('/api/auth/2fa/generate', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        setQrCodeUrl(data.qrCodeUrl);
        setTwoFactorSecret(data.secret);
        setShow2FAModal(true);
      }
    } catch (e) { alert("Ошибка сети"); }
  };

  const handleEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ secret: twoFactorSecret, token: twoFactorCode, password: twoFactorPassword })
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setIs2FAEnabled(true);
        storeSession(data, { ...doctor, isTwoFactorEnabled: true });
        setShow2FAModal(false);
        setTwoFactorPassword('');
        setTwoFactorCode('');
      } else {
        // Показываем причину с сервера: «неверный код» и «неверный пароль» —
        // разные ошибки, и одинаковый текст на обе заставляет гадать.
        const data = await res.json().catch(() => ({}));
        alert(data?.error || 'Не удалось включить 2FA');
      }
    } catch (e) { alert("Ошибка сети"); }
  };

  // Отключение 2FA: сервер требует и код из аутентификатора, и текущий пароль.
  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ token: twoFactorCode, password: twoFactorPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setIs2FAEnabled(false);
        storeSession(data, { ...doctor, isTwoFactorEnabled: false });
        setShow2FADisableModal(false);
        setTwoFactorPassword('');
        setTwoFactorCode('');
      } else {
        alert(data?.error || 'Не удалось отключить 2FA');
      }
    } catch (e) { alert("Ошибка сети"); }
  };

  const fetchDrafts = async () => {
    try {
      const res = await fetch('/api/drafts', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setDrafts(data.drafts || []);
      }
    } finally { setLoading(false); }
  };

  const [generatingProtocolFor, setGeneratingProtocolFor] = useState<string | null>(null);
  const [reviewingCommunicationFor, setReviewingCommunicationFor] = useState<string | null>(null);
  const [communicationReviewError, setCommunicationReviewError] = useState<string | null>(null);

  // Разбор общения по кнопке — для приёмов, где автоматического разбора не
  // было: галочка была выключена или разбор тогда не получился.
  const handleReviewCommunication = async (draftId: string, content: any) => {
    if (!content?.transcript) return;
    setReviewingCommunicationFor(draftId);
    setCommunicationReviewError(null);
    try {
      const specialtyName = MEDICAL_SPECIALTIES[doctor?.specialtyId]?.name || 'Терапевт';
      const result = await requestCommunicationReview(content.transcript, specialtyName);
      if (result.error) { setCommunicationReviewError(result.error); return; }
      const newContent = { ...content, communicationReview: { notes: result.data, createdAt: new Date().toISOString() } };
      const res = await fetch(`/api/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content: newContent })
      });
      if (!res.ok) { setCommunicationReviewError(`Разбор не сохранился (HTTP ${res.status})`); return; }
      setDrafts(prev => prev.map(d => d.id === draftId ? { ...d, content: newContent } : d));
      setSelectedDraft((prev: any) => prev?.id === draftId ? { ...prev, parsed: newContent } : prev);
    } catch {
      setCommunicationReviewError('Нет связи с сервером');
    } finally {
      setReviewingCommunicationFor(null);
    }
  };
  const [copiedDraftField, setCopiedDraftField] = useState<string | null>(null);

  const parseContent = (contentRaw: any) => {
    if (typeof contentRaw === 'object') return contentRaw;
    try { return JSON.parse(contentRaw); } catch { return null; }
  };

  const hasProtocol = (content: any) => hasProtocolContent(content);

  const handleGenerateProtocol = async (draft: any) => {
    const content = parseContent(draft.content);
    if (!content?.transcript) {
      alert("Нет стенограммы для анализа");
      return;
    }
    setGeneratingProtocolFor(draft.id);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          transcript: content.transcript,
          specialty: doctor?.specialtyId || 'therapist',
          patientContext: 'Данные пациента хранятся в МИС',
          guideline: 'international'
        })
      });
      const data = await res.json();
      if (data.result?.ehr) {
        const newContent = { ...content, ...data.result.ehr };
        await fetch(`/api/drafts/${draft.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ content: newContent })
        });
        // Update local state
        setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, content: newContent } : d));
        if (selectedDraft?.id === draft.id) {
          setSelectedDraft((prev: any) => ({ ...prev, parsed: newContent }));
        }
      } else {
        alert("Не удалось сформировать протокол. Попробуйте ещё раз.");
      }
    } catch (e) {
      alert("Ошибка сети");
    } finally {
      setGeneratingProtocolFor(null);
    }
  };

  const copyDraftToClipboard = (content: any) => {
    const text = ehrToMisText(content);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedDraftField('all');
      setTimeout(() => setCopiedDraftField(null), 2000);
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        storeSession(data, doctor);
        setPwdSuccess('Пароль успешно изменен');
        setTimeout(() => setShowPasswordModal(false), 2000);
      } else {
        setPwdError(data.error || 'Ошибка');
      }
    } catch (e) { setPwdError('Ошибка сети'); }
  };

  const tabRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = tabRowRef.current;
    if (!row || row.scrollWidth <= row.clientWidth) return;
    const btn = row.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`);
    if (!btn) return;
    const rb = row.getBoundingClientRect();
    const bb = btn.getBoundingClientRect();
    if (bb.left < rb.left) row.scrollTo({ left: row.scrollLeft + bb.left - rb.left });
    else if (bb.right > rb.right) row.scrollTo({ left: row.scrollLeft + bb.right - rb.right });
  }, [activeTab]);

  const sidebarItems = [
    { id: 'general', label: 'Общие', icon: <User size={18} /> },
    { id: 'ai', label: 'Настройки ИИ', icon: <Activity size={18} /> },
    { id: 'security', label: 'Безопасность', icon: <Shield size={18} /> },
    { id: 'history', label: 'История', icon: <Calendar size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-ds-50 text-ds-950 font-sans flex flex-col">
      {/* Header */}
      <header className="h-[64px] px-4 md:px-8 flex items-center justify-between bg-white border-b border-ds-200 shrink-0 z-50 shadow-sm">
        <div className="cursor-pointer" onClick={() => navigate('/app')}>
          <BrandLockup size={22} />
        </div>
        <button
          onClick={() => navigate('/app')}
          className="text-[13px] font-medium text-ds-600 hover:text-primary-900 transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={14} /> Назад к приёму
        </button>
      </header>

      <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden">
        {/* Sidebar */}
        <aside className="w-full md:w-[260px] bg-white border-b md:border-b-0 md:border-r border-ds-200 p-3 md:p-5 flex flex-col gap-1.5 shrink-0">
          <div className="mb-3 md:mb-7 px-3 pt-2">
             <div className="text-[10px] font-semibold uppercase tracking-widest text-ds-600 mb-1">Врач</div>
             <div className="text-[16px] font-bold text-primary-900 tracking-tight truncate">{doctor?.name}</div>
          </div>
          <div ref={tabRowRef} className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible">
          {sidebarItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              data-tab={item.id}
              className={`flex items-center gap-2 md:gap-3 px-3 md:px-3.5 py-2.5 text-[13px] font-semibold rounded-lg transition-all shrink-0 whitespace-nowrap ${
                activeTab === item.id
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-ds-700 hover:bg-ds-100'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          </div>
          <div className="mt-2 md:mt-auto pt-2 md:pt-5 border-t border-ds-200">
             <button onClick={() => { logout().finally(() => navigate('/')); }} className="w-full text-left px-3.5 py-2 text-[13px] text-error-600 font-medium rounded-lg hover:bg-error-50 transition-colors">Выйти из системы</button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0 md:overflow-y-auto p-4 md:p-10">
          <div className="max-w-[760px]">
            {activeTab === 'general' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-[22px] md:text-[28px] font-bold text-primary-900 tracking-tight mb-1">Общие настройки</h1>
                <p className="text-ds-600 text-[14px] mb-8">Персональная информация и специализация</p>

                <div className="bg-white border border-ds-200 p-5 md:p-8 rounded-xl shadow-sm space-y-7">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-ds-600 mb-2">ФИО специалиста</label>
                        <input
                          value={profileName}
                          onChange={e => setProfileName(e.target.value)}
                          className="w-full h-11 px-4 border border-ds-400 rounded-lg text-[15px] text-ds-950 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wide text-ds-600 mb-2">Специализация</label>
                        <select
                          value={profileSpecialty}
                          onChange={e => setProfileSpecialty(e.target.value)}
                          className="w-full h-11 px-4 border border-ds-400 rounded-lg text-[15px] text-ds-950 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all bg-white appearance-none"
                        >
                          {Object.values(MEDICAL_SPECIALTIES).map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                   </div>
                   <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-ds-600 mb-2">Email</label>
                      <div className="text-[14px] font-mono text-ds-600 bg-ds-50 border border-ds-200 rounded-lg px-4 py-3 break-all">{doctor?.email || '—'}</div>
                   </div>
                   <div className="pt-5 border-t border-ds-200 flex justify-between items-center">
                      <div />
                      <button
                        onClick={handleUpdateProfile}
                        disabled={profileSaving}
                        className="bg-primary-600 text-white px-6 py-2.5 text-[13px] font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-all flex items-center gap-2"
                      >
                        {profileSaving ? 'Сохранение...' : <><Save size={14}/> Сохранить</>}
                      </button>
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'ai' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-[22px] md:text-[28px] font-bold text-primary-900 tracking-tight mb-1">Настройки ИИ</h1>
                <p className="text-ds-600 text-[14px] mb-8">Конфигурация ассистента и модели</p>

                <div className="space-y-5">
                   <LlmSettingsCard />

                   {/* ── Личный шаблон протокола ───────────────────────────
                       Единственная настройка, которая меняет сам протокол, а
                       не подсказки вокруг него. Свободный текст: врач пишет,
                       как выглядит ЕГО протокол. Сервер подставляет это в
                       промпт как данные и требует брать из шаблона форму, а
                       не факты. */}
                   <div className="bg-white border border-ds-200 p-5 md:p-7 rounded-xl shadow-sm">
                      <h4 className="text-[14px] font-semibold text-ds-900 mb-1">Личный шаблон протокола</h4>
                      <p className="text-[12px] text-ds-600 mb-5 pb-4 border-b border-ds-200">
                        Как должен выглядеть ваш протокол: порядок и обороты внутри полей, сокращения, чего не писать.
                        Шаблон задаёт форму, факты берутся только из разговора. Действует на каждый новый протокол.
                      </p>
                      <textarea
                        value={protocolTemplate}
                        onChange={e => setProtocolTemplate(e.target.value.slice(0, PROTOCOL_TEMPLATE_MAX))}
                        rows={9}
                        spellCheck={false}
                        placeholder={`Например:
Жалобы: коротко, через запятую, без «пациент жалуется на».
Анамнез заболевания: хронологически, начиная с давности; сроки — как назвал пациент.
Осмотр: сначала общее состояние, затем по системам; что не оценивалось — так и писать.
Диагноз: основной с кодом МКБ-10, затем сопутствующие с новой строки.
План: нумерованным списком; контроль — отдельным последним пунктом.
Стиль: без вводных слов, допустимы сокращения АД, ЧСС, ОАК.`}
                        className="w-full text-[13px] leading-relaxed text-ds-900 border border-ds-200 rounded-lg p-4 focus:outline-none focus:border-primary-500 font-mono"
                      />
                      <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                        <span className="text-[11px] text-ds-500">
                          {protocolTemplate.length} / {PROTOCOL_TEMPLATE_MAX}
                          {protocolTemplateSavedValue.trim() ? ' · шаблон действует' : ' · шаблон не задан, протокол собирается по умолчанию'}
                        </span>
                        <div className="flex items-center gap-2">
                          {protocolTemplateSavedValue.trim() && (
                            <button
                              onClick={() => setProtocolTemplate('')}
                              disabled={protocolTemplateSaving}
                              className="px-4 py-2 text-[12px] font-medium border border-ds-200 text-ds-700 rounded-lg hover:bg-ds-100 disabled:opacity-50"
                            >
                              Очистить
                            </button>
                          )}
                          <button
                            onClick={saveProtocolTemplate}
                            disabled={protocolTemplateSaving || !protocolTemplateDirty}
                            className="px-4 py-2 text-[12px] font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
                          >
                            <Save size={13} /> {protocolTemplateSaving ? 'Сохраняю…' : protocolTemplateDirty ? 'Сохранить' : 'Сохранено'}
                          </button>
                        </div>
                      </div>
                      {protocolTemplateError && (
                        <p className="mt-2 text-[12px] text-error-700">{protocolTemplateError}</p>
                      )}
                   </div>

                   {/* ── Voice (STT) ───────────────────────────────────── */}
                   <SttSettingsCard />

                   {/* ── Stenographer toggle ──────────────────────────── */}
                   <div className="bg-white border border-ds-200 p-5 md:p-7 rounded-xl shadow-sm">
                      <h4 className="text-[14px] font-semibold text-ds-900 mb-1">Режим работы</h4>
                      <p className="text-[12px] text-ds-600 mb-5 pb-4 border-b border-ds-200">Управление автоматическими подсказками во время приёма</p>
                      <button
                        onClick={() => {
                          const next = !stenographerMode;
                          setStenographerMode(next);
                          try { localStorage.setItem('medscribe_stenographer_mode', String(next)); } catch {}
                        }}
                        className={`w-full p-4 border rounded-xl transition-all text-left flex items-start gap-4 ${stenographerMode ? 'border-primary-500 ring-2 ring-primary-500 bg-primary-50' : 'border-ds-200 hover:border-primary-200'}`}
                      >
                        <div className={`w-11 h-6 rounded-full flex-shrink-0 transition-colors relative mt-0.5 ${stenographerMode ? 'bg-primary-600' : 'bg-ds-300'}`}>
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${stenographerMode ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-[14px] text-ds-900 mb-1">Режим стенографа</div>
                          <div className="text-[12px] text-ds-600">Только для очного приёма: звук пишется целиком и расшифровывается после завершения — точнее, но без текста и подсказок во время приёма. Для записи звонка не применяется.</div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          const next = !communicationReview;
                          setCommunicationReview(next);
                          try { localStorage.setItem(COMMUNICATION_REVIEW_KEY, String(next)); } catch {}
                        }}
                        className={`mt-3 w-full p-4 border rounded-xl transition-all text-left flex items-start gap-4 ${communicationReview ? 'border-primary-500 ring-2 ring-primary-500 bg-primary-50' : 'border-ds-200 hover:border-primary-200'}`}
                      >
                        <div className={`w-11 h-6 rounded-full flex-shrink-0 transition-colors relative mt-0.5 ${communicationReview ? 'bg-primary-600' : 'bg-ds-300'}`}>
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${communicationReview ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-[14px] text-ds-900 mb-1">Разбор общения после приёма</div>
                          <div className="text-[12px] text-ds-600">Места, где ту же мысль можно было сказать иначе, и что осталось непроговорённым — с цитатой и протоколом общения (SPIKES, NURSE, teach-back). Без баллов и оценок. Разбор появляется в истории приёма; во время приёма на экран ничего не выводится.</div>
                        </div>
                      </button>
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'security' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-[22px] md:text-[28px] font-bold text-primary-900 tracking-tight mb-1">Безопасность</h1>
                <p className="text-ds-600 text-[14px] mb-8">Защита аккаунта и врачебной тайны</p>

                <div className="grid grid-cols-1 gap-4">
                   {(twoFactorAvailable || is2FAEnabled) && (
                   <div className="bg-white border border-ds-200 p-5 md:p-6 rounded-xl shadow-sm flex flex-col items-start gap-4 md:gap-0 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2.5 font-semibold text-[15px] text-ds-900 mb-1">
                           <Shield size={18} className={is2FAEnabled ? "text-success-600" : "text-ds-400"} />
                           Двухфакторная аутентификация (2FA)
                        </div>
                        <p className="text-[13px] text-ds-600 max-w-[400px]">
                          {!twoFactorAvailable && is2FAEnabled
                            ? '2FA отключена в настройках сервера; её можно выключить для аккаунта.'
                            : 'Дополнительный слой защиты с Google Authenticator или аналогами.'}
                        </p>
                      </div>
                      <button
                        onClick={is2FAEnabled ? () => { setTwoFactorCode(''); setTwoFactorPassword(''); setShow2FADisableModal(true); } : handleGenerate2FA}
                        className={`px-5 py-2.5 text-[13px] font-semibold rounded-lg border transition-all ${is2FAEnabled ? 'bg-error-50 text-error-700 border-error-200 hover:bg-error-100' : 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700'}`}
                      >
                         {is2FAEnabled ? 'Отключить' : 'Включить'}
                      </button>
                   </div>
                   )}

                   <div className="bg-white border border-ds-200 p-5 md:p-6 rounded-xl shadow-sm flex flex-col items-start gap-4 md:gap-0 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2.5 font-semibold text-[15px] text-ds-900 mb-1">
                           <Key size={18} className="text-ds-400" />
                           Смена пароля
                        </div>
                        <p className="text-[13px] text-ds-600 max-w-[400px]">Используйте длинный пароль, которого нет на других сайтах.</p>
                      </div>
                      <button
                        onClick={() => setShowPasswordModal(true)}
                        className="px-5 py-2.5 text-[13px] font-semibold rounded-lg border border-ds-200 text-ds-900 hover:bg-ds-100 transition-all"
                      >
                         Изменить пароль
                      </button>
                   </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex flex-col items-start gap-4 md:gap-0 md:flex-row md:justify-between md:items-end mb-8">
                   <div>
                      <h1 className="text-[22px] md:text-[28px] font-bold text-primary-900 tracking-tight mb-1">Архив черновиков</h1>
                      <p className="text-ds-600 text-[14px]">Хранится в базе программы в зашифрованном виде, пока вы не удалите</p>
                   </div>
                   <div className="relative w-full md:w-auto">
                      <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ds-400" />
                      <input
                         placeholder="Поиск..."
                         value={filterQuery}
                         onChange={e => setFilterQuery(e.target.value)}
                         className="bg-white border border-ds-400 rounded-lg pl-9 pr-4 py-2 text-[13px] outline-none focus:ring-2 focus:ring-primary-500 w-full md:w-[220px]"
                      />
                   </div>
                </div>

                <div className="space-y-3">
                   {loading ? (
                      <div className="py-20 text-center text-ds-600 font-mono text-[12px] uppercase tracking-widest">Загрузка архива...</div>
                   ) : drafts.length === 0 ? (
                      <div className="py-20 text-center border-2 border-dashed border-ds-200 rounded-xl text-ds-600 text-[13px]">История пуста</div>
                   ) : (
                      drafts.filter(d => {
                        const q = filterQuery.toLowerCase();
                        const c = parseContent(d.content);
                        return !q || (c?.diagnoses || '').toLowerCase().includes(q) || (c?.complaints || '').toLowerCase().includes(q);
                      }).map((draft) => {
                        const content = parseContent(draft.content);
                        const dateObj = new Date(draft.createdAt);
                        const protocolReady = hasProtocol(content);
                        const isGenerating = generatingProtocolFor === draft.id;
                        return (
                          <div
                            key={draft.id}
                            onClick={() => { setCommunicationReviewError(null); setSelectedDraft({ ...draft, parsed: content }); }}
                            className="bg-white border border-ds-200 p-5 rounded-xl flex flex-wrap md:flex-nowrap group hover:border-primary-200 hover:shadow-md transition-all cursor-pointer shadow-sm"
                          >
                             <div className="w-[68px] shrink-0 border-r border-ds-200 mr-3 md:mr-5 flex flex-col items-center justify-center">
                                <div className="text-[22px] font-bold text-primary-900 leading-none">{dateObj.getDate()}</div>
                                <div className="text-[10px] font-semibold text-ds-600 uppercase">{dateObj.toLocaleString('ru-RU', { month: 'short' })}</div>
                                <div className="text-[10px] font-mono mt-0.5 text-ds-600">{dateObj.getFullYear()}</div>
                                <div className="text-[11px] font-mono font-semibold mt-1.5 text-ds-600">{dateObj.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                             </div>
                             <div className="flex-1 min-w-0 overflow-hidden md:overflow-visible">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-[15px] font-semibold text-ds-900 line-clamp-1 flex-1">
                                    {draftTitle(content)}
                                  </h3>
                                  <span className={`shrink-0 text-[9px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${protocolReady ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'}`}>
                                    {protocolReady ? 'Готов' : 'Черновик'}
                                  </span>
                                </div>
                                <p className="text-[13px] text-ds-600 line-clamp-1">{content?.complaints || (content?.transcript ? 'Есть стенограмма' : 'Данные не заполнены')}</p>
                                {content?.communicationReview?.notes?.length > 0 && (
                                  <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700">
                                    <MessageCircleHeart size={12} /> Разбор общения: {content.communicationReview.notes.length}
                                  </div>
                                )}
                             </div>
                             <div className="w-full md:w-auto flex flex-row md:flex-col items-center md:items-end justify-end md:justify-center gap-2 mt-3 md:mt-0 ml-0 md:ml-3">
                                {!protocolReady && content?.transcript && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleGenerateProtocol(draft); }}
                                    disabled={isGenerating}
                                    className="flex items-center gap-1.5 text-[11px] font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                                  >
                                    <Sparkles size={11} />
                                    {isGenerating ? 'Генерация...' : 'Создать протокол'}
                                  </button>
                                )}
                                <button
                                  onClick={(e) => handleDeleteDraft(e, draft.id)}
                                  className="text-ds-400 hover:text-error-600 p-1.5 rounded-lg hover:bg-error-50 transition-colors md:opacity-0 md:group-hover:opacity-100"
                                >
                                  <Trash2 size={15}/>
                                </button>
                             </div>
                          </div>
                        );
                      })
                   )}
                </div>
              </motion.div>
            )}
          </div>
        </main>
      </div>

      {/* Draft Slide-over */}
      <AnimatePresence>
        {selectedDraft && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-primary-900/50 backdrop-blur-sm z-[100] flex justify-end"
            onClick={() => setSelectedDraft(null)}
          >
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-ds-200"
            >
              <div className="min-h-[64px] py-2 md:py-0 md:h-[64px] px-4 md:px-7 flex flex-wrap gap-y-2 items-center justify-between border-b border-ds-200 bg-ds-100">
                <div>
                  <span className="font-semibold text-primary-900 text-[15px]">Протокол от {new Date(selectedDraft.createdAt).toLocaleDateString('ru-RU')}</span>
                  {!hasProtocol(selectedDraft.parsed) && (
                    <span className="ml-2 text-[10px] bg-warning-100 text-warning-700 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">Черновик</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasProtocol(selectedDraft.parsed) && (
                    <button
                      onClick={() => copyDraftToClipboard(selectedDraft.parsed)}
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-primary-700 bg-primary-50 border border-primary-100 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {copiedDraftField === 'all' ? <><CheckCircle size={13}/> Скопировано</> : <><Copy size={13}/> В МИС</>}
                    </button>
                  )}
                  {!hasProtocol(selectedDraft.parsed) && selectedDraft.parsed.transcript && (
                    <button
                      onClick={() => handleGenerateProtocol({ id: selectedDraft.id, content: selectedDraft.parsed })}
                      disabled={generatingProtocolFor === selectedDraft.id}
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Sparkles size={13}/> {generatingProtocolFor === selectedDraft.id ? 'Генерация...' : 'Создать протокол'}
                    </button>
                  )}
                  <button onClick={() => setSelectedDraft(null)} className="text-ds-600 hover:text-primary-900 p-1.5 rounded-lg hover:bg-ds-200 transition-colors"><X size={18}/></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-7 space-y-5">
                 {generatingProtocolFor === selectedDraft.id && (
                   <div className="py-10 text-center text-primary-600 font-semibold text-[13px] animate-pulse">Анализ стенограммы и формирование протокола...</div>
                 )}
                 {[
                    { label: "Жалобы", val: selectedDraft.parsed?.complaints },
                    { label: "Анамнез заболевания", val: selectedDraft.parsed?.anamnesisMorbi },
                    { label: "Анамнез жизни", val: selectedDraft.parsed?.anamnesisVitae },
                    { label: "Аллергоанамнез", val: selectedDraft.parsed?.allergies },
                    { label: "Осмотр", val: selectedDraft.parsed?.examination },
                    { label: "Диагноз", val: selectedDraft.parsed?.diagnoses, highlight: true },
                    { label: "Лекарственная терапия", val: selectedDraft.parsed?.medications },
                    { label: "План лечения", val: selectedDraft.parsed?.plan },
                 ].map((item, idx) => typeof item.val === 'string' && item.val.trim() !== '' && item.val.trim() !== DRAFT_PLACEHOLDER ? (
                    <div key={idx} className={`p-5 border rounded-xl ${item.highlight ? 'bg-primary-900 text-white border-primary-800' : 'bg-ds-50 border-ds-200'}`}>
                       <div className={`text-[10px] font-semibold uppercase tracking-wide mb-2 ${item.highlight ? 'text-primary-300' : 'text-ds-600'}`}>{item.label}</div>
                       <div className="text-[14px] leading-relaxed">{item.val}</div>
                    </div>
                 ) : null)}
                 {(selectedDraft.parsed?.communicationReview || selectedDraft.parsed?.transcript) && (
                   <div className="pt-6 border-t border-ds-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ds-600">
                          <MessageCircleHeart size={13} /> Разбор общения
                        </div>
                        {selectedDraft.parsed?.transcript && (
                          <button
                            onClick={() => handleReviewCommunication(selectedDraft.id, selectedDraft.parsed)}
                            disabled={reviewingCommunicationFor === selectedDraft.id}
                            className="flex items-center gap-1.5 text-[11px] font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {reviewingCommunicationFor === selectedDraft.id
                              ? 'Разбираю...'
                              : selectedDraft.parsed?.communicationReview ? 'Разобрать заново' : 'Разобрать'}
                          </button>
                        )}
                      </div>
                      {communicationReviewError && reviewingCommunicationFor === null && (
                        <p className="mb-3 text-[12px] text-warning-900 bg-warning-50 border border-warning-200 rounded-lg px-3 py-2">{communicationReviewError}</p>
                      )}
                      {selectedDraft.parsed?.communicationReview ? (
                        <div className="bg-ds-50 border border-ds-200 rounded-xl p-4">
                          <CommunicationNotes notes={selectedDraft.parsed.communicationReview.notes || []} />
                        </div>
                      ) : (
                        <p className="text-[13px] text-ds-600">Для этого приёма разбора нет.</p>
                      )}
                   </div>
                 )}
                 {selectedDraft.parsed?.transcript && (
                   <div className="pt-6 border-t border-ds-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-ds-600">Стенограмма</div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedDraft.parsed.transcript);
                            setCopiedDraftField('transcript');
                            setTimeout(() => setCopiedDraftField(null), 2500);
                          }}
                          className="flex items-center gap-1.5 text-[11px] font-semibold text-ds-600 hover:text-primary-700 bg-ds-150 hover:bg-primary-50 border border-ds-200 hover:border-primary-100 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          {copiedDraftField === 'transcript' ? <><CheckCircle size={11}/> Скопировано</> : <><Copy size={11}/> Копировать</>}
                        </button>
                      </div>
                      <div className="bg-ds-50 border border-ds-200 rounded-xl p-5 font-mono text-[12px] whitespace-pre-wrap text-ds-700">{selectedDraft.parsed.transcript}</div>
                   </div>
                 )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-primary-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setShowPasswordModal(false)}
          >
            <motion.div
               initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }}
               onClick={e => e.stopPropagation()}
               className="bg-white w-full max-w-sm p-8 shadow-2xl border border-ds-200 rounded-xl"
            >
               <h2 className="text-[22px] font-bold text-primary-900 tracking-tight mb-6">Смена пароля</h2>
               <form onSubmit={handleChangePassword} className="space-y-5">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-ds-600 mb-1.5">Старый пароль</label>
                    <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="w-full h-11 px-4 border border-ds-400 rounded-lg font-mono text-[15px] outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-ds-600 mb-1.5">Новый пароль</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full h-11 px-4 border border-ds-400 rounded-lg font-mono text-[15px] outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
                  </div>
                  {pwdError && <div className="text-error-700 text-[13px] font-medium bg-error-50 border border-error-200 rounded-lg px-3 py-2" role="alert">{pwdError}</div>}
                  {pwdSuccess && <div className="text-success-700 text-[13px] font-medium bg-success-50 border border-success-200 rounded-lg px-3 py-2">{pwdSuccess}</div>}
                  <button className="w-full bg-primary-600 text-white py-3 text-[14px] font-semibold rounded-lg hover:bg-primary-700 transition-colors">Обновить пароль</button>
               </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {show2FAModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-primary-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShow2FAModal(false)}>
            <motion.div initial={{ scale: 0.96 }} onClick={e => e.stopPropagation()} className="bg-white max-w-sm p-8 w-full text-center rounded-xl border border-ds-200 shadow-2xl">
              <h2 className="text-[22px] font-bold text-primary-900 tracking-tight mb-6">Настройка 2FA</h2>
              <img src={qrCodeUrl} className="mx-auto border border-ds-200 rounded-lg p-2 mb-5" />
              <input value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value)} className="w-full h-12 border border-ds-400 rounded-lg text-center text-[20px] font-mono mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="000000" />
              <input type="password" autoComplete="current-password" value={twoFactorPassword} onChange={e => setTwoFactorPassword(e.target.value)} className="w-full h-12 border border-ds-400 rounded-lg text-center text-[14px] mb-2 focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Текущий пароль" />
              <p className="text-[11px] text-ds-600 mb-5 leading-snug">Пароль подтверждает, что аутентификатор привязываете вы, а не тот, кто получил доступ к сессии.</p>
              <button onClick={handleEnable2FA} className="w-full bg-primary-600 text-white py-3 text-[14px] font-semibold rounded-lg hover:bg-primary-700 transition-colors">Подтвердить</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {show2FADisableModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-primary-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShow2FADisableModal(false)}>
            <motion.form initial={{ scale: 0.96 }} onSubmit={handleDisable2FA} onClick={e => e.stopPropagation()} className="bg-white max-w-sm p-8 w-full text-center rounded-xl border border-ds-200 shadow-2xl">
              <h2 className="text-[22px] font-bold text-primary-900 tracking-tight mb-6">Отключение 2FA</h2>
              <input required value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value)} className="w-full h-12 border border-ds-400 rounded-lg text-center text-[20px] font-mono mb-3 focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="000000" autoComplete="one-time-code" />
              <input required type="password" autoComplete="current-password" value={twoFactorPassword} onChange={e => setTwoFactorPassword(e.target.value)} className="w-full h-12 border border-ds-400 rounded-lg text-center text-[14px] mb-2 focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Текущий пароль" />
              <p className="text-[11px] text-ds-600 mb-5 leading-snug">Нужны код из аутентификатора и текущий пароль.</p>
              <button type="submit" className="w-full bg-primary-600 text-white py-3 text-[14px] font-semibold rounded-lg hover:bg-primary-700 transition-colors">Отключить</button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

