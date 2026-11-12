// DhaherOS scheduler internal (Fase 8 slice-2 — operasi otonom iris aman, AT-SC).
// Trigger interval TANPA cron eksternal; semua deny/skip ter-audit (event append-only);
// kill switch global dicek SEBELUM create task; dedup via idempotency key per window
// (header x-idempotency-key → task yang sama tidak dobel); budget AT-12 berlaku penuh
// karena trigger memanggil POST /api/tasks control plane (127.0.0.1 — zero-egress).
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { db, insertEvent, setGlobal, getGlobal } from "./db";
import { CAPABILITIES, checkCapability, type CapabilityCheckResult } from "./org";
import { WS_ROOT, PORT, isInside, commandPathViolations, MAX_TIMEOUT, MAX_BUDGET_SEC } from "./paths";

const now = () => new Date().toISOString();
const MIN_INTERVAL_SEC = 2;   // iris aman: cukup utk uji & tidak membanjiri; produksi ≥60 disarankan
const MAX_INTERVAL_SEC = 86400;

db.exec(`
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  workspace TEXT NOT NULL,
  command TEXT NOT NULL,
  interval_sec INTEGER NOT NULL,
  owner_org TEXT,
  owner_subject TEXT,
  capability TEXT,
  timeout_sec INTEGER NOT NULL DEFAULT 60,
  budget_sec INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  next_run_at TEXT NOT NULL,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_schedules_next ON schedules(next_run_at);
`);

export interface ScheduleRow {
  id: string; name: string; workspace: string; command: string; interval_sec: number;
  owner_org: string | null; owner_subject: string | null; capability: string | null;
  timeout_sec: number; budget_sec: number | null; enabled: number;
  last_run_at: string | null; next_run_at: string; trigger_count: number;
  created_at: string; updated_at: string;
}

export function listSchedules(): ScheduleRow[] {
  return db.query("SELECT * FROM schedules ORDER BY created_at").all() as unknown as ScheduleRow[];
}
export function getSchedule(id: string): ScheduleRow | null {
  return (db.query("SELECT * FROM schedules WHERE id = ? OR name = ?").get(id, id) as unknown as ScheduleRow) ?? null;
}

export interface CreateResult { status: number; body: Record<string, unknown> }

function deny(kind: string, status: number, extra: Record<string, unknown>): CreateResult {
  insertEvent(null, "schedule_denied", { reason: kind, ...extra });
  return { status, body: { error: `schedule ditolak: ${kind}`, ...(extra.detail ?? {}), reason: kind } };
}

