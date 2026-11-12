// DhaherOS control plane — persistence (bun:sqlite) + state machine + event log append-only
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { DATA_DIR } from "./paths";

mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(`${DATA_DIR}/dhaheros.db`);
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  goal TEXT NOT NULL,
  workspace TEXT NOT NULL,
  command TEXT NOT NULL,
  criteria TEXT,
  timeout_sec INTEGER NOT NULL DEFAULT 60,
  state TEXT NOT NULL DEFAULT 'planned',
  idempotency_key TEXT UNIQUE,
  attempt INTEGER NOT NULL DEFAULT 1,
  budget_sec INTEGER,
  runtime_used_ms INTEGER NOT NULL DEFAULT 0,
  runtime TEXT NOT NULL DEFAULT 'bun',
  worker_id TEXT,
  last_heartbeat TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS globals (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  task_id TEXT,
  type TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_task ON events(task_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
`);

// Fase 10 (task 58-b, AT-TR-01 — plan AT-18): kolom korelasi trace — trace_id unik per task,
// attempt_id naik per retry. Semua kolom ditambah via ALTER idempotent (blok migrasi bawah)
// agar db lama tetap kompatibel — tanpa env/env-baru, perilaku lama utuh.

export interface TaskRow {
  id: string;
  goal: string;
  workspace: string;
  command: string;
  criteria: string | null;
  timeout_sec: number;
  state: string;
  idempotency_key: string | null;
  attempt: number | null; // percobaan ke-n (retry/reconcile menambah); NULL utk baris lama
  budget_sec: number | null; // budget runtime kumulatif per task (AT-12 penuh); NULL = tanpa budget
  runtime_used_ms: number | null; // akumulasi wall-clock seluruh attempt
  runtime: string | null; // adapter runtime eksekusi ('bun' | 'node'); NULL = baris lama (bun)
  worker_id: string | null; // Fase 9: identitas worker yang mengklaim (claim/report); NULL = belum diklaim / task inline
  last_heartbeat: string | null; // Fase 9: heartbeat terakhir worker pengklaim (ISO ts); NULL = belum ada heartbeat
  trace_id: string | null; // Fase 10 (AT-TR-01): korelasi task↔events↔artifacts — unik per task
  attempt_id: number | null; // Fase 10 (AT-TR-01): mirror attempt (naik per retry); NULL = baris lama
  reserved_ms: number | null; // Fase 10 (AT-RC-01): reservasi budget global aktif utk task ini (ms); 0/null = tidak mereservasi
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: number;
  ts: string;
  task_id: string | null;
  type: string;
  payload: string;
  trace_id: string | null; // Fase 10 (AT-TR-01): sama dgn trace_id task pemiliknya (null utk event sistem/baris lama)
  attempt_id: number | null; // Fase 10 (AT-TR-01): attempt task saat event dicatat
}

// State machine: transisi invalid ditolak (event transition_denied dicatat).
// failed→planned HANYA via POST /api/tasks/:id/retry (wajib idempotency_key + budget tersisa).
// uncertain→planned HANYA via POST /api/tasks/:id/reconcile (wajib idempotency_key —
// re-run aman krn idempoten; tanpa key = butuh keputusan manusia, task tetap uncertain).
export const TRANSITIONS: Record<string, string[]> = {
  planned: ["running", "cancelled"],
  running: ["succeeded", "failed", "cancelled", "uncertain"],
  uncertain: ["planned"],
  succeeded: [],
  failed: ["planned"],
  cancelled: [],
};

const now = () => new Date().toISOString();

export function getTask(id: string): TaskRow | null {
  return (db.query("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow) ?? null;
}

export function listTasks(): TaskRow[] {
  return db.query("SELECT * FROM tasks ORDER BY created_at ASC, id ASC").all() as TaskRow[];
}

export function findTaskByIdempotencyKey(key: string): TaskRow | null {
  return (
    (db.query("SELECT * FROM tasks WHERE idempotency_key = ?").get(key) as TaskRow) ?? null
  );
}

export interface NewTask {
  id: string;
  goal: string;
  workspace: string;
  command: string;
  criteria: string | null;
  timeout_sec: number;
  idempotency_key: string | null;
  budget_sec: number | null;
  runtime: string;
  reserved_ms?: number | null; // Fase 10 (AT-RC-01): reservasi budget global saat create (opsional)
  trace_id?: string | null; // Fase 10 (AT-TR-01): boleh diisi pemanggil; default digenerate di sini
}

export function insertTask(t: NewTask): void {
  const ts = now();
  const traceId = t.trace_id ?? crypto.randomUUID(); // AT-TR-01: trace_id unik per task
  const reserved = t.reserved_ms ?? 0;
  db.run(
    "INSERT INTO tasks (id, goal, workspace, command, criteria, timeout_sec, state, idempotency_key, attempt, budget_sec, runtime_used_ms, runtime, trace_id, attempt_id, reserved_ms, created_at, updated_at) VALUES (?,?,?,?,?,?,'planned',?,1,?,0,?,?,1,?,?,?)",
    [t.id, t.goal, t.workspace, t.command, t.criteria, t.timeout_sec, t.idempotency_key, t.budget_sec, t.runtime, traceId, reserved, ts, ts]
  );
}

// AT-TR-01: event milik task otomatis mewarisi trace_id + attempt_id task-nya (korelasi
// konsisten); event sistem (task_id NULL) → trace_id NULL. Baris lama tanpa kolom → NULL.
export function insertEvent(taskId: string | null, type: string, payload: Record<string, unknown>): void {
  let traceId: string | null = null;
  let attemptId: number | null = null;
  if (taskId) {
    const t = db.query("SELECT trace_id, attempt FROM tasks WHERE id = ?").get(taskId) as
      | { trace_id: string | null; attempt: number | null }
      | null;
    if (t) {
      traceId = t.trace_id ?? null;
      attemptId = t.attempt ?? null;
    }
  }
  db.run("INSERT INTO events (ts, task_id, type, payload, trace_id, attempt_id) VALUES (?,?,?,?,?,?)", [
    now(),
    taskId,
    type,
    JSON.stringify(payload),
    traceId,
    attemptId,
  ]);
}

export function listEvents(opts: {
  taskId?: string;
  type?: string;
  fromTs?: string;
  toTs?: string;
  limit?: number;
}): EventRow[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.taskId !== undefined) {
    where.push("task_id = ?");
    params.push(opts.taskId);
  }
  if (opts.type !== undefined) {
    where.push("type = ?");
    params.push(opts.type);
  }
  if (opts.fromTs !== undefined) {
    where.push("ts >= ?");
    params.push(opts.fromTs);
  }
  if (opts.toTs !== undefined) {
    where.push("ts <= ?");
    params.push(opts.toTs);
  }
  const sql = `SELECT * FROM events ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id ASC LIMIT ?`;
  params.push(opts.limit ?? 500);
  return db.query(sql).all(...params) as EventRow[];
}

// Ringkasan audit: hitung event per type dalam rentang ts (inklusif).
export function summarizeEvents(fromTs?: string, toTs?: string): {
  count: number;
  by_type: Record<string, number>;
  first_ts: string | null;
  last_ts: string | null;
} {
  const where: string[] = [];
  const params: string[] = [];
  if (fromTs !== undefined) {
    where.push("ts >= ?");
    params.push(fromTs);
  }
  if (toTs !== undefined) {
    where.push("ts <= ?");
    params.push(toTs);
  }
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const rows = db
    .query(`SELECT type, COUNT(*) AS n FROM events ${w} GROUP BY type ORDER BY type`)
    .all(...params) as { type: string; n: number }[];
  const bounds = db
    .query(`SELECT MIN(ts) AS a, MAX(ts) AS b, COUNT(*) AS n FROM events ${w}`)
    .get(...params) as { a: string | null; b: string | null; n: number };
  const by_type: Record<string, number> = {};
  for (const r of rows) by_type[r.type] = r.n;
  return { count: bounds.n, by_type, first_ts: bounds.a, last_ts: bounds.b };
}

// ---- globals (budget global AT-12) ----
export function getGlobal(key: string): string | null {
  const r = db.query("SELECT value FROM globals WHERE key = ?").get(key) as { value: string } | null;
  return r?.value ?? null;
}

export function setGlobal(key: string, value: string): void {
  db.run(
    "INSERT INTO globals (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

// Akumulasi runtime satu attempt: ke baris task (budget per task) + ke globals (budget global).
export function addRuntime(id: string, ms: number): void {
  db.run("UPDATE tasks SET runtime_used_ms = COALESCE(runtime_used_ms,0) + ? WHERE id = ?", [ms, id]);
  const prev = Number(getGlobal("runtime_used_ms") ?? "0");
  setGlobal("runtime_used_ms", String(prev + ms));
}

export function bumpAttempt(id: string): number {
  db.run(
    "UPDATE tasks SET attempt = COALESCE(attempt,1) + 1, attempt_id = COALESCE(attempt,1) + 1, updated_at = ? WHERE id = ?",
    [now(), id]
  );
  const t = getTask(id);
  return t?.attempt ?? 1;
}

// ---- Fase 10 (AT-RC-01, plan AT-24): reservasi budget global ATOMIK ----
// Dua POST /api/tasks bersamaan dgn sisa budget hanya utk 1 → tepat satu yang berhasil
// mereservasi; yang lain ditolak budget_exhausted. BEGIN IMMEDIATE memaksa serialisasi
// check-and-set di level SQLite (bukan read-modify-write yang bisa balapan).
// Task TANPA budget_sec tidak mereservasi (perilaku lama persis: deny saat used >= cap).
export interface BudgetReservationResult {
  ok: boolean;
  usedMs: number;
  reservedMs: number;
  capMs: number;
  reason?: string;
}

export function reserveGlobalBudget(reserveMs: number, capSec: number): BudgetReservationResult {
  const capMs = capSec * 1000;
  try {
    db.exec("BEGIN IMMEDIATE");
    const usedMs = Number(getGlobal("runtime_used_ms") ?? "0");
    const reservedMs = Number(getGlobal("budget_reserved_ms") ?? "0");
    let denied: string | null = null;
    if (reserveMs <= 0) {
      // tanpa reservasi → semantik lama PERSIS (AT-18 tetap PASS)
      if (usedMs >= capMs) denied = "global_budget_exhausted";
    } else {
      // dgn reservasi: total (terpakai + tereservasi + permintaan) tidak boleh melewati cap
      if (usedMs >= capMs || usedMs + reservedMs + reserveMs > capMs) {
        denied = "global_budget_exhausted";
      }
    }
    if (denied) {
      db.exec("ROLLBACK");
      return { ok: false, usedMs, reservedMs, capMs, reason: denied };
    }
    if (reserveMs > 0) {
      setGlobal("budget_reserved_ms", String(reservedMs + reserveMs));
    }
    db.exec("COMMIT");
    return { ok: true, usedMs, reservedMs, capMs };
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* tidak dalam transaksi */
    }
    return {
      ok: false,
      usedMs: Number(getGlobal("runtime_used_ms") ?? "0"),
      reservedMs: Number(getGlobal("budget_reserved_ms") ?? "0"),
      capMs,
      reason: `reservation_error: ${String(e)}`,
    };
  }
}

// Lepas reservasi saat task mencapai state terminal (succeeded/failed/cancelled).
// Rekursi ke reservation pool dilindungi floor-0 (tanpa nilai negatif).
function releaseReservation(taskId: string): void {
  const t = getTask(taskId);
  if (!t || !t.reserved_ms || t.reserved_ms <= 0) return;
  try {
    db.exec("BEGIN IMMEDIATE");
    const pool = Number(getGlobal("budget_reserved_ms") ?? "0");
    setGlobal("budget_reserved_ms", String(Math.max(0, pool - t.reserved_ms)));
    db.run("UPDATE tasks SET reserved_ms = 0 WHERE id = ?", [taskId]);
    db.exec("COMMIT");
  } catch {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
  }
}

// Pulihkan reservasi saat retry/reconcile mengembalikan task ke planned (budget task tetap dipegang
// selama task belum terminal final). Tanpa cap-check: reservasi ini sebelumnya sudah dipegang.
function restoreReservation(taskId: string): void {
  const t = getTask(taskId);
  if (!t || !t.budget_sec || (t.budget_sec ?? 0) <= 0) return;
  if ((t.reserved_ms ?? 0) > 0) return; // belum pernah dilepas (uncertain→planned) → tidak dobel
  const amount = (t.budget_sec as number) * 1000;
  try {
    db.exec("BEGIN IMMEDIATE");
    const pool = Number(getGlobal("budget_reserved_ms") ?? "0");
    setGlobal("budget_reserved_ms", String(pool + amount));
    db.run("UPDATE tasks SET reserved_ms = ? WHERE id = ?", [amount, taskId]);
    db.exec("COMMIT");
  } catch {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
  }
}

// ---- Fase 10 (AT-ENT-01): hook ketika task mencapai state terminal ----
// Dipakai task_dependencies utk melepas child yang menunggu parent terminal.
// Registry diisi module lain (entities.ts) — db.ts tidak meng-import module tsb (tanpa cycle).
type TerminalHook = (taskId: string) => void;
const terminalHooks: TerminalHook[] = [];
export function registerTerminalHook(fn: TerminalHook): void {
  terminalHooks.push(fn);
}
function runTerminalHooks(taskId: string): void {
  for (const h of terminalHooks) {
    try {
      h(taskId);
    } catch {
      /* hook jangan pernah menggagalkan transisi state */
    }
  }
}

// Semua transisi state = event append-only. Return false bila transisi ditolak.
export function transitionTo(
  id: string,
  to: string,
  type: string,
  payload: Record<string, unknown>
): boolean {
  const t = getTask(id);
  if (!t) {
    insertEvent(id, "transition_denied", { reason: "task_not_found", to });
    return false;
  }
  const allowed = TRANSITIONS[t.state] ?? [];
  if (!allowed.includes(to)) {
    insertEvent(id, "transition_denied", { from: t.state, to, attempted_type: type });
    return false;
  }
  db.run("UPDATE tasks SET state = ?, updated_at = ? WHERE id = ?", [to, now(), id]);
  insertEvent(id, type, { ...payload, from: t.state, to });
  // Fase 10 (AT-RC-01): siklus hidup reservasi budget global.
  if (to === "succeeded" || to === "failed" || to === "cancelled") {
    releaseReservation(id);
  }
  if (to === "planned" && (t.state === "failed" || t.state === "uncertain")) {
    restoreReservation(id); // retry/reconcile — reservasi dipegang lagi sampai terminal
  }
  // Fase 10 (AT-ENT-01): terminal → lepas dependen yang menunggu (child planned → dieksekusi).
  if (to === "succeeded" || to === "failed" || to === "cancelled") {
    runTerminalHooks(id);
  }
  return true;
}

// Migrasi ringan utk db lama (sebelum slice-2): tambah kolom bila belum ada.
for (const ddl of [
  "ALTER TABLE tasks ADD COLUMN attempt INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE tasks ADD COLUMN budget_sec INTEGER",
  "ALTER TABLE tasks ADD COLUMN runtime_used_ms INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE tasks ADD COLUMN runtime TEXT NOT NULL DEFAULT 'bun'",
  "ALTER TABLE tasks ADD COLUMN worker_id TEXT",
  "ALTER TABLE tasks ADD COLUMN last_heartbeat TEXT",
  // Fase 10 (task 58-b): korelasi trace (AT-TR-01) + reservasi budget (AT-RC-01)
  "ALTER TABLE tasks ADD COLUMN trace_id TEXT",
  "ALTER TABLE tasks ADD COLUMN attempt_id INTEGER",
  "ALTER TABLE tasks ADD COLUMN reserved_ms INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE events ADD COLUMN trace_id TEXT",
  "ALTER TABLE events ADD COLUMN attempt_id INTEGER",
  "CREATE TABLE IF NOT EXISTS globals (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_events_trace ON events(trace_id)",
]) {
  try {
    db.exec(ddl);
  } catch {
    /* kolom/tabel sudah ada */
  }
}
// Backfill: baris lama tanpa trace_id → trace_id = id task (korelasi tetap bisa diikuti).
try {
  db.exec("UPDATE tasks SET trace_id = id WHERE trace_id IS NULL");
  db.exec("UPDATE tasks SET attempt_id = COALESCE(attempt,1) WHERE attempt_id IS NULL");
  db.exec("UPDATE tasks SET reserved_ms = 0 WHERE reserved_ms IS NULL");
} catch {
  /* db fresh — tak ada backfill */
}

// Recovery saat boot (AT-02): running → uncertain + event recovery. Tidak ada sukses palsu.
export function recoverRunningTasks(): number {
  const rows = db.query("SELECT id FROM tasks WHERE state = 'running'").all() as { id: string }[];
  for (const r of rows) {
    db.run("UPDATE tasks SET state = 'uncertain', updated_at = ? WHERE id = ?", [now(), r.id]);
    insertEvent(r.id, "recovery", {
      from: "running",
      to: "uncertain",
      reason:
        "service restart: aliveness proses tidak diketahui; state tidak dipalsukan sukses (AT-02); butuh rekonsiliasi",
    });
  }
  return rows.length;
}
