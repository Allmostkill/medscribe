import { useEffect, useState } from "react";
import {
  ArrowLeft, ExternalLink, ClipboardCheck, Stethoscope, Pill, UserRound,
  Copy, Check, ImageOff, AlertTriangle, ShieldCheck,
} from "lucide-react";
import DOMPurify from "dompurify";
import { getStoredSession } from "../../services/auth";
import type { QualityCriterion } from "../../utils/guidelineCriteria";

// HTML клинреков приходит из базы: чистим на выводе. Скрипты, обработчики
// событий, javascript:-ссылки и встраиваемые объекты DOMPurify убирает сам;
// таблицы, списки и ссылки остаются.
function sanitizeGuidelineHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "base"],
    FORBID_ATTR: ["srcdoc", "formaction"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/|data:image\/(?:png|jpe?g|gif|webp);)/i,
  });
}

interface SectionRef {
  section_id: string;
  part: number;
  ord: number;
  title: string;
  char_len: number;
  uur: string[];
  image_only: boolean;
}

interface SectionPart {
  section_id: string;
  part: number;
  title: string;
  html: string;
  plain: string;
  char_len: number;
  uur: string[];
  udd: string[];
  image_only: boolean;
}

interface Props {
  docId: string;
  title: string;
  url: string;
  onBack: () => void;
}

// Словарь идентификаторов разделов у рубрикатора закрытый и общий для всех
// действующих рекомендаций — именно поэтому переход «диагноз → нужный раздел»
// работает без всякого поиска. Четыре из них врач открывает чаще прочих.
const QUICK: { id: string; label: string; Icon: typeof Pill }[] = [
  { id: 'doc_diag_2', label: 'Диагностика', Icon: Stethoscope },
  { id: 'doc_3', label: 'Лечение', Icon: Pill },
  { id: 'doc_criteria', label: 'Критерии ОМС', Icon: ClipboardCheck },
  { id: 'doc_v', label: 'Памятка пациенту', Icon: UserRound },
];

const authHeaders = (): HeadersInit | undefined => {
  const token = getStoredSession()?.token;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
};