export function createSchedule(body: Record<string, unknown>): CreateResult {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const workspace = typeof body.workspace === "string" ? body.workspace : "";
  const command = typeof body.command === "string" ? body.command : "";
  const interval = body.interval_sec;

  if (!name || name.length > 100) return deny("bad_name", 400, { name });
  if (getSchedule(name)) return deny("duplicate_name", 400, { name });
  if (!Number.isInteger(interval) || (interval as number) < MIN_INTERVAL_SEC || (interval as number) > MAX_INTERVAL_SEC) {
    return deny("bad_interval", 400, { interval_sec: interval, min: MIN_INTERVAL_SEC, max: MAX_INTERVAL_SEC });
  }

  const wsResolved = path.resolve(workspace);
  if (!isInside(wsResolved, WS_ROOT)) return deny("workspace_outside_allowed_root", 400, { workspace });
  if (!existsSync(wsResolved) || !statSync(wsResolved).isDirectory()) {
    return deny("workspace_missing", 400, { workspace: wsResolved });
  }
  if (!command.trim() || command.length > 4000) return deny("bad_command", 400, {});
  const violations = commandPathViolations(command, wsResolved);
  if (violations.length > 0) return deny("path_outside_workspace", 403, { violations, command });

  // capability wajib ada di whitelist registry (Fase 5) bila owner disandikan
  const ownerOrg = body.owner_org === undefined ? null : String(body.owner_org ?? "").trim() || null;
  const ownerSubject = body.owner_subject === undefined ? null : String(body.owner_subject ?? "").trim() || null;
  const capability = body.capability === undefined ? null : String(body.capability ?? "").trim() || null;
  if (ownerOrg !== null || ownerSubject !== null || capability !== null) {
    if (ownerOrg === null || ownerSubject === null || capability === null) {
      return deny("owner_partial", 400, { owner_org: ownerOrg, owner_subject: ownerSubject, capability });
    }
    if (!(CAPABILITIES as readonly string[]).includes(capability)) {
      return deny("unknown_capability", 400, { capability });
    }
    const o = db.query("SELECT id FROM orgs WHERE id = ? OR name = ?").get(ownerOrg, ownerOrg) as { id: string } | null;
    if (!o) return deny("unknown_org_ref", 400, { owner_org: ownerOrg });
  }

  const timeout = body.timeout_sec === undefined ? 60 : body.timeout_sec;
  if (!Number.isInteger(timeout) || (timeout as number) < 1) return deny("bad_timeout", 400, { timeout_sec: timeout });
  if ((timeout as number) > MAX_TIMEOUT) return deny("timeout_cap_exceeded", 400, { cap: MAX_TIMEOUT });
  const budget = body.budget_sec === undefined ? null : body.budget_sec;
  if (budget !== null && (!Number.isInteger(budget) || (budget as number) < 1)) return deny("bad_budget", 400, { budget_sec: budget });
  if (budget !== null && (budget as number) > MAX_BUDGET_SEC) return deny("budget_cap_exceeded", 400, { cap: MAX_BUDGET_SEC });

  const id = crypto.randomUUID();
  const t = now();
  const next = new Date(Date.now() + (interval as number) * 1000).toISOString();
  db.run(
    `INSERT INTO schedules (id,name,workspace,command,interval_sec,owner_org,owner_subject,capability,timeout_sec,budget_sec,enabled,last_run_at,next_run_at,trigger_count,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,1,NULL,?,0,?,?)`,
    [id, name, wsResolved, command, interval, ownerOrg, ownerSubject, capability, timeout, budget, next, t, t]
  );
  insertEvent(id, "schedule_created", {
    name, workspace: wsResolved, interval_sec: interval, owner_org: ownerOrg,
    owner_subject: ownerSubject, capability, timeout_sec: timeout, budget_sec: budget, next_run_at: next,
  });
  return { status: 201, body: { schedule: getSchedule(id), note: `trigger tiap ${interval}s via control plane :${PORT}` } };
}

export function deleteSchedule(id: string): { status: number; body: Record<string, unknown> } {
  const s = getSchedule(id);
  if (!s) return { status: 404, body: { error: "schedule tidak ditemukan" } };
  db.run("DELETE FROM schedules WHERE id = ?", [s.id]);
  insertEvent(s.id, "schedule_deleted", { name: s.name });
  return { status: 200, body: { deleted: true, id: s.id, name: s.name } };
}

export function setScheduleEnabled(id: string, enabled: boolean): { status: number; body: Record<string, unknown> } {
  const s = getSchedule(id);
  if (!s) return { status: 404, body: { error: "schedule tidak ditemukan" } };
  db.run("UPDATE schedules SET enabled = ?, updated_at = ? WHERE id = ?", [enabled ? 1 : 0, now(), s.id]);
  insertEvent(s.id, enabled ? "schedule_enabled" : "schedule_disabled", { name: s.name });
  return { status: 200, body: { schedule: getSchedule(s.id) } };
}

// ---- kill switch global (persist di globals; ter-audit) ----
export function schedulerEnabled(): boolean {
  return (getGlobal("scheduler_enabled") ?? "1") === "1";
}
export function setKillSwitch(enabled: boolean): Record<string, unknown> {
  setGlobal("scheduler_enabled", enabled ? "1" : "0");
  insertEvent(null, "scheduler_kill_switch", { enabled, ts: now() });
  return { enabled, note: enabled ? "scheduler aktif" : "kill switch AKTIF — tidak ada trigger baru (schedules tetap tersimpan)" };
}
export function schedulerStatus(): Record<string, unknown> {
  const rows = listSchedules();
  return {
    enabled: schedulerEnabled(),
    schedules: rows.length,
    active: rows.filter((r) => r.enabled === 1).length,
    total_triggers: rows.reduce((a, r) => a + r.trigger_count, 0),
    ts: now(),
  };
}

