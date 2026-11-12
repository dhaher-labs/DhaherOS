// DhaherOS control plane — REST API (Bun.serve), port 3031 hardcoded, zero external deps.
// Boot: recovery running→uncertain (AT-02), event service_boot.
import { existsSync, statSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  PORT,
  WS_ROOT,
  ROOT,
  DEFAULT_TIMEOUT,
  MAX_TIMEOUT,
  MAX_BUDGET_SEC,
  GLOBAL_BUDGET_SEC,
  isInside,
  commandPathViolations,
} from "./paths";
import {
  db,
  getTask,
  listTasks,
  listEvents,
  summarizeEvents,
  insertTask,
  insertEvent,
  findTaskByIdempotencyKey,
  recoverRunningTasks,
  getGlobal,
  bumpAttempt,
  transitionTo,
  reserveGlobalBudget,
  TRANSITIONS,
} from "./db";
import { runTask, requestCancel, artifactsDir, listArtifacts } from "./executor";
import { RUNTIME_NAMES } from "./adapters";
import { ingestSource, searchKnowledge, revokeSource, listSources } from "./knowledge";
import {
  createDependency,
  listDependenciesForChild,
  createDecision,
  listDecisions,
  getDecision,
  createEvalRun,
  listEvalRuns,
  type Denial as EntityDenial,
} from "./entities";
import {
  createMemory,
  listMemory,
  getMemory,
  revokeMemory,
  searchMemory,
  type Denial as MemoryDenial,
} from "./memory";
import { createOrg, listOrgs, getOrg, checkCapability, validateCapabilityContext, CapabilityContext, type Denial } from "./org";
import {
  createWorkflowTemplate,
  getWorkflow,
  listWorkflows,
  bindPolicy,
  listBindings,
  startWorkflowRun,
} from "./workflow";
import { createProvider, getProvider, listProviders, testProvider, setSecret, listSecrets } from "./providers";
import {
  createSchedule, listSchedules, getSchedule, deleteSchedule, setScheduleEnabled,
  setKillSwitch, schedulerEnabled, schedulerStatus, startScheduler,
} from "./scheduler";
// Fase 9 slice-1: protokol kerjasama agent otonom (claim/heartbeat/report + registry seat)
import { claimTask, heartbeatTask, reportTask } from "./worker";

const now = () => new Date().toISOString();

// ---- Fase 10 (AT-DE-01, plan AT-45): health degraded ----
// Health menampilkan status "degraded" bila ada task running yang stuck melebihi threshold
// (env DHOS_DEGRADED_STUCK_SEC, default 600 — tidak akan tersentuh test lama dgn task pendek)
// ATAU watchdog daemon turun (hanya dinilai saat daemon mode aktif — ops/.daemon.stop ABSENT;
// selama verify stop file dipasang di preflight → komponen ini di-skip, deterministik).
// Health TETAP HTTP 200 (curl -sf start_service tidak terganggu) — degraded hanya di body +
// event audit health_degraded (emit sekali per flip ok→degraded).
const DEGRADED_STUCK_SEC = (() => {
  const n = Number(process.env.DHOS_DEGRADED_STUCK_SEC);
  return Number.isFinite(n) && n > 0 ? n : 600;
})();
let lastHealthStatus: "ok" | "degraded" = "ok";

function computeHealthStatus(): { status: "ok" | "degraded"; reasons: string[]; details: Record<string, unknown> } {
  const reasons: string[] = [];
  const details: Record<string, unknown> = {};
  // (1) task stuck: running lebih lama dari threshold (updated_at tak berubah selama running).
  const stuck = db
    .query(
      `SELECT id, goal, updated_at FROM tasks
       WHERE state = 'running' AND updated_at <= ?
       ORDER BY updated_at ASC LIMIT 5`
    )
    .all(new Date(Date.now() - DEGRADED_STUCK_SEC * 1000).toISOString()) as
    | { id: string; goal: string; updated_at: string }[]
    | [];
  if (stuck.length > 0) {
    reasons.push("task_stuck_running");
    details.stuck_tasks = stuck.map((t) => ({ id: t.id, goal: t.goal, since: t.updated_at }));
    details.stuck_threshold_sec = DEGRADED_STUCK_SEC;
  }
  // (2) watchdog daemon: hanya saat mode daemon aktif (kill-switch ABSENT).
  if (!existsSync(path.join(ROOT, "ops", ".daemon.stop"))) {
    const pidFile = path.join(ROOT, "ops", ".daemon.pid");
    if (existsSync(pidFile)) {
      const pid = Number(readFileSync(pidFile, "utf8").trim());
      let alive = false;
      try {
        process.kill(pid, 0);
        alive = true;
      } catch {
        alive = false;
      }
      if (!alive) {
        reasons.push("daemon_watchdog_down");
        details.daemon_pid = pid;
      } else {
        // supervisor hidup → beat terakhir harus lebih segar dari 3× interval (default 30s)
        const beatLog = path.join(ROOT, "ops", "daemon_health.log");
        try {
          const ageMs = Date.now() - statSync(beatLog).mtimeMs;
          const interval = Number(process.env.DHOS_DAEMON_INTERVAL ?? 30);
          if (ageMs > 3 * interval * 1000 + 5000) {
            reasons.push("daemon_beat_stale");
            details.beat_age_ms = Math.round(ageMs);
          }
        } catch {
          /* log belum ada → belum cukup data; tidak dinyatakan degraded */
        }
      }
    } // pidfile tidak ada → daemon memang tidak dikelola; tidak degraded
  }
  return { status: reasons.length ? "degraded" : "ok", reasons, details };
}

