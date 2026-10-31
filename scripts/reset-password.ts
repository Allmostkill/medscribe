/**
 * Сброс пароля единственного врача (забыли пароль / потеряли доступ).
 *
 *   npm run reset-password [-- --disable-2fa]
 *
 * Новый пароль печатается один раз. Все прежние сессии и refresh-токены
 * перестают действовать. --disable-2fa дополнительно выключает 2FA.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { createDb } from '../src/server/db';

dotenv.config();

const disable2fa = process.argv.includes('--disable-2fa');

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function main() {
  let db;
  try {
    db = createDb();
  } catch (e) {
    fail(`Не удалось настроить подключение к базе: ${(e as Error).message}`);
  }

  const { data: doctors, error: findErr } = await db.from('doctors').select('id, email').limit(2);
  if (findErr) {
    fail('Не удалось подключиться к базе — запущен ли docker compose?');
  }
  if (!doctors || doctors.length === 0) {
    fail('Аккаунт ещё не создан — откройте сайт.');
  }
  if (doctors.length > 1) {
    fail('В базе больше одного врача — режим «один врач» этого не допускает.');
  }
  const doctor = doctors[0];

  const password = crypto.randomBytes(12).toString('base64url');
  const now = new Date();
  const update: Record<string, unknown> = {
    password: bcrypt.hashSync(password, 10),
    sessions_valid_after: new Date(Math.floor(now.getTime() / 1000) * 1000).toISOString(),
  };
  if (disable2fa) {
    update.is_two_factor_enabled = false;
    update.two_factor_secret = null;
  }
  const { error: updErr } = await db.from('doctors').update(update).eq('id', doctor.id);
  if (updErr) {
    fail('Не удалось сохранить новый пароль — пароль не изменён.');
  }

  let revokeFailed = false;
  try {
    const { error } = await db
      .from('refresh_tokens')
      .update({ revoked_at: now.toISOString() })
      .eq('doctor_id', doctor.id)
      .is('revoked_at', null);
    if (error) revokeFailed = true;
  } catch {
    revokeFailed = true;
  }

  console.log(`Email:  ${doctor.email}`);
  console.log(`Пароль: ${password}`);
  console.log('Пароль показан один раз. После входа смените его в личном кабинете.');
  if (disable2fa) console.log('Двухфакторная защита выключена.');

  if (revokeFailed) {
    console.error('');
    console.error('ВНИМАНИЕ: не удалось отозвать токены «Запомнить меня». Пароль изменён, но уже');
    console.error('выданные токены могут ещё действовать. Повторите команду, когда база станет доступна.');
    process.exit(1);
  }
}

main().catch(() => fail('Не удалось выполнить сброс — проверьте, что база запущена (docker compose up).'));