export default function GuidelineDocument({ docId, title, url, onBack }: Props) {
  const [toc, setToc] = useState<SectionRef[]>([]);
  const [tocState, setTocState] = useState<'loading' | 'ready' | 'error' | 'absent'>('loading');
  const [openId, setOpenId] = useState<string | null>(null);
  const [parts, setParts] = useState<SectionPart[]>([]);
  const [criteria, setCriteria] = useState<QualityCriterion[]>([]);
  const [secState, setSecState] = useState<'idle' | 'loading' | 'error'>('idle');
  // Отметки в чек-листе — состояние конкретного приёма, а не документа: живут
  // в браузере на сессию и никуда не сохраняются. Тот же принцип, что у
  // чек-боксов кастомных виджетов рабочего поля.
  const [done, setDone] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTocState('loading');
    setOpenId(null);
    setParts([]);
    fetch(`/api/guidelines/doc/${encodeURIComponent(docId)}`, { headers: authHeaders() })
      .then(async r => ({ ok: r.ok, status: r.status, body: await r.json() }))
      .then(({ ok, status, body }) => {
        if (cancelled) return;
        if (!ok) { setTocState(status === 404 ? 'absent' : 'error'); return; }
        setToc(body.sections || []);
        setTocState('ready');
      })
      .catch(() => { if (!cancelled) setTocState('error'); });
    return () => { cancelled = true; };
  }, [docId]);

  function openSection(sectionId: string) {
    if (openId === sectionId) { setOpenId(null); return; }
    setOpenId(sectionId);
    setSecState('loading');
    setParts([]);
    setCriteria([]);
    setCopied(false);
    fetch(`/api/guidelines/doc/${encodeURIComponent(docId)}/section/${encodeURIComponent(sectionId)}`,
      { headers: authHeaders() })
      .then(async r => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        if (!ok) { setSecState('error'); return; }
        setParts(body.parts || []);
        setCriteria(body.criteria || []);
        setSecState('idle');
      })
      .catch(() => setSecState('error'));
  }

  const present = new Set(toc.map(s => s.section_id));
  const imageOnly = parts.length > 0 && parts.every(p => p.image_only);

  async function copyPlain() {
    try {
      await navigator.clipboard.writeText(parts.map(p => p.plain).join('\n\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* буфер недоступен — врач выделит текст руками */ }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-[var(--bl-pad)] pt-[var(--bl-pad)] pb-[var(--bl-stack-sm)] border-b border-ds-200">
        <div className="flex items-start gap-1.5">
          <button
            onClick={onBack}
            className="flex-shrink-0 mt-0.5 text-ds-600 hover:text-primary-600 transition-colors"
            title="К списку рекомендаций"
          >
            <ArrowLeft size={13} />
          </button>
          <span className="bl-label font-semibold text-ds-900 leading-snug flex-1">{title}</span>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="flex-shrink-0 mt-0.5 text-ds-400 hover:text-primary-600 transition-colors"
            title="Открыть оригинал на сайте Минздрава">
            <ExternalLink size={12} />
          </a>
        </div>

        {tocState === 'ready' && (
          <div className="flex flex-wrap gap-1 mt-2">
            {QUICK.filter(q => present.has(q.id)).map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => openSection(id)}
                className={`inline-flex items-center gap-1 bl-caption px-1.5 py-1 rounded border transition-colors ${
                  openId === id
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-ds-700 border-ds-200 hover:border-primary-300'
                }`}
              >
                <Icon size={11} /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-[var(--bl-pad)] overflow-y-auto flex-1 bg-ds-50 space-y-[var(--bl-stack-sm)]">
        {tocState === 'loading' && <p className="text-center bl-label text-ds-600 mt-6">Открываю документ…</p>}

        {tocState === 'absent' && (
          <div className="flex items-start gap-1.5 bg-warning-50 border border-warning-200 rounded-md px-2 py-1.5 bl-label text-warning-800">
            <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
            <span>Текст этой рекомендации ещё не загружен в локальную копию. Оригинал доступен по ссылке выше.</span>
          </div>
        )}

        {tocState === 'error' && (
          <div className="flex items-start gap-1.5 bg-warning-50 border border-warning-200 rounded-md px-2 py-1.5 bl-label text-warning-800">
            <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
            <span>Локальная копия рекомендаций недоступна. Это не значит, что документа нет — откройте оригинал.</span>
          </div>
        )}

        {tocState === 'ready' && toc.map(s => (
          <div key={`${s.section_id}#${s.part}`}>
            {s.part === 0 && (
              <button
                onClick={() => openSection(s.section_id)}
                className={`w-full text-left bg-white border rounded-lg px-2.5 py-2 transition-colors ${
                  openId === s.section_id ? 'border-primary-400' : 'border-ds-200 hover:border-primary-300'
                }`}
              >
                <div className="flex items-start gap-1.5">
                  <span className="bl-label text-ds-900 leading-snug flex-1">{s.title}</span>
                  {s.image_only
                    ? <ImageOff size={11} className="text-warning-600 flex-shrink-0 mt-0.5" />
                    : s.uur.length > 0 && (
                      <span className="bl-caption px-1 py-0.5 rounded bg-success-50 text-success-700 border border-success-200 flex-shrink-0">
                        УУР {[...new Set(s.uur)].sort().join('')}
                      </span>
                    )}
                </div>
              </button>
            )}

            {openId === s.section_id && s.part === 0 && (
              <div className="mt-1 bg-white border border-primary-200 rounded-lg p-2.5">
                {secState === 'loading' && <p className="bl-label text-ds-600">Загружаю раздел…</p>}
                {secState === 'error' && (
                  <p className="bl-label text-warning-800">Раздел не загрузился. Откройте оригинал по ссылке выше.</p>
                )}

                {secState === 'idle' && imageOnly && (
                  <div className="flex items-start gap-1.5 bl-label text-warning-800">
                    <ImageOff size={12} className="flex-shrink-0 mt-0.5" />
                    <span>
                      В документе этот раздел опубликован изображением, а не текстом — разобрать его нечем.
                      Он есть, но смотреть придётся в оригинале.
                    </span>
                  </div>
                )}

                {/* Критерии оценки качества — дословно то, что смотрит проверка
                    ОМС. Показываем чек-листом; если разобрать таблицу не
                    удалось, ниже отрисуется исходный раздел как есть. */}
                {secState === 'idle' && criteria.length > 0 && (
                  <div className="space-y-1">
                    {criteria.map(c => {
                      const key = `${s.section_id}:${c.n}:${c.text.slice(0, 24)}`;
                      const on = done.has(key);
                      return (
                        <label key={key} className="flex items-start gap-1.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => setDone(prev => {
                              const next = new Set(prev);
                              on ? next.delete(key) : next.add(key);
                              return next;
                            })}
                            className="mt-0.5 flex-shrink-0 accent-primary-600"
                          />
                          <span className={`bl-body leading-snug ${on ? 'text-ds-400 line-through' : 'text-ds-900'}`}>
                            <span className="text-ds-400 mr-1">{c.n}.</span>{c.text}
                          </span>
                        </label>
                      );
                    })}
                    <p className="bl-caption text-ds-600 pt-1.5 mt-1.5 border-t border-ds-200 leading-snug">
                      Отметки живут только в этой вкладке и никуда не сохраняются.
                    </p>
                  </div>
                )}

                {secState === 'idle' && criteria.length === 0 && !imageOnly && parts.map(p => (
                  <div key={p.part} className="mb-3 last:mb-0">
                    {p.title !== s.title && (
                      <p className="bl-label font-semibold text-ds-900 mb-1">{p.title}</p>
                    )}
                    {/* Разметку дополнительно чистит DOMPurify на выводе. */}
                    <div
                      className="guideline-html bl-body text-ds-900 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: sanitizeGuidelineHtml(p.html) }}
                    />
                    {p.uur.length > 0 && (
                      <p className="bl-caption text-success-700 mt-1.5 inline-flex items-center gap-1">
                        <ShieldCheck size={11} />
                        градаций доказательности в разделе: {p.uur.length}
                      </p>
                    )}
                  </div>
                ))}

                {secState === 'idle' && parts.length > 0 && !imageOnly && (
                  <button
                    onClick={copyPlain}
                    className="mt-2 inline-flex items-center gap-1 bl-caption px-1.5 py-1 rounded border border-ds-200 bg-white text-ds-700 hover:border-primary-300 transition-colors"
                  >
                    {copied ? <Check size={11} className="text-success-600" /> : <Copy size={11} />}
                    {copied ? 'Скопировано' : 'Скопировать текст раздела'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