// ---- boot recovery (AT-02) ----
const recovered = recoverRunningTasks();
insertEvent(null, "service_boot", {
  port: PORT,
  pid: process.pid,
  recovered_running_to_uncertain: recovered,
  ts: now(),
});
console.log(
  `[dhaheros-control-plane] listening on :${PORT} | recovery: ${recovered} task running→uncertain | global budget: ${GLOBAL_BUDGET_SEC}s`
);

// Fase 8 slice-2: scheduler internal (trigger interval iris aman, kill switch global)
// Fase 10 (task 58-b): instance scratch ter-audit (AT-BK-02 restore, AT-DE-01) bisa mematikan
// scheduler via DHOS_SCHED_DISABLED=1 supaya snapshot/restore tidak memicu trigger —
// instance utama (tanpa env) perilaku lama utuh.
if (process.env.DHOS_SCHED_DISABLED !== "1") {
  startScheduler();
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function createTask(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "body JSON tidak valid" }, 400);
  }

  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  const workspace = typeof body.workspace === "string" ? body.workspace : "";
  const command = typeof body.command === "string" ? body.command : "";
  const criteria = typeof body.criteria === "string" ? body.criteria : null;
  const timeout_sec = body.timeout_sec === undefined ? DEFAULT_TIMEOUT : body.timeout_sec;

  if (!goal) return json({ error: "goal wajib (string)" }, 400);
  if (!command.trim()) return json({ error: "command wajib (string)" }, 400);
  if (command.length > 4000) return json({ error: "command terlalu panjang (>4000)" }, 400);
  if (!Number.isInteger(timeout_sec) || (timeout_sec as number) < 1) {
    return json({ error: "timeout_sec harus integer >= 1" }, 400);
  }

  // AT-12 stop cap: timeout_sec > 600 ditolak + event denial.
  if ((timeout_sec as number) > MAX_TIMEOUT) {
    insertEvent(null, "task_denied", {
      reason: "timeout_cap_exceeded",
      timeout_sec,
      cap: MAX_TIMEOUT,
      note: "stop cap (AT-12): request ditolak, tidak ada task dibuat",
    });
    return json(
      { error: `timeout_sec ${timeout_sec} melebihi stop cap ${MAX_TIMEOUT} (AT-12)` },
      400
    );
  }

  // AT-12 penuh (slice-2): budget runtime kumulatif per task (opsional).
  const budget_sec = body.budget_sec === undefined ? null : body.budget_sec;
  if (budget_sec !== null && (!Number.isInteger(budget_sec) || (budget_sec as number) < 1)) {
    return json({ error: "budget_sec harus integer >= 1 (atau tidak diisi = tanpa budget)" }, 400);
  }
  if (budget_sec !== null && (budget_sec as number) > MAX_BUDGET_SEC) {
    insertEvent(null, "task_denied", {
      reason: "budget_cap_exceeded",
      budget_sec,
      cap: MAX_BUDGET_SEC,
      note: "budget cap (AT-12 penuh): request ditolak, tidak ada task dibuat",
    });
    return json({ error: `budget_sec ${budget_sec} melebihi cap ${MAX_BUDGET_SEC} (AT-12)` }, 400);
  }

  // Fase 3 (AT-41): adapter runtime berversi — whitelist tertutup; default 'bun'.
  const runtime = body.runtime === undefined ? "bun" : body.runtime;
  if (typeof runtime !== "string" || !RUNTIME_NAMES.includes(runtime)) {
    insertEvent(null, "task_denied", {
      reason: "invalid_runtime",
      runtime,
      allowed: RUNTIME_NAMES,
      note: "Fase 3: runtime tidak ada di whitelist adapter — tidak ada task dibuat",
    });
    return json(
      { error: `runtime tidak didukung: ${JSON.stringify(runtime)} (didukung: ${RUNTIME_NAMES.join(", ")})` },
      400
    );
  }

  // AT-12 penuh (slice-2): budget global — total runtime semua task vs cap global.
  const usedMs = Number(getGlobal("runtime_used_ms") ?? "0");
  if (usedMs >= GLOBAL_BUDGET_SEC * 1000) {
    insertEvent(null, "task_denied", {
      reason: "global_budget_exhausted",
      runtime_used_ms: usedMs,
      global_budget_sec: GLOBAL_BUDGET_SEC,
      note: "AT-12 penuh: tidak ada task baru sampai operator mereset budget",
    });
    return json(
      { error: `budget global habis (terpakai ${usedMs}ms >= cap ${GLOBAL_BUDGET_SEC}s, AT-12)` },
      403
    );
  }

  // Fase 5 (Tahap 5): capability_context opsional — task menyandikan org/role.
  // Jika ada → verifikasi kebijakan capability SEBELUM task dibuat: deny → 403 +
  // event task_denied(missing_capability) ter-audit, tidak ada task dibuat.
  let capCtx: CapabilityContext | null = null;
  if (body.capability_context !== undefined) {
    const c = body.capability_context as CapabilityContext;
    capCtx = { org: String(c?.org ?? ""), subject: String(c?.subject ?? ""), capability: String(c?.capability ?? "") };
    const den = validateCapabilityContext(capCtx);
    if (den) {
      insertEvent(null, "task_denied", {
        reason: "missing_capability",
        org: capCtx.org,
        subject: capCtx.subject,
        capability: capCtx.capability,
        why: (den.detail as { why?: string } | undefined)?.why,
        note: "Fase 5: kebijakan capability org — request ditolak, tidak ada task dibuat",
      });
      return json({ error: den.reason, ...(den.detail ?? {}) }, den.status);
    }
  }

  // Workspace WAJIB di bawah /home/z/my-project/dhaheros/workspaces/
  const wsResolved = path.resolve(workspace);
  if (!isInside(wsResolved, WS_ROOT)) {
    insertEvent(null, "task_denied", {
      reason: "workspace_outside_allowed_root",
      workspace,
      allowed_root: WS_ROOT,
    });
    return json({ error: `workspace harus berada di bawah ${WS_ROOT}` }, 400);
  }
  if (!existsSync(wsResolved) || !statSync(wsResolved).isDirectory()) {
    return json({ error: `workspace tidak ada / bukan direktori: ${wsResolved}` }, 400);
  }

  // Fase 10 (AT-ENT-01, plan §9 TaskDependency): depends_on opsional — child menunggu parent
  // terminal (succeeded/failed/cancelled). Validasi deny-by-default SEBELUM task dibuat.
  const dependsOn = typeof body.depends_on === "string" ? body.depends_on.trim() : "";
  if (dependsOn) {
    const parent = getTask(dependsOn);
    if (!parent) {
      insertEvent(null, "dependency_denied", {
        reason: "parent_task_not_found",
        parent_task_id: dependsOn,
        note: "AT-ENT-01: depends_on merujuk task yang tidak ada — tidak ada task dibuat",
      });
      return json({ error: `depends_on tidak ditemukan: ${dependsOn}` }, 400);
    }
  }

  // AT-08 idempotensi: key sama → task yang sama.
  const idem = req.headers.get("x-idempotency-key");
  if (idem) {
    const existing = findTaskByIdempotencyKey(idem);
    if (existing) return json({ task: existing, idempotent: true }, 200);
  }

  // AT-05/AT-06: command dengan path di luar workspace → ditolak + event denial.
  const violations = commandPathViolations(command, wsResolved);
  if (violations.length > 0) {
    insertEvent(null, "task_denied", {
      reason: "path_outside_workspace",
      workspace: wsResolved,
      violations,
      command,
      note: "deny-by-default (AT-05/AT-06): tidak ada task dibuat, tidak ada eksekusi",
    });
    return json(
      {
        error: "command menunjuk path di luar workspace — ditolak (deny-by-default)",
        violations,
      },
      403
    );
  }

  // Fase 9 slice-1: mode eksekusi — "worker" berarti task TETAP planned (tidak auto-run)
  // dan menunggu diklaim worker via POST /api/tasks/:id/claim. Default "inline" tak berubah
  // (langsung dieksekusi executor internal) — perilaku AT lama tidak tersentuh.
  const execution = body.execution === undefined ? "inline" : body.execution;
  if (execution !== "inline" && execution !== "worker") {
    insertEvent(null, "task_denied", {
      reason: "invalid_execution",
      execution,
      allowed: ["inline", "worker"],
      note: "Fase 9: mode eksekusi tidak dikenal — tidak ada task dibuat",
    });
    return json({ error: "execution harus 'inline' atau 'worker'" }, 400);
  }

  const id = crypto.randomUUID();

  // Fase 10 (AT-RC-01, plan AT-24): reservasi budget global ATOMIK (BEGIN IMMEDIATE di db.ts).
  // Dua POST bersamaan dgn sisa budget hanya cukup utk 1 → tepat satu yang berhasil; yang lain
  // ditolak budget_exhausted. Task tanpa budget_sec tidak mereservasi (semantik lama persis).
  const reserveMs = (budget_sec as number | null ?? 0) * 1000;
  const g = reserveGlobalBudget(reserveMs, GLOBAL_BUDGET_SEC);
  if (!g.ok) {
    insertEvent(null, "task_denied", {
      reason: "global_budget_exhausted",
      runtime_used_ms: g.usedMs,
      budget_reserved_ms: g.reservedMs,
      global_budget_sec: GLOBAL_BUDGET_SEC,
      note: "AT-12 + AT-RC-01 (plan AT-24): reservasi atomik gagal — sisa budget tidak cukup / sudah terpakai",
    });
    return json(
      { error: `budget global habis (terpakai ${g.usedMs}ms >= cap ${GLOBAL_BUDGET_SEC}s, AT-12)` },
      403
    );
  }

  insertTask({
    id,
    goal,
    workspace: wsResolved,
    command,
    criteria,
    timeout_sec: timeout_sec as number,
    idempotency_key: idem,
    budget_sec: budget_sec as number | null,
    runtime: runtime as string,
    reserved_ms: reserveMs,
  });
  insertEvent(id, "task_created", {
    goal,
    workspace: wsResolved,
    command,
    criteria,
    timeout_sec,
    budget_sec,
    idempotency_key: idem,
    runtime,
    execution,
    ...(dependsOn ? { depends_on: dependsOn } : {}),
    ...(capCtx ? { capability_context: capCtx } : {}),
  });

  // Fase 10 (AT-ENT-01): dependency gate — child planned sampai parent terminal.
  if (dependsOn) {
    const dep = createDependency(id, dependsOn);
    if ("status" in dep) {
      // Seharusnya tak terjadi (validasi pre-create) — defensif: batal + jangan eksekusi.
      insertEvent(id, "dependency_denied", { reason: (dep as EntityDenial).reason });
      return json({ error: (dep as EntityDenial).reason }, 400);
    }
    const parent = getTask(dependsOn);
    const parentState = parent?.state ?? "unknown";
    const released = parentState === "succeeded" || parentState === "failed" || parentState === "cancelled";
    if (!released) {
      return json(
        {
          task: getTask(id),
          dependency: dep,
          note: `planned — menunggu parent ${dependsOn} terminal (AT-ENT-01)`,
        },
        201
      );
    }
    // parent sudah terminal → release segera oleh createDependency (runTask dipanggil di sana)
    return json({ task: getTask(id), dependency: dep, note: "parent sudah terminal — child langsung jalan" }, 201);
  }

  // eksekusi async — API langsung balas dengan task state=planned/running
  if (execution === "worker") {
    // Fase 9: tanpa eksekusi internal — task menunggu worker mengklaim (protokol otonom).
    return json({ task: getTask(id), note: "planned — menunggu worker claim (execution=worker)" }, 201);
  }
  void runTask(id);

  return json({ task: getTask(id) }, 201);
}

