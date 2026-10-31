import express from "express";

// Базовые заголовки безопасности. CSP намеренно не задаём — вводится отдельно.
export const securityHeaders = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=()');
  next();
};

// Чужая страница в браузере врача не должна дёргать API (и выбивать лимиты входа):
// браузер помечает такие запросы Sec-Fetch-Site: cross-site. Запросы без заголовка
// (curl, скрипты на этой машине) пропускаем.
export const rejectCrossSite = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.get('sec-fetch-site') === 'cross-site') {
    return res.status(403).json({ error: 'Запрос с чужого сайта отклонён' });
  }
  next();
};
