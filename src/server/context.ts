import "./config";
import { createDb } from "./db";

// Клиент PostgREST с ролью service_role: используется для всех серверных операций с данными
export const db = createDb();

// Схема БД создаётся при первом старте Postgres из db/initdb/
