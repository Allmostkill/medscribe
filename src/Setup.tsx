import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandLockup } from './components/BrandMark';
import { saveSession } from './services/auth';
import { MEDICAL_SPECIALTIES } from './config/specialties';
import { SOURCE_URL } from './config/about';

export default function Setup() {
  const navigate = useNavigate();
  const [dbStarting, setDbStarting] = useState(false);

  // Код первого запуска приходит в ссылке (#token=…) — забираем и убираем из адресной строки.
  const [setupToken, setSetupToken] = useState('');
  const [tokenFromLink, setTokenFromLink] = useState(false);
  useEffect(() => {
    const m = /(?:^#|&)token=([^&]+)/.exec(window.location.hash);
    if (m) {
      try { setSetupToken(decodeURIComponent(m[1])); } catch { setSetupToken(m[1]); }
      setTokenFromLink(true);
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  // Если аккаунт уже создан — на вход. 503 — база ещё запускается, повторяем.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      try {
        const res = await fetch('/api/setup/status');
        if (cancelled) return;
        if (res.status === 503) {
          setDbStarting(true);
          timer = setTimeout(check, 3000);
          return;
        }
        setDbStarting(false);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.needsSetup === false) navigate('/', { replace: true });
      } catch {
        if (!cancelled) timer = setTimeout(check, 3000);
      }
    };
    check();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [navigate]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [specialtyId, setSpecialtyId] = useState('therapist');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Пароль должен быть не короче 8 символов'); return; }
    if (password !== password2) { setError('Пароли не совпадают'); return; }
    setIsLoading(true);
    try {
      const resp = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupToken: setupToken.trim(), name: name.trim(), email: email.trim(), password, specialtyId }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.status === 201 && data.token) {
        saveSession({
          token: data.token,
          expiresInSeconds: data.expiresInSeconds,
          refreshToken: data.refreshToken,
          refreshExpiresInSeconds: data.refreshExpiresInSeconds,
          doctor: data.doctor,
        });
        navigate('/app');
        return;
      }
      if (data.code === 'bad_setup_token') {
        setError(tokenFromLink
          ? 'Ссылка первого запуска устарела. Закройте эту вкладку и откройте MedScribe через ярлык: он получит новую ссылку. Если ярлыка нет, повторите команду установки из инструкции.'
          : 'Код не подошёл. Проверьте опечатки или возьмите последнюю строку «Код первого запуска» из журнала (docker compose logs app). Не публикуйте этот код.');
        setTokenFromLink(false);
        setSetupToken('');
        setIsLoading(false);
        return;
      }
      setError(data.error || `Не удалось создать аккаунт (HTTP ${resp.status})`);
      setIsLoading(false);
    } catch {
      setError('Ошибка подключения к серверу');
      setIsLoading(false);
    }
  };

  const inputCls = 'w-full h-11 px-4 border border-ds-400 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-[15px] text-ds-950 transition-all placeholder:text-ds-600';
  const labelCls = 'block text-[11px] uppercase font-semibold tracking-wide text-ds-600 mb-1.5';
  const primaryBtn = 'w-full h-11 bg-primary-600 text-white text-[14px] font-semibold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50';

  return (
    <div className="min-h-screen bg-ds-50 text-ds-950 font-sans flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[460px] bg-white border border-ds-200 shadow-2xl rounded-xl overflow-hidden">
        <div className="px-8 py-6 border-b border-ds-200 bg-ds-50">
          <div className="mb-3">
            <BrandLockup size={22} />
          </div>
          <h1 className="text-[26px] font-bold tracking-tight text-primary-900 leading-none">Первый запуск</h1>
          <p className="text-ds-600 text-[13px] mt-1.5">Создайте учётную запись врача</p>
        </div>

        <div className="px-8 py-7">
          {dbStarting ? (
            <p className="text-[14px] text-ds-700 leading-relaxed">База данных запускается…</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <div className="p-3.5 bg-error-50 text-error-700 border border-error-200 text-[13px] font-medium rounded-lg" role="alert">
                  {error}
                </div>
              )}

              {!tokenFromLink && (
                <div>
                  <label className={labelCls}>Код первого запуска</label>
                  <input type="text" required value={setupToken} onChange={e => setSetupToken(e.target.value)} className={inputCls} placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="off" />
                  <p className="text-[12px] text-ds-600 mt-1.5 leading-relaxed">
                    Откройте MedScribe через ярлык — код подставится автоматически. Если ярлыка нет, повторите команду установки из инструкции.
                  </p>
                  <details className="text-[12px] text-ds-600 mt-2">
                    <summary className="cursor-pointer">Для ручной или серверной установки</summary>
                    <p className="mt-1">В папке программы выполните <code>docker compose logs app</code> и найдите последнюю строку «Код первого запуска». Не публикуйте этот код.</p>
                  </details>
                </div>
              )}

              <div>
                <label className={labelCls}>ФИО</label>
                <input type="text" required maxLength={200} value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Иванов Иван Иванович" />
              </div>

              <div>
                <label className={labelCls}>Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="doctor@clinic.ru" />
              </div>

              <div>
                <label className={labelCls}>Специальность</label>
                <select value={specialtyId} onChange={e => setSpecialtyId(e.target.value)} className={inputCls}>
                  {Object.values(MEDICAL_SPECIALTIES).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Пароль (не короче 8 символов)</label>
                <input type="password" required minLength={8} maxLength={200} value={password} onChange={e => setPassword(e.target.value)} className={inputCls} autoComplete="new-password" />
              </div>

              <div>
                <label className={labelCls}>Повторите пароль</label>
                <input type="password" required minLength={8} maxLength={200} value={password2} onChange={e => setPassword2(e.target.value)} className={inputCls} autoComplete="new-password" />
              </div>

              <button type="submit" disabled={isLoading} className={primaryBtn + ' mt-2'}>
                {isLoading ? 'Создание...' : 'Создать аккаунт'}
              </button>
            </form>
          )}
        </div>
      </div>
      <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer"
        className="mt-5 text-[12px] text-ds-600 hover:text-primary-900 transition-colors">
        Исходный код (AGPL-3.0)
      </a>
    </div>
  );
}