function taskDetail(id: string): Response {
  const t = getTask(id);
  if (!t) return json({ error: "task tidak ditemukan" }, 404);
  const events = listEvents({ taskId: id }).map((e) => ({
    id: e.id,
    ts: e.ts,
    type: e.type,
    payload: JSON.parse(e.payload),
    trace_id: e.trace_id ?? null, // Fase 10 (AT-TR-01): korelasi trace per event
    attempt_id: e.attempt_id ?? null,
  }));
  return json({
    task: t,
    // Fase 10 (AT-TR-01): korelasi — SEMUA event + artifacts task berbagi trace_id yang sama.
    trace_id: t.trace_id ?? null,
    attempt_id: t.attempt_id ?? t.attempt ?? null,
    events,
    artifacts: listArtifacts(id),
    artifacts_dir: artifactsDir(id),
    dependencies: listDependenciesForChild(id), // Fase 10 (AT-ENT-01): gate parent → child
    state_machine: TRANSITIONS[t.state] ?? [],
  });
}

// ---- slice-2: retry idempotent (AT-08 lanjutan) ----
// Retry HANYA bila idempotensi diketahui (task punya idempotency_key) — re-run aman.
// Hanya dari state failed/uncertain; budget habis → ditolak dgn alasan (AT-12).
function retryTask(id: string): Response {
  const t = getTask(id);
  if (!t) return json({ error: "task tidak ditemukan" }, 404);
  if (!t.idempotency_key) {
    insertEvent(id, "retry_denied", {
      reason: "non_idempotent",
      state: t.state,
      note: "retry hanya bila idempotensi diketahui; tanpa key = efek re-run tidak bisa dipastikan",
    });
    return json(
      { error: "retry ditolak: task tanpa idempotency_key (retry hanya bila idempotensi diketahui)" },
      409
    );
  }
  if (t.state !== "failed" && t.state !== "uncertain") {
    insertEvent(id, "retry_denied", { reason: "state_not_retryable", state: t.state });
    return json({ error: `retry ditolak: state=${t.state} (hanya failed/uncertain)` }, 409);
  }
  if (t.budget_sec !== null && (t.runtime_used_ms ?? 0) >= t.budget_sec * 1000) {
    insertEvent(id, "retry_denied", {
      reason: "budget_exhausted",
      runtime_used_ms: t.runtime_used_ms,
      budget_sec: t.budget_sec,
      note: "AT-12 penuh: budget kumulatif habis, task berhenti permanen dgn alasan",
    });
    return json(
      {
        error: `retry ditolak: budget habis (runtime terpakai ${(t.runtime_used_ms ?? 0) / 1000}s >= budget ${t.budget_sec}s, AT-12)`,
      },
      409
    );
  }
  const attempt = bumpAttempt(id);
  const ok = transitionTo(id, "planned", "task_retry", {
    attempt,
    via: "POST /api/tasks/:id/retry",
    basis: "idempotency_key diketahui — re-run aman",
  });
  if (!ok) return json({ error: "transisi ditolak state machine" }, 409);
  void runTask(id);
  return json({ accepted: true, attempt, task: getTask(id), note: `attempt #${attempt} dimulai` }, 202);
}

