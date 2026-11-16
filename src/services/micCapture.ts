/**
 * Единственное место, где открывается микрофон для записи приёма и звонка.
 * Настройки — из src/utils/micConstraints.ts; что браузер дал на самом деле, пишем в консоль
 * ('[Mic] ...'), чтобы при жалобе «не слышно пациента» было видно, включена ли обработка звука.
 */
import {
  AUDIO_PROCESSING_KEY, parseAudioProcessing, micConstraints, describeTrack, type MicKind,
} from '../utils/micConstraints';

/** Включена ли обработка звука браузером (переключатель врача). По умолчанию выключена. */
export function readAudioProcessing(): boolean {
  try {
    return parseAudioProcessing(localStorage.getItem(AUDIO_PROCESSING_KEY));
  } catch {
    return false;
  }
}

export async function openMic(kind: MicKind): Promise<{ stream: MediaStream; line: string }> {
  const wanted = micConstraints(kind, readAudioProcessing());
  const stream = await navigator.mediaDevices.getUserMedia({ audio: wanted });
  const track = stream.getAudioTracks()[0];
  if (!track) return { stream, line: describeTrack({}, wanted).line };

  let described = describeTrack(track.getSettings(), wanted);
  console.info('[Mic]', kind, described.line);
  if (described.mismatch.length > 0) {
    console.warn('[Mic] браузер выставил иначе, чем просили:', described.mismatch.join(', '));
    try {
      await track.applyConstraints(wanted);
    } catch { /* не вышло — остаёмся с тем, что есть */ }
    described = describeTrack(track.getSettings(), wanted);
  }
  return { stream, line: described.line };
}
