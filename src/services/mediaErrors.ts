/**
 * Человеческие тексты для ошибок захвата звука (микрофон, звук вкладки).
 * Браузерные сообщения вроде «Permission denied» врачу ничего не говорят.
 */
export function mediaErrorMessage(err: unknown, kind: 'microphone' | 'tab'): string {
  const e = err as { name?: string; message?: string } | null | undefined;
  const name = e?.name;

  if (name === 'NotAllowedError') {
    return kind === 'tab'
      ? 'Вы отменили выбор вкладки или браузер запретил показ. Нажмите «Записать звонок» ещё раз.'
      : 'Нет доступа к микрофону. Разрешите его для этого сайта (значок замка в адресной строке) и повторите.';
  }
  if (name === 'NotFoundError') return 'Микрофон не найден. Подключите его и повторите.';
  if (name === 'NotReadableError') return 'Микрофон занят другой программой или недоступен.';
  if (name === 'SecurityError' || (typeof navigator !== 'undefined' && !navigator.mediaDevices)) {
    return 'Запись работает только на http://localhost или по HTTPS.';
  }
  return `Не удалось начать запись: ${e?.message || String(err)}`;
}