// ---- slice-2: rekonsiliasi task uncertain (AT-02/AT-04 lanjutan) ----
// uncertain + idempotency_key → re-run idempoten = rekonsiliasi sah.
// uncertain tanpa key → tetap uncertain (butuh keputusan manusia); TIDAK ada sukses palsu.
function reconcileTask(id: string): Response {
  const t = getTask(id);
  if (!t) return json({ error: "task tidak ditemukan" }, 404);
  if (t.state !== "uncertain") {
    insertEvent(id, "transition_denied", {
      from: t.state,
      to: "planned",
      attempted_type: "task_reconciled",
      reason: "reconcile hanya untuk task uncertain",
    });
    return json({ error: `rekonsiliasi ditolak: state=${t.state} (hanya uncertain)` }, 409);
  }
  if (!t.idempotency_key) {
    insertEvent(id, "reconcile_denied", {
      reason: "non_idempotent_needs_human",
      state: t.state,
      note: "tanpa idempotency_key, akhir proses tidak bisa dipastikan → keputusan manusia; task tetap uncertain",
    });
    return json(
      { error: "rekonsiliasi ditolak: task non-idempoten → butuh keputusan manusia (tetap uncertain)" },
      409
    );
  }
  if (t.budget_sec !== null && (t.runtime_used_ms ?? 0) >= t.budget_sec * 1000) {
    insertEvent(id, "reconcile_denied", {
      reason: "budget_exhausted",
      runtime_used_ms: t.runtime_used_ms,
      budget_sec: t.budget_sec,
    });
    return json({ error: `rekonsiliasi ditolak: budget habis (AT-12)` }, 409);
  }
  const attempt = bumpAttempt(id);
  const ok = transitionTo(id, "planned", "task_reconciled", {
    attempt,
    via: "POST /api/tasks/:id/reconcile",
    basis: "idempotent_rerun — satu-satunya rekonsiliasi otomatis yang sah",
  });
  if (!ok) return json({ error: "transisi ditolak state machine" }, 409);
  void runTask(id);
  return json({ accepted: true, attempt, task: getTask(id), note: "rekonsiliasi via re-run idempoten" }, 202);
}

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const p = url.pathname;
  const method = req.method;

  if (method === "GET" && p === "/api/health") {
    // Fase 10 (AT-DE-01, plan AT-45): status ok|degraded — degraded bila task stuck > threshold
    // atau watchdog daemon turun (mode daemon aktif). HTTP tetap 200; flip ok→degraded ter-audit
    // event health_degraded (dan kembali ok → health_recovered).
    const h = computeHealthStatus();
    if (h.status !== lastHealthStatus) {
      if (h.status === "degraded") {
        insertEvent(null, "health_degraded", { reasons: h.reasons, detail: h.details, ts: now() });
      } else {
        insertEvent(null, "health_recovered", { note: "kondisi kembali ok", ts: now() });
      }
      lastHealthStatus = h.status;
    }
    return json({
      ok: true,
      service: "dhaheros-control-plane",
      port: PORT,
      ts: now(),
      status: h.status,
      degraded_reasons: h.reasons,
      degraded_detail: h.details,
    });
  }

  if (p === "/api/tasks" && method === "POST") return createTask(req);

  if (p === "/api/tasks" && method === "GET") {
    // Fase 9: filter state opsional (?state=planned dipakai worker untuk poll) —
    // tanpa query param perilaku persis sama seperti sebelumnya.
    const stateFilter = url.searchParams.get("state");
    const all = listTasks();
    const tasks = stateFilter ? all.filter((t) => t.state === stateFilter) : all;
    return json({ count: tasks.length, tasks });
  }

  const mDetail = p.match(/^\/api\/tasks\/([^/]+)$/);
  if (mDetail && method === "GET") return taskDetail(decodeURIComponent(mDetail[1]));

  const mCancel = p.match(/^\/api\/tasks\/([^/]+)\/cancel$/);
  if (mCancel && method === "POST") {
    const res = requestCancel(decodeURIComponent(mCancel[1]));
    return json(res.body, res.status);
  }

  // ---- Fase 9 slice-1: protokol kerjasama worker otonom (claim/heartbeat/report) ----
  const mClaim = p.match(/^\/api\/tasks\/([^/]+)\/claim$/);
  if (mClaim && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    const r = claimTask(decodeURIComponent(mClaim[1]), body);
    return json(r.body, r.status);
  }

  const mHb = p.match(/^\/api\/tasks\/([^/]+)\/heartbeat$/);
  if (mHb && method === "POST") {
    let body: Record<string, unknown> = {};
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {}; // heartbeat boleh tanpa body selain worker_id via body
    }
    const r = heartbeatTask(decodeURIComponent(mHb[1]), body);
    return json(r.body, r.status);
  }

  const mReport = p.match(/^\/api\/tasks\/([^/]+)\/report$/);
  if (mReport && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    const r = reportTask(decodeURIComponent(mReport[1]), body);
    return json(r.body, r.status);
  }

  const mRetry = p.match(/^\/api\/tasks\/([^/]+)\/retry$/);
  if (mRetry && method === "POST") return retryTask(decodeURIComponent(mRetry[1]));

  const mRec = p.match(/^\/api\/tasks\/([^/]+)\/reconcile$/);
  if (mRec && method === "POST") return reconcileTask(decodeURIComponent(mRec[1]));

  // ---- Fase 5 slice-1: Organization & Capability engine (Tahap 5) ----
  if (p === "/api/orgs" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    const r = createOrg(body as never);
    // OrgDetail juga punya `status: string` (org status) — bedakan Denial lewat typeof number.
    if (typeof (r as { status?: unknown }).status === "number") {
      const d = r as Denial;
      return json({ error: d.reason, ...(d.detail ?? {}) }, d.status);
    }
    return json({ org: r }, 201);
  }

  if (p === "/api/orgs" && method === "GET") {
    const orgs = listOrgs();
    return json({ count: orgs.length, orgs });
  }

  const mOrg = p.match(/^\/api\/orgs\/([^/]+)$/);
  if (mOrg && method === "GET") {
    const o = getOrg(decodeURIComponent(mOrg[1]));
    if (!o) return json({ error: "org_not_found" }, 404);
    return json({ org: o });
  }
  // catatan: regex di atas hanya cocok path /api/orgs/* — tidak tumpang tindih dgn /api/workflows*.

  if (p === "/api/orgs/check" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    const org = typeof body.org === "string" ? body.org : "";
    const subject = typeof body.subject === "string" ? body.subject : "";
    const capability = typeof body.capability === "string" ? body.capability : "";
    const r = checkCapability(org, subject, capability);
    return json(r); // allowed=false tetap 200 — deny ter-audit sbg event capability_denied
  }

  // ---- Fase 5 slice-2: workflow & policy binding (Tahap 5) ----
  if (p === "/api/workflows" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    const r = createWorkflowTemplate(body as never);
    if ("status" in r) return json({ error: r.reason, ...(r.detail ?? {}) }, r.status);
    return json({ workflow: r }, 201);
  }

  if (p === "/api/workflows" && method === "GET") {
    const wfs = listWorkflows();
    return json({ count: wfs.length, workflows: wfs });
  }

  const mWfRun = p.match(/^\/api\/workflows\/([^/]+)\/run$/);
  if (mWfRun && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    const r = startWorkflowRun(decodeURIComponent(mWfRun[1]), body);
    return json(r.body, r.status);
  }

  const mWf = p.match(/^\/api\/workflows\/([^/]+)$/);
  if (mWf && method === "GET") {
    const w = getWorkflow(decodeURIComponent(mWf[1]));
    if (!w) return json({ error: "workflow_not_found" }, 404);
    return json({ workflow: w });
  }

  if (p === "/api/policy/bindings" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    const r = bindPolicy(body as never);
    if ("status" in r) return json({ error: r.reason, ...(r.detail ?? {}) }, r.status);
    return json({ binding: r }, 201);
  }

  if (p === "/api/policy/bindings" && method === "GET") {
    const bs = listBindings();
    return json({ count: bs.length, bindings: bs });
  }

  // ---- Fase 6 slice-1: providers & secrets (Tahap 6, AT-28..AT-31) ----
  if (p === "/api/providers" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    const r = createProvider(body);
    if ("status" in r) return json({ error: r.reason, ...(r.detail ?? {}) }, r.status);
    return json({ provider: r }, 201);
  }

  if (p === "/api/providers" && method === "GET") {
    const ps = listProviders();
    return json({ count: ps.length, providers: ps });
  }

  const mProvTest = p.match(/^\/api\/providers\/([^/]+)\/test$/);
  if (mProvTest && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    const r = await testProvider(decodeURIComponent(mProvTest[1]), body);
    return json(r.body, r.status);
  }

  const mProv = p.match(/^\/api\/providers\/([^/]+)$/);
  if (mProv && method === "GET") {
    const pv = getProvider(decodeURIComponent(mProv[1]));
    if (!pv) return json({ error: "provider_not_found" }, 404);
    return json({ provider: pv });
  }

  if (p === "/api/secrets" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    const r = setSecret(body);
    if ("status" in r) return json({ error: r.reason }, r.status);
    return json(r, 201); // { name, stored: true } — nilai TIDAK di-echo balik
  }

  if (p === "/api/secrets" && method === "GET") {
    const ss = listSecrets(); // hanya nama + has_value — nilai tidak keluar
    return json({ count: ss.length, secrets: ss });
  }

  // ---- Fase 4 slice-1: knowledge/RAG minimal (AT-32/AT-35) ----
  if (p === "/api/knowledge/sources" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    const scope = typeof body.scope === "string" ? body.scope : "";
    const srcPath = typeof body.path === "string" ? body.path : "";
    if (!srcPath) return json({ error: "path wajib (string, di bawah dhaheros/knowledge/)" }, 400);
    const r = ingestSource(scope, srcPath);
    if ("status" in r) return json({ error: r.reason, ...(r.detail ?? {}) }, r.status);
    return json({ ingested: r }, 201);
  }

  if (p === "/api/knowledge/sources" && method === "GET") {
    return json({ count: listSources().length, sources: listSources() });
  }

  if (p === "/api/knowledge/search" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    const scope = typeof body.scope === "string" ? body.scope : "";
    const query = typeof body.query === "string" ? body.query : "";
    const r = searchKnowledge(scope, query);
    if ("status" in r) return json({ error: r.reason }, r.status);
    return json(r); // { found, results } — found=false tanpa isi/sitasi rekaan (AT-35)
  }

  const mRev = p.match(/^\/api\/knowledge\/sources\/([^/]+)\/revoke$/);
  if (mRev && method === "POST") {
    const r = revokeSource(decodeURIComponent(mRev[1]));
    if ("status" in r) return json({ error: r.reason }, r.status);
    return json(r);
  }

  // ---- Fase 4 RAG gap (run-33 Track 3): Memory lifecycle layer (AT-38) ----
  // Memory user-authored/approved terpisah dari ringkasan agent-derived;
  // provenance (source_ref) wajib untuk agent-derived; revoke → retrieval denied segera.
  // Pattern identik dgn /api/knowledge/*: deny-by-default via validasi input,
  // audit event memory_created/memory_revoked/memory_denied/memory_query, no capability
  // gate built-in (reuse knowledge.ingest/knowledge.search saat integrasi workflow).
  if (p === "/api/memory" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    const scope = typeof body.scope === "string" ? body.scope : "";
    const label = typeof body.label === "string" ? body.label : "";
    const subject = typeof body.subject === "string" ? body.subject : "";
    const content = typeof body.content === "string" ? body.content : "";
    const sourceRef =
      typeof body.source_ref === "string" && body.source_ref.trim() ? body.source_ref : null;
    const r = createMemory(scope, label, subject, content, sourceRef);
    // MemoryRecord punya field `status: string`; Denial punya `status: number`.
    if (typeof (r as MemoryDenial).status === "number") {
      const d = r as MemoryDenial;
      return json({ error: d.reason, ...(d.detail ?? {}) }, d.status);
    }
    return json({ memory: r }, 201);
  }

  if (p === "/api/memory" && method === "GET") {
    const scope = url.searchParams.get("scope") ?? "";
    const label = url.searchParams.get("label") ?? undefined;
    const r = listMemory(scope, label ? { label } : undefined);
    if (Array.isArray(r)) return json({ count: r.length, memories: r });
    const d = r as MemoryDenial;
    return json({ error: d.reason, ...(d.detail ?? {}) }, d.status);
  }

  const mMemRevoke = p.match(/^\/api\/memory\/([^/]+)\/revoke$/);
  if (mMemRevoke && method === "POST") {
    const r = revokeMemory(decodeURIComponent(mMemRevoke[1]));
    if (typeof (r as MemoryDenial).status === "number") {
      const d = r as MemoryDenial;
      return json({ error: d.reason }, d.status);
    }
    return json(r);
  }

  if (p === "/api/memory/search" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    const scope = typeof body.scope === "string" ? body.scope : "";
    const query = typeof body.query === "string" ? body.query : "";
    const r = searchMemory(scope, query);
    if ("status" in r) return json({ error: r.reason }, r.status);
    return json(r); // { found, results, content_policy }
  }

  const mMem = p.match(/^\/api\/memory\/([^/]+)$/);
  if (mMem && method === "GET") {
    const m = getMemory(decodeURIComponent(mMem[1]));
    if (!m) return json({ error: "memory_not_found" }, 404); // revoked juga 404 (AT-38)
    return json({ memory: m });
  }

  if (p === "/api/events/summary" && method === "GET") {
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    return json({ from: from ?? null, to: to ?? null, summary: summarizeEvents(from, to), ts: now() });
  }

  if (p === "/api/events" && method === "GET") {
    const taskId = url.searchParams.get("task_id") ?? undefined;
    const type = url.searchParams.get("type") ?? undefined;
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? 200);
    const events = listEvents({
      taskId,
      type,
      fromTs: from,
      toTs: to,
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 2000) : 200,
    }).map((e) => ({
      id: e.id,
      ts: e.ts,
      task_id: e.task_id,
      type: e.type,
      payload: JSON.parse(e.payload),
    }));
    return json({ count: events.length, events });
  }

  // ---- Fase 8 slice-2: scheduler internal (trigger/schedule iris aman) ----
  if (p === "/api/schedules" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    const r = createSchedule(body);
    return json(r.body, r.status);
  }
  if (p === "/api/schedules" && method === "GET") return json({ count: listSchedules().length, schedules: listSchedules() });
  if (p === "/api/scheduler/kill-switch" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    if (typeof body.enabled !== "boolean") return json({ error: "wajib {enabled: boolean}" }, 400);
    return json(setKillSwitch(body.enabled));
  }
  if (p === "/api/scheduler/status" && method === "GET") return json(schedulerStatus());
  const mSched = p.match(/^\/api\/schedules\/([^/]+)$/);
  if (mSched) {
    const id = decodeURIComponent(mSched[1]);
    if (method === "GET") {
      const s = getSchedule(id);
      return s ? json({ schedule: s }) : json({ error: "schedule tidak ditemukan" }, 404);
    }
    if (method === "DELETE") {
      const r = deleteSchedule(id);
      return json(r.body, r.status);
    }
    if (method === "POST") {
      // POST /api/schedules/:id dengan {enabled: boolean} = enable/disable per schedule
      let body: Record<string, unknown>;
      try {
        body = (await req.json()) as Record<string, unknown>;
      } catch {
        return json({ error: "body JSON tidak valid" }, 400);
      }
      if (typeof body.enabled !== "boolean") return json({ error: "wajib {enabled: boolean}" }, 400);
      const r = setScheduleEnabled(id, body.enabled);
      return json(r.body, r.status);
    }
  }

  // ---- Fase 10 (task 58-b, plan §9): entitas task_dependencies / decision_records / evaluation_runs ----

  // AT-ENT-01: dependency antar dua task yang SUDAH ada (utk uji cycle dua arah).
  if (p === "/api/task-dependencies" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    const child = typeof body.child_task_id === "string" ? body.child_task_id.trim() : "";
    const parent = typeof body.parent_task_id === "string" ? body.parent_task_id.trim() : "";
    const r = createDependency(child, parent);
    if ("status" in r) return json({ error: r.reason, ...(r.detail ?? {}) }, r.status);
    return json({ dependency: r }, 201);
  }
  if (p === "/api/task-dependencies" && method === "GET") {
    const rows = db.query("SELECT * FROM task_dependencies ORDER BY created_at ASC").all();
    return json({ count: rows.length, dependencies: rows });
  }

  // AT-ENT-02: decision_records — append-only; POST wajib rationale; TIDAK ADA rute mutasi
  // (PUT/DELETE → jatuh ke 404 bawah); GET dgn org+subject memakai pola ACL org (cross-scope ditolak).
  if (p === "/api/decisions" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    const r = createDecision(body.actor, body.decision, body.rationale, body.scope);
    if ("status" in r) return json({ error: r.reason }, r.status);
    return json({ decision: r }, 201);
  }
  if (p === "/api/decisions" && method === "GET") {
    const org = url.searchParams.get("org") ?? undefined;
    const subject = url.searchParams.get("subject") ?? undefined;
    const r = listDecisions(org ? { org, subject: subject ?? "" } : {});
    if (!Array.isArray(r)) {
      const d = r as EntityDenial;
      return json({ error: d.reason, ...(d.detail ?? {}) }, d.status);
    }
    return json({ count: r.length, decisions: r });
  }
  const mDec = p.match(/^\/api\/decisions\/([^/]+)$/);
  if (mDec && method === "GET") {
    const d = getDecision(decodeURIComponent(mDec[1]));
    if (!d) return json({ error: "decision_not_found" }, 404);
    return json({ decision: d });
  }

  // AT-ENT-03: evaluation_runs — rekam bukti verify/eval; validasi input; read dgn pola ACL org.
  if (p === "/api/eval-runs" && method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "body JSON tidak valid" }, 400);
    }
    const r = createEvalRun(body);
    if ("status" in r) return json({ error: r.reason }, r.status);
    return json({ eval_run: r }, 201);
  }
  if (p === "/api/eval-runs" && method === "GET") {
    const org = url.searchParams.get("org") ?? undefined;
    const subject = url.searchParams.get("subject") ?? undefined;
    const r = listEvalRuns(org ? { org, subject: subject ?? "" } : {});
    if (!Array.isArray(r)) {
      const d = r as EntityDenial;
      return json({ error: d.reason, ...(d.detail ?? {}) }, d.status);
    }
    return json({ count: r.length, eval_runs: r });
  }

  return json({ error: "not found", path: p }, 404);
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    try {
      return await handle(req);
    } catch (e) {
      console.error("[dhaheros-control-plane] handler error:", e);
      return json({ error: "internal error", detail: String(e) }, 500);
    }
  },
});
