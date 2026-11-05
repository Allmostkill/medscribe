import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { BrandLockup } from './components/BrandMark';
import { saveSession, ensureValidSession } from './services/auth';
import { SOURCE_URL } from './config/about';

export default function Login() {
  const navigate = useNavigate();
  // Первый запуск: если врача ещё нет — ведём на мастер настройки.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/setup/status');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.needsSetup === true) navigate('/setup', { replace: true });
      } catch {
        /* сервер недоступен — остаёмся на входе */
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');

  // Авто-вход: если в браузере есть валидная (или обновляемая через refresh)
  // сессия — пропускаем экран логина и сразу ведём в кабинет.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await ensureValidSession();
      if (cancelled || !session) return;
      navigate('/app');
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  // Капча на входе показывается лениво: только когда сервер её требует
  // (после серии неудачных попыток).
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchCaptcha = async () => {
    try {
      setCaptchaSvg('<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12">Загрузка...</text></svg>');
      const res = await fetch('/api/auth/captcha');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setCaptchaId(data.id);
      let processedSvg = data.svg;
      if (typeof processedSvg === 'string') {
        processedSvg = processedSvg.replace('<svg', '<svg style="width:100%; height:100%; object-fit:contain;"');
      }
      setCaptchaSvg(processedSvg);
    } catch(e: any) {
      setCaptchaSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="#b91c1c">${String(e.message || 'Ошибка сети').replace(/[<>&"']/g, c => `&#${c.charCodeAt(0)};`)}</text></svg>`);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, captchaId, captchaAnswer }),
      });
      const data = await resp.json();

      if (resp.ok && data.requires2FA) {
        setRequires2FA(true);
        setTempToken(data.tempToken);
        setIsLoading(false);
        return;
      }

      if (!resp.ok || !data.success) {
        setError(data.error || 'Ошибка авторизации');
        if (data.requiresCaptcha) {
          // Сервер потребовал капчу (после неудачных попыток) — показываем её.
          setCaptchaRequired(true);
          fetchCaptcha();
          setCaptchaAnswer('');
        } else if (captchaRequired) {
          // Капча уже на экране — обновляем (она одноразовая).
          fetchCaptcha();
          setCaptchaAnswer('');
        }
        setIsLoading(false);
        return;
      }

      saveSession({
        token: data.token,
        expiresInSeconds: data.expiresInSeconds,
        refreshToken: data.refreshToken,
        refreshExpiresInSeconds: data.refreshExpiresInSeconds,
        doctor: data.doctor,
      });

      navigate('/app');
    } catch (err) {
      setError('Ошибка подключения к серверу');
      setIsLoading(false);
    }
  };

  const handle2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const resp = await fetch('/api/auth/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, token: twoFactorCode }),
      });
      const data = await resp.json();

      if (!resp.ok || !data.success) {
        setError(data.error || 'Неверный код 2FA');
        setIsLoading(false);
        return;
      }

      saveSession({
        token: data.token,
        expiresInSeconds: data.expiresInSeconds,
        refreshToken: data.refreshToken,
        refreshExpiresInSeconds: data.refreshExpiresInSeconds,
        doctor: data.doctor,
      });

      navigate('/app');
    } catch (err) {
      setError('Ошибка подключения к серверу');
      setIsLoading(false);
    }
  };

  const inputCls = 'w-full h-11 px-4 border border-ds-400 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-[15px] text-ds-950 transition-all placeholder:text-ds-600';
  const labelCls = 'block text-[11px] uppercase font-semibold tracking-wide text-ds-600 mb-1.5';
  const primaryBtn = 'w-full h-11 bg-primary-600 text-white text-[14px] font-semibold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50';
  const errorBox = error ? (
    <div className="p-3.5 bg-error-50 text-error-700 border border-error-200 text-[13px] font-medium rounded-lg" role="alert">
      {error}
    </div>
  ) : null;

  const title = requires2FA ? 'Двухфакторная защита' : 'Вход в систему';
  const subtitle = requires2FA ? '' : 'Защищённый доступ к вашему ассистенту';

  return (
    <div className="min-h-screen bg-ds-50 text-ds-950 font-sans flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-[460px] bg-white border border-ds-200 shadow-2xl rounded-xl overflow-hidden">
        <div className="px-8 py-6 border-b border-ds-200 bg-ds-50">
          <div className="mb-3">
            <BrandLockup size={22} />
          </div>
          <h1 className="text-[26px] font-bold tracking-tight text-primary-900 leading-none">{title}</h1>
          {subtitle && <p className="text-ds-600 text-[13px] mt-1.5">{subtitle}</p>}
        </div>

        <div className="px-8 py-7">
          {requires2FA ? (
            <form onSubmit={handle2FA} className="flex flex-col gap-5">
              {errorBox}
              <p className="text-[14px] text-ds-700 leading-relaxed">Введите 6-значный код из приложения-аутентификатора</p>
              <div>
                <label className={labelCls}>Код 2FA</label>
                <input type="text" required autoFocus value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value)} className={inputCls} />
              </div>
              <button type="submit" disabled={isLoading} className={primaryBtn}>
                {isLoading ? 'Проверка...' : 'Подтвердить'}
              </button>
              <button type="button" onClick={() => { setRequires2FA(false); setError(''); }} className="text-[13px] text-ds-600 hover:text-primary-900 text-center transition-colors">
                Отмена
              </button>
            </form>
          ) : (
            <form onSubmit={handleAuth} className="flex flex-col gap-4">
              {errorBox}

              <div>
                <label className={labelCls}>Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="doctor@clinic.ru" />
              </div>

              <div>
                <label className={labelCls}>Пароль</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
              </div>

              {captchaRequired && (
                <div>
                  <label className={labelCls}>Код с картинки</label>
                  <div className="flex gap-2 mb-2">
                    <div className="bg-ds-100 border border-ds-200 rounded-lg flex-1 flex items-center justify-center overflow-hidden h-12 relative">
                      {captchaSvg && (
                        <div className="absolute inset-0 flex items-center justify-center w-full h-full"
                          dangerouslySetInnerHTML={{ __html: captchaSvg || '' }}
                        />
                      )}
                    </div>
                    <button type="button" onClick={fetchCaptcha} aria-label="Обновить картинку"
                      className="bg-ds-100 border border-ds-200 text-ds-600 hover:text-primary-900 px-3 rounded-lg transition-colors">
                      <RefreshCw size={15} />
                    </button>
                  </div>
                  <input type="text" required value={captchaAnswer} onChange={e => setCaptchaAnswer(e.target.value)} className={inputCls} placeholder="Введите символы" />
                </div>
              )}

              <button type="submit" disabled={isLoading} className={primaryBtn + ' mt-2'}>
                {isLoading ? 'Обработка...' : 'Войти'}
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