// ---- tick loop (interval 1s, dipanggil dari boot index.ts) ----
async function triggerOne(s: ScheduleRow): Promise<void> {
  // dedup: key per window interval — task kedua dgn key sama → idempotent (tidak dobel)
  const bucket = Math.floor(Date.now() / 1000 / s.interval_sec);
  const dedupKey = `sched-${s.id}-${bucket}`;
  // kill switch dicek PALING AWAL di jalur trigger — SEBELUM capability & SEBELUM create task
  if (!schedulerEnabled()) {
    insertEvent(s.id, "scheduler_skipped", { reason: "kill_switch", dedup_key: dedupKey });
    return;
  }
  // izin org (Fase 5) — deny → no-op jujur ter-audit, TANPA task
  if (s.owner_org && s.owner_subject && s.capability) {
    const chk: CapabilityCheckResult = checkCapability(s.owner_org, s.owner_subject, s.capability);
    if (!chk.allowed) {
      insertEvent(s.id, "scheduler_skipped", { reason: "capability_denied", deny_reason: chk.reason, capability: s.capability, dedup_key: dedupKey });
      return;
    }
  }
  try {
    const resp = await fetch(`http://127.0.0.1:${PORT}/api/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-idempotency-key": dedupKey },
      body: JSON.stringify({
        goal: `schedule:${s.name}`,
        workspace: s.workspace,
        command: s.command,
        timeout_sec: s.timeout_sec,
        ...(s.budget_sec !== null ? { budget_sec: s.budget_sec } : {}),
        ...(s.owner_org && s.owner_subject && s.capability
          ? { capability_context: { org: s.owner_org, subject: s.owner_subject, capability: s.capability } }
          : {}),
      }),
    });
    const j = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    if (resp.status === 201 || resp.status === 200) {
      const task = (j.task ?? {}) as Record<string, unknown>;
      db.run("UPDATE schedules SET last_run_at = ?, trigger_count = trigger_count + 1, updated_at = ? WHERE id = ?", [now(), now(), s.id]);
      insertEvent(s.id, "schedule_trigger", {
        name: s.name, task_id: task.id ?? null, dedup_key: dedupKey,
        idempotent: resp.status === 200, http: resp.status,
      });
    } else if (resp.status === 403) {
      insertEvent(s.id, "scheduler_skipped", { reason: "task_denied_forbidden", detail: j.error ?? null, dedup_key: dedupKey });
    } else {
      insertEvent(s.id, "scheduler_error", { http: resp.status, detail: j.error ?? null, dedup_key: dedupKey });
    }
  } catch (e) {
    insertEvent(s.id, "scheduler_error", { detail: String(e), dedup_key: dedupKey });
  }
}

async function tick(): Promise<void> {
  const due = db
    .query("SELECT * FROM schedules WHERE enabled = 1 AND next_run_at <= ?")
    .all(now()) as unknown as ScheduleRow[];
  for (const s of due) {
    // advance dulu (anti double-trigger saat fetch lambat / crash di tengah tick)
    const next = new Date(Date.now() + s.interval_sec * 1000).toISOString();
    db.run("UPDATE schedules SET next_run_at = ?, updated_at = ? WHERE id = ?", [next, now(), s.id]);
    await triggerOne(s);
  }
}

export function startScheduler(): void {
  const t = setInterval(() => { void tick(); }, 1000);
  if (typeof t.unref === "function") t.unref();
  insertEvent(null, "scheduler_boot", { enabled: schedulerEnabled(), schedules: listSchedules().length, min_interval_sec: MIN_INTERVAL_SEC, ts: now() });
}
