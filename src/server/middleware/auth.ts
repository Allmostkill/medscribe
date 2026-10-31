import express from "express";
import { TWO_FA_ENABLED } from "../config";
import { verifyJwt, ensureSessionValid } from "../auth/tokens";

// ── Auth middleware ────────────────────────────────────────────────────────
// requireAuth: any valid token (including partial = pre-2FA)
// requireFullAuth: rejects partial tokens — for endpoints that mutate user state
export const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Необходима авторизация" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded: any = verifyJwt(token);
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Недействительный токен" });
  }
};

export const requireFullAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  requireAuth(req, res, async () => {
    if ((req as any).user?.isPartial) {
      return res.status(403).json({ error: "Необходима полная авторизация (2FA)" });
    }
    if (!(await ensureSessionValid((req as any).user, res))) return;
    next();
  });
};

// Без ENABLE_2FA=true включить 2FA нельзя; отключение и вход по коду работают всегда
export const requireTwoFaEnabled = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!TWO_FA_ENABLED) return res.status(404).json({ error: 'Endpoint not found' });
  next();
};

// Токен проверяется ДО express.raw: иначе аноним заставил бы сервер принять
// и буферизовать до 30 МБ тела, чтобы потом получить 401.
export const requireSttAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const tokenHeader = req.headers.authorization?.split(' ')[1];
  if (!tokenHeader) return res.status(401).json({ error: 'Unauthorized' });
  let decodedUser: any;
  try { decodedUser = verifyJwt(tokenHeader) as any; } catch { return res.status(401).json({ error: 'Invalid token' }); }
  if (decodedUser?.isPartial) return res.status(401).json({ error: 'Partial auth' });
  if (!(await ensureSessionValid(decodedUser, res))) return;
  (req as any).user = decodedUser;
  next();
};
