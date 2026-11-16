import { TRUST_PROXY } from "./config";

export function getClientIp(req: any): string {
  if (TRUST_PROXY) {
    const parts = String(req?.headers?.['x-forwarded-for'] ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    const xff = parts[parts.length - 1];
    if (xff) return xff;
  }
  return req?.socket?.remoteAddress || 'unknown';
}
