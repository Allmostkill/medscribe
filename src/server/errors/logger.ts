import fs from 'fs';
import path from 'path';
import { ERROR_CODES, ErrorCode } from './errorCodes';

// ── Log directory setup ───────────────────────────────────────────────────────
const LOGS_DIR = path.join(process.cwd(), 'logs');

function ensureLogsDir(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function getLogFilePath(): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(LOGS_DIR, `app-${date}.log`);
}

function formatTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function appendToLog(line: string): void {
  try {
    ensureLogsDir();
    fs.appendFileSync(getLogFilePath(), line + '\n', 'utf8');
  } catch {
    // Silently ignore file write errors to avoid crashing the server
  }
}

// ── logError ─────────────────────────────────────────────────────────────────
// Format: [2026-05-17T10:23:11Z] [HIGH] STT_011 T-one: ошибка потокового WebSocket | detail: ... | extra: {...}
export function logError(code: ErrorCode, detail?: string, extra?: object): void {
  const def = ERROR_CODES[code];
  const severity = def.severity.toUpperCase();
  const ts = formatTimestamp();

  let line = `[${ts}] [${severity}] ${code} ${def.message}`;
  if (detail) line += ` | detail: ${detail}`;
  if (extra && Object.keys(extra).length > 0) line += ` | extra: ${JSON.stringify(extra)}`;

  console.error(`[ERROR] ${line}`);
  appendToLog(line);
}

// ── logWarn ──────────────────────────────────────────────────────────────────
export function logWarn(code: ErrorCode, detail?: string): void {
  const def = ERROR_CODES[code];
  const ts = formatTimestamp();

  let line = `[${ts}] [WARN] ${code} ${def.message}`;
  if (detail) line += ` | detail: ${detail}`;

  console.warn(`[WARN] ${line}`);
  appendToLog(line);
}

// ── logInfo ──────────────────────────────────────────────────────────────────
export function logInfo(message: string): void {
  const ts = formatTimestamp();
  const line = `[${ts}] [INFO] ${message}`;

  console.log(`[INFO] ${message}`);
  appendToLog(line);
}
