// DhaherOS Fase 9 slice-1 — PROTOKOL KERJASAMA AGENT OTONOM (worker protocol).
//
// Server side (di-wire di src/index.ts):
//   POST /api/tasks/:id/claim     — worker mengklaim task planned (planned→running,
//                                   event worker_claimed). Validasi capability_context
//                                   SAMA seperti POST /api/tasks (Fase 5) + seat HARUS
//                                   terdaftar di runtimes/blackhornet/seats.json dan
//                                   capability seat = capability yang diklaim.
//                                   Deny → 403 + event worker_denied TANPA transisi.
//   POST /api/tasks/:id/heartbeat — tanda worker hidup (event worker_heartbeat +
//                                   update kolom last_heartbeat di tabel tasks +
//                                   last_seen_at di task_workers).
//   POST /api/tasks/:id/report    — hasil eksekusi worker (exit_code/notes/artifacts →
//                                   transisi succeeded/failed yang sah + event
//                                   worker_reported; report ganda ditolak; artefak
//                                   path wajib di dalam workspace task — deny-by-default
//                                   paths.ts; runtime diakumulasi ke budget AT-12 dari
//                                   wall-clock server).
//
// CLI side:
//   bun src/worker.ts --server http://127.0.0.1:3031 --seat executor --worker-id w-1 \
//        --org <org> --subject <subject> [--poll 2] [--heartbeat 5] [--once] [--max-wait 30]
//   - baca seat dari runtimes/blackhornet/seats.json (capability seat = reused whitelist)
//   - poll GET /api/tasks?state=planned → cari task yang cocok (task_created.
//     capability_context org+capability = seat) → POST claim
//   - eksekusi command task di workspace task (pola executor.ts: wrapper exec-redirect
//     ke artifacts/<id>/, env child bersih PATH/HOME, timeout → SIGKILL, meta.json)
//   - heartbeat berkala selama eksekusi, lalu report hasil
//   - --once: mode sekali-jalanan (slice-1) — satu siklus poll/claim/execute/report.
//
// Keamanan: deny ter-audit (worker_denied); zero-egress (server default 127.0.0.1);
// secret/token tidak pernah di log/event; claim hanya utk task yang menyandikan
// capability_context (kebijakan terverifikasi — task inline tidak diambil worker).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { ROOT, ARTIFACTS_ROOT, isInside } from "./paths";
import { db, insertEvent, getTask, transitionTo, addRuntime, type TaskRow } from "./db";
import { adapterForTask } from "./adapters";
import { validateCapabilityContext, type CapabilityContext } from "./org";

// ---- tabel claim worker (registry identitas claim: seat/org/subject/capability + last_seen) ----
// Kolom kanonik identitas worker ada di tabel tasks (worker_id, last_heartbeat — migrasi
// ringan db.ts); tabel ini melengkapi dgn konteks seat utk audit & validasi report.
db.exec(`
CREATE TABLE IF NOT EXISTS task_workers (
  task_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  seat TEXT NOT NULL,
  org TEXT NOT NULL,
  subject TEXT NOT NULL,
  capability TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  reported_at TEXT,
  status TEXT NOT NULL DEFAULT 'claimed',
  PRIMARY KEY (task_id, worker_id)
);
`);

interface ClaimRow {
  task_id: string;
  worker_id: string;
  seat: string;
  org: string;
  subject: string;
  capability: string;
  claimed_at: string;
  last_seen_at: string;
  reported_at: string | null;
  status: string;
}

export interface WorkerEndpointResult {
  status: number;
  body: Record<string, unknown>;
}

// ---- registry seat (runtimes/blackhornet/seats.json) — cache modul ----
export interface SeatSpec {
  id: string;
  name: string;
  runtime?: string;
  capability: string;
  description?: string;
}

let seatsCache: Map<string, SeatSpec> | null = null;

export function loadSeats(): Map<string, SeatSpec> {
  if (seatsCache) return seatsCache;
  const m = new Map<string, SeatSpec>();
  try {
    const p = path.join(ROOT, "runtimes", "blackhornet", "seats.json");
    const j = JSON.parse(readFileSync(p, "utf8")) as { seats?: SeatSpec[] };
    for (const s of j.seats ?? []) {
      if (s && typeof s.name === "string" && typeof s.capability === "string") {
        m.set(s.name, s);
      }
    }
  } catch {
    // seats.json tak terbaca → registry kosong: claim dengan seat mana pun ditolak
    // (deny-by-default ter-audit; tanpa seat tidak ada eksekusi worker).
  }
  seatsCache = m;
  return m;
}

// ---- konteks capability yang disandikan task (dari event task_created — append-only) ----
export interface TaskCreatedInfo {
  capability_context: CapabilityContext | null;
  execution: string;
}

export function taskCreatedInfo(taskId: string): TaskCreatedInfo {
  const row = db
    .query("SELECT payload FROM events WHERE task_id=? AND type='task_created' ORDER BY id ASC LIMIT 1")
    .get(taskId) as { payload: string } | null;
  if (!row) return { capability_context: null, execution: "inline" };
  try {
    const p = JSON.parse(row.payload) as Record<string, unknown>;
    const c = p.capability_context as Partial<CapabilityContext> | undefined;
    const ctx: CapabilityContext | null =
      c && typeof c.org === "string" && typeof c.subject === "string" && typeof c.capability === "string"
        ? { org: c.org, subject: c.subject, capability: c.capability }
        : null;
    return {
      capability_context: ctx,
      execution: typeof p.execution === "string" ? p.execution : "inline",
    };
  } catch {
    return { capability_context: null, execution: "inline" };
  }
}

function claimOf(taskId: string, workerId: string): ClaimRow | null {
  return (
    (db
      .query("SELECT * FROM task_workers WHERE task_id=? AND worker_id=?")
      .get(taskId, workerId) as ClaimRow | null) ?? null
  );
}

// ---------- POST /api/tasks/:id/claim ----------
export function claimTask(id: string, body: Record<string, unknown>): WorkerEndpointResult {
  const workerId = typeof body.worker_id === "string" ? body.worker_id.trim() : "";
  const seatName = typeof body.seat === "string" ? body.seat.trim() : "";
  if (!workerId || !seatName) {
    insertEvent(id, "worker_denied", {
      reason: "bad_request",
      worker_id: workerId || null,
      seat: seatName || null,
      note: "claim wajib worker_id + seat (string)",
    });
    return { status: 400, body: { error: "worker_id dan seat wajib (string)" } };
  }

  // 1) validasi capability_context — SAMA seperti POST /api/tasks (Fase 5):
  //    bentuk salah → 400; org/subject/capability tak tergrant → 403 (ter-audit).
  const c = body.capability_context as Partial<CapabilityContext> | undefined;
  const ctx: CapabilityContext = {
    org: String(c?.org ?? ""),
    subject: String(c?.subject ?? ""),
    capability: String(c?.capability ?? ""),
  };
  const den = validateCapabilityContext(ctx);
  if (den) {
    insertEvent(id, "worker_denied", {
      reason: den.reason,
      worker_id: workerId,
      seat: seatName,
      org: ctx.org,
      subject: ctx.subject,
      capability: ctx.capability,
      why: (den.detail as { why?: string } | undefined)?.why,
      note: "Fase 9: kebijakan capability org — claim ditolak, TIDAK ada transisi state",
    });
    return { status: den.status, body: { error: den.reason, ...(den.detail ?? {}) } };
  }

  // 2) seat harus terdaftar di seats.json dan capability-nya cocok dgn yang diklaim
  //    (worker tidak bisa memakai nama seat lain sambil mengirim capability berbeda).
  const seat = loadSeats().get(seatName);
  if (!seat) {
    insertEvent(id, "worker_denied", {
      reason: "seat_unknown",
      worker_id: workerId,
      seat: seatName,
      note: "seat tidak ada di runtimes/blackhornet/seats.json — claim ditolak",
    });
    return { status: 403, body: { error: "seat_unknown", seat: seatName } };
  }
  if (seat.capability !== ctx.capability) {
    insertEvent(id, "worker_denied", {
      reason: "seat_capability_mismatch",
      worker_id: workerId,
      seat: seatName,
      seat_capability: seat.capability,
      claimed_capability: ctx.capability,
      note: "capability yang diklaim ≠ capability seat — claim ditolak",
    });
    return { status: 403, body: { error: "seat_capability_mismatch" } };
  }

  const t = getTask(id);
  if (!t) {
    insertEvent(id, "worker_denied", { reason: "task_not_found", worker_id: workerId, seat: seatName });
    return { status: 404, body: { error: "task tidak ditemukan" } };
  }

  // 3) task wajib menyandikan capability_context (kebijakan terverifikasi) —
  //    task tanpa context tidak diambil worker (deny-by-default, tanpa transisi).
  const info = taskCreatedInfo(id);
  if (!info.capability_context) {
    insertEvent(id, "worker_denied", {
      reason: "no_capability_context",
      worker_id: workerId,
      seat: seatName,
      note: "task tidak menyandikan capability_context — kebijakan tak terverifikasi, claim ditolak",
    });
    return { status: 403, body: { error: "no_capability_context" } };
  }
  if (
    info.capability_context.org !== ctx.org ||
    info.capability_context.capability !== ctx.capability
  ) {
    insertEvent(id, "worker_denied", {
      reason: "capability_mismatch",
      worker_id: workerId,
      seat: seatName,
      task_org: info.capability_context.org,
      task_capability: info.capability_context.capability,
      worker_org: ctx.org,
      worker_capability: ctx.capability,
      note: "capability/org task ≠ capability/org worker — claim ditolak",
    });
    return { status: 403, body: { error: "capability_mismatch" } };
  }

  // 4) transisi planned→running dgn identitas worker (event worker_claimed).
  //    Bukan planned (mis. sudah diklaim/dibatalkan) → transisi ditolak state machine
  //    (transition_denied ter-audit oleh db.transitionTo).
  const nowIso = new Date().toISOString();
  const ok = transitionTo(id, "running", "worker_claimed", {
    worker_id: workerId,
    seat: seatName,
    org: ctx.org,
    subject: ctx.subject,
    capability: ctx.capability,
    via: "POST /api/tasks/:id/claim",
  });
  if (!ok) {
    return { status: 409, body: { error: "claim ditolak: state bukan planned (sudah diklaim/berjalan)" } };
  }
  db.run(
    "INSERT OR REPLACE INTO task_workers (task_id, worker_id, seat, org, subject, capability, claimed_at, last_seen_at, reported_at, status) VALUES (?,?,?,?,?,?,?,?,NULL,'claimed')",
    [id, workerId, seatName, ctx.org, ctx.subject, ctx.capability, nowIso, nowIso]
  );
  // Simpan identitas worker di kolom task (kanonik): worker_id + heartbeat awal.
  db.run("UPDATE tasks SET worker_id=?, last_heartbeat=?, updated_at=? WHERE id=?", [
    workerId,
    nowIso,
    nowIso,
    id,
  ]);
  return {
    status: 200,
    body: { claimed: true, task_id: id, worker_id: workerId, seat: seatName, state: "running", claimed_at: nowIso },
  };
}

// ---------- POST /api/tasks/:id/heartbeat ----------
export function heartbeatTask(id: string, body: Record<string, unknown>): WorkerEndpointResult {
  const workerId = typeof body.worker_id === "string" ? body.worker_id.trim() : "";
  if (!workerId) {
    insertEvent(id, "worker_heartbeat_denied", { reason: "bad_request", note: "heartbeat wajib worker_id" });
    return { status: 400, body: { error: "worker_id wajib (string)" } };
  }
  const t = getTask(id);
  if (!t) {
    insertEvent(id, "worker_heartbeat_denied", { reason: "task_not_found", worker_id: workerId });
    return { status: 404, body: { error: "task tidak ditemukan" } };
  }
  const claim = claimOf(id, workerId);
  if (!claim) {
    insertEvent(id, "worker_heartbeat_denied", {
      reason: "no_claim_record",
      worker_id: workerId,
      note: "heartbeat hanya dari worker yang mengklaim task",
    });
    return { status: 403, body: { error: "no_claim_record" } };
  }
  if (t.state !== "running") {
    insertEvent(id, "worker_heartbeat_denied", {
      reason: "state_not_running",
      worker_id: workerId,
      state: t.state,
    });
    return { status: 409, body: { error: `heartbeat ditolak: state=${t.state}` } };
  }
  const ts = new Date().toISOString();
  db.run("UPDATE task_workers SET last_seen_at=? WHERE task_id=? AND worker_id=?", [ts, id, workerId]);
  // Update kolom last_heartbeat di tasks (kanonik, nullable — migrasi ringan db.ts).
  db.run("UPDATE tasks SET last_heartbeat=?, updated_at=? WHERE id=?", [ts, ts, id]);
  insertEvent(id, "worker_heartbeat", { worker_id: workerId, seat: claim.seat, ts });
  return { status: 200, body: { ok: true, task_id: id, worker_id: workerId, last_heartbeat: ts } };
}

// ---------- POST /api/tasks/:id/report ----------
export function reportTask(id: string, body: Record<string, unknown>): WorkerEndpointResult {
  const workerId = typeof body.worker_id === "string" ? body.worker_id.trim() : "";
  if (!workerId) {
    insertEvent(id, "worker_reported_denied", { reason: "bad_request", note: "report wajib worker_id" });
    return { status: 400, body: { error: "worker_id wajib (string)" } };
  }
  const t = getTask(id);
  if (!t) {
    insertEvent(id, "worker_reported_denied", { reason: "task_not_found", worker_id: workerId });
    return { status: 404, body: { error: "task tidak ditemukan" } };
  }
  const claim = claimOf(id, workerId);
  if (!claim) {
    insertEvent(id, "worker_reported_denied", {
      reason: "no_claim_record",
      worker_id: workerId,
      note: "report hanya dari worker yang mengklaim task",
    });
    return { status: 403, body: { error: "no_claim_record" } };
  }
  if (claim.reported_at) {
    insertEvent(id, "worker_reported_denied", {
      reason: "already_reported",
      worker_id: workerId,
      reported_at: claim.reported_at,
      note: "report ganda ditolak — satu claim satu report (slice-1)",
    });
    return { status: 409, body: { error: "already_reported" } };
  }
  if (t.state !== "running") {
    insertEvent(id, "worker_reported_denied", {
      reason: "state_not_running",
      worker_id: workerId,
      state: t.state,
    });
    return { status: 409, body: { error: `report ditolak: state=${t.state}` } };
  }

  const timedOut = body.timed_out === true;
  const exitCode =
    typeof body.exit_code === "number" && Number.isInteger(body.exit_code) ? body.exit_code : null;
  if (exitCode === null && !timedOut) {
    insertEvent(id, "worker_reported_denied", {
      reason: "bad_request",
      worker_id: workerId,
      note: "report wajib exit_code (integer) atau timed_out=true",
    });
    return { status: 400, body: { error: "exit_code (integer) wajib, atau timed_out=true" } };
  }

  // notes opsional (dari worker, bebas teks — dibatasi panjang utk audit)
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 2000) : null;

  // Artefak report — deny-by-default (paths.ts):
  //   - nama sederhana (tanpa separator, whitelist charset) → ref file di artifacts/<task_id>/
  //     (pola executor.ts: stdout.txt/stderr.txt/meta.json);
  //   - path (mengandung "/") WAJIB resolve di dalam workspace task ATAU artifacts/<task_id>/.
  //     Di luar itu → 403 worker_reported_denied(artifact_outside_workspace), TANPA transisi.
  const rawArtifacts: unknown[] = Array.isArray(body.artifacts) ? body.artifacts : [];
  const artifacts: string[] = [];
  const artifactDir = path.join(ARTIFACTS_ROOT, id);
  for (const a of rawArtifacts) {
    if (typeof a !== "string" || !a.trim() || a.length > 256) {
      insertEvent(id, "worker_reported_denied", {
        reason: "bad_artifact_ref",
        worker_id: workerId,
        note: "artefak report wajib string nama/path (1..256 char)",
      });
      return { status: 400, body: { error: "bad_artifact_ref" } };
    }
    if (!a.includes("/")) {
      if (!/^[A-Za-z0-9._-]{1,128}$/.test(a)) {
        insertEvent(id, "worker_reported_denied", {
          reason: "bad_artifact_ref",
          worker_id: workerId,
          artifact: a,
          note: "nama artefak hanya boleh [A-Za-z0-9._-] (1..128 char)",
        });
        return { status: 400, body: { error: "bad_artifact_ref" } };
      }
      artifacts.push(a);
      continue;
    }
    const resolved = path.resolve(a.startsWith("/") ? a : path.join(t.workspace, a));
    if (!isInside(resolved, t.workspace) && !isInside(resolved, artifactDir)) {
      insertEvent(id, "worker_reported_denied", {
        reason: "artifact_outside_workspace",
        worker_id: workerId,
        artifact: a,
        resolved,
        workspace: t.workspace,
        note: "deny-by-default paths.ts: artefak path di luar workspace task — report ditolak TANPA transisi",
      });
      return { status: 403, body: { error: "artifact_outside_workspace", artifact: a } };
    }
    artifacts.push(resolved);
  }
  const durationMs =
    typeof body.duration_ms === "number" && body.duration_ms >= 0 ? Math.round(body.duration_ms) : null;
  const claimedAtMs = Date.parse(claim.claimed_at);
  const serverMs = Number.isFinite(claimedAtMs) ? Math.max(0, Date.now() - claimedAtMs) : 0;

  const nextState = timedOut || exitCode !== 0 ? "failed" : "succeeded";
  const reason = timedOut
    ? "timeout_exceeded_worker (worker melaporkan timeout → kill di sisi worker)"
    : exitCode === 0
      ? "exit_code=0 (worker report)"
      : `exit_code=${exitCode} (worker report)`;

  const ok = transitionTo(id, nextState, "worker_reported", {
    worker_id: workerId,
    seat: claim.seat,
    org: claim.org,
    subject: claim.subject,
    capability: claim.capability,
    exit_code: exitCode,
    timed_out: timedOut,
    notes,
    duration_ms: durationMs,
    duration_server_ms: serverMs,
    artifacts,
    artifact_dir: path.join(ARTIFACTS_ROOT, id),
    reason,
    via: "POST /api/tasks/:id/report",
  });
  if (!ok) {
    return { status: 409, body: { error: "report ditolak: transisi state tidak valid" } };
  }
  db.run(
    "UPDATE task_workers SET status='reported', reported_at=? WHERE task_id=? AND worker_id=?",
    [new Date().toISOString(), id, workerId]
  );
  // Budget AT-12: runtime worker dihitung jujur dari wall-clock SERVER (claim→report),
  // bukan klaim client — akumulasi per task + global.
  addRuntime(id, serverMs);
  if (artifacts.length > 0) {
    insertEvent(id, "artifacts_written", {
      dir: path.join(ARTIFACTS_ROOT, id),
      files: artifacts,
      via: "worker",
    });
  }
  return {
    status: 200,
    body: { reported: true, task_id: id, state: nextState, exit_code: exitCode },
  };
}

// ============================================================
// CLI worker (bun src/worker.ts --server ... --seat ... --worker-id ...)
// ============================================================
interface WorkerArgs {
  server: string;
  seat: string;
  workerId: string;
  org: string;
  subject: string;
  poll: number;
  heartbeat: number;
  once: boolean;
  maxWait: number;
  help: boolean;
}

const USAGE = `DhaherOS worker CLI (Fase 9 slice-1) — protokol kerjasama agent otonom.

Pemakaian:
  bun src/worker.ts --server http://127.0.0.1:3031 --seat executor --worker-id w-1 \\
      --org <org> --subject <subject> [--poll 2] [--heartbeat 5] [--once] [--max-wait 30]

Argumen:
  --server URL     control plane (default http://127.0.0.1:3031 — zero-egress)
  --seat NAME      nama seat di runtimes/blackhornet/seats.json (wajib)
  --worker-id ID   identitas worker unik (wajib)
  --org NAME       org untuk capability_context claim (wajib)
  --subject NAME   subject/member org untuk capability_context claim (wajib)
  --poll SEC       interval poll task planned (default 2)
  --heartbeat SEC  interval heartbeat selama eksekusi (default 5; 0=mati)
  --once           sekali-jalanan: satu siklus poll/claim/execute/report lalu exit
  --max-wait SEC   batas waktu total mode --once (default 30)
  --help           bantuan`;

function parseArgs(argv: string[]): WorkerArgs {
  const a: WorkerArgs = {
    server: "http://127.0.0.1:3031",
    seat: "",
    workerId: "",
    org: "",
    subject: "",
    poll: 2,
    heartbeat: 5,
    once: false,
    maxWait: 30,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i] ?? "";
    if (k === "--server") a.server = next();
    else if (k === "--seat") a.seat = next();
    else if (k === "--worker-id") a.workerId = next();
    else if (k === "--org") a.org = next();
    else if (k === "--subject") a.subject = next();
    else if (k === "--poll") a.poll = Number(next()) || 2;
    else if (k === "--heartbeat") a.heartbeat = Number(next());
    else if (k === "--once") a.once = true;
    else if (k === "--max-wait") a.maxWait = Number(next()) || 30;
    else if (k === "--help" || k === "-h") a.help = true;
  }
  return a;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface ApiResponse {
  status: number;
  json: Record<string, unknown> | null;
}

async function apiJson(
  server: string,
  method: string,
  p: string,
  body?: unknown,
  timeoutMs = 10000
): Promise<ApiResponse> {
  try {
    const res = await fetch(`${server.replace(/\/+$/, "")}${p}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = null;
    }
    return { status: res.status, json };
  } catch {
    return { status: 0, json: null };
  }
}

// Eksekusi command task di workspace — POLA EXECUTOR.TS (reuse):
// wrapper shell dgn exec-redirect ke artifacts/<id>/ (workaround pipe Bun),
// env child bersih (PATH/HOME saja — AT-09), setsid + timeout → SIGKILL group.
async function executeTaskLocally(
  t: TaskRow,
  workerId: string,
  seatName: string
): Promise<{ exit_code: number | null; timed_out: boolean; duration_ms: number; artifacts: string[] }> {
  const dir = path.join(ARTIFACTS_ROOT, t.id);
  mkdirSync(dir, { recursive: true });
  const startedAt = Date.now();
  const adapter = adapterForTask(t.runtime);
  const scriptPath = path.join(dir, "task_command.sh");
  writeFileSync(
    scriptPath,
    `exec >'${dir}/stdout.txt' 2>'${dir}/stderr.txt'\nexport DHOS_RUNTIME='${adapter.name}'\nexport DHOS_RUNTIME_VERSION='${adapter.version}'\nexport DHOS_WORKER_ID='${workerId}'\n${t.command}\n`,
    { mode: 0o600 }
  );
  const proc = Bun.spawn(["/usr/bin/setsid", "/bin/sh", scriptPath], {
    cwd: t.workspace,
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: t.workspace },
    stdout: "ignore",
    stderr: "ignore",
    stdin: "ignore",
  });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      process.kill(-proc.pid, "SIGKILL");
    } catch {
      try {
        proc.kill("SIGKILL");
      } catch {
        /* proses sudah mati */
      }
    }
  }, Math.max(1, t.timeout_sec) * 1000);
  const exitCode = await proc.exited;
  clearTimeout(timer);
  const durationMs = Date.now() - startedAt;
  const artifacts = ["task_command.sh", "stdout.txt", "stderr.txt", "meta.json"];
  writeFileSync(
    path.join(dir, "meta.json"),
    JSON.stringify(
      {
        task_id: t.id,
        worker_id: workerId,
        seat: seatName,
        executor: "worker-cli",
        command: t.command,
        workspace: t.workspace,
        runtime: adapter.name,
        runtime_version: adapter.version,
        exit_code: exitCode,
        timed_out: timedOut,
        duration_ms: durationMs,
        finished_at: new Date().toISOString(),
      },
      null,
      2
    )
  );
  return { exit_code: exitCode, timed_out: timedOut, duration_ms: durationMs, artifacts };
}

async function runCli(a: WorkerArgs): Promise<number> {
  const seats = loadSeats();
  const seat = seats.get(a.seat);
  if (!seat) {
    console.error(`[worker] seat tidak dikenal di runtimes/blackhornet/seats.json: ${a.seat}`);
    return 2;
  }
  if (!a.workerId || !a.org || !a.subject) {
    console.error("[worker] --worker-id, --org, --subject wajib");
    return 2;
  }
  console.log(
    `[worker] start id=${a.workerId} seat=${seat.name} capability=${seat.capability} server=${a.server} poll=${a.poll}s heartbeat=${a.heartbeat}s once=${a.once}`
  );

  // ---- poll + claim satu task yang cocok dgn capability seat ----
  let claimedId: string | null = null;
  const deadline = Date.now() + a.maxWait * 1000;
  while (true) {
    let list = await apiJson(a.server, "GET", `/api/tasks?state=planned`);
    let tries = 0;
    while (list.status === 0 && tries < 3) {
      tries += 1; // server mungkin belum siap — retry singkat
      await sleep(a.poll * 1000);
      list = await apiJson(a.server, "GET", `/api/tasks?state=planned`);
    }
    if (list.status === 200 && Array.isArray(list.json?.tasks)) {
      for (const t of list.json.tasks as Record<string, unknown>[]) {
        const tid = typeof t.id === "string" ? t.id : "";
        if (!tid) continue;
        const detail = await apiJson(a.server, "GET", `/api/tasks/${tid}`);
        const evs = Array.isArray(detail.json?.events) ? (detail.json?.events as Record<string, unknown>[]) : [];
        const created = evs.find((e) => e?.type === "task_created") as
          | { payload?: { capability_context?: { org?: string; capability?: string } } }
          | undefined;
        const ctx = created?.payload?.capability_context;
        if (!ctx || ctx.org !== a.org || ctx.capability !== seat.capability) continue; // bukan task utk seat ini
        const claim = await apiJson(a.server, "POST", `/api/tasks/${tid}/claim`, {
          worker_id: a.workerId,
          seat: a.seat,
          capability_context: { org: a.org, subject: a.subject, capability: seat.capability },
        });
        if (claim.status === 200) {
          claimedId = tid;
          break;
        }
        console.log(`[worker] claim ${tid} ditolak (HTTP ${claim.status}) — kandidat berikutnya`);
      }
    }
    if (claimedId || a.once || Date.now() >= deadline) break;
    await sleep(a.poll * 1000);
  }
  if (!claimedId) {
    console.log("[worker] tidak ada task planned yang cocok dgn seat — selesai (tanpa klaim)");
    return 0;
  }

  // ---- ambil detail task, heartbeat pertama, eksekusi, report ----
  const detail = await apiJson(a.server, "GET", `/api/tasks/${claimedId}`);
  const task = detail.json?.task as TaskRow | undefined;
  if (!task) {
    console.error(`[worker] task ${claimedId} tidak terbaca setelah claim`);
    return 3;
  }
  const hb = await apiJson(a.server, "POST", `/api/tasks/${claimedId}/heartbeat`, { worker_id: a.workerId });
  console.log(`[worker] klaim ${claimedId} (heartbeat HTTP ${hb.status}) — eksekusi di ${task.workspace}`);

  let hbTimer: ReturnType<typeof setInterval> | null = null;
  if (a.heartbeat > 0) {
    hbTimer = setInterval(() => {
      void apiJson(a.server, "POST", `/api/tasks/${claimedId}/heartbeat`, { worker_id: a.workerId })
        .then((r) => {
          if (r.status !== 200) console.log(`[worker] heartbeat ditolak (HTTP ${r.status})`);
        })
        .catch(() => {});
    }, a.heartbeat * 1000);
  }
  let result: Awaited<ReturnType<typeof executeTaskLocally>>;
  try {
    result = await executeTaskLocally(task, a.workerId, a.seat);
  } catch (e) {
    if (hbTimer) clearInterval(hbTimer);
    console.error(`[worker] eksekusi gagal: ${String(e)} — report failed (spawn_error)`);
    const rep = await apiJson(a.server, "POST", `/api/tasks/${claimedId}/report`, {
      worker_id: a.workerId,
      exit_code: 127,
      duration_ms: 0,
      artifacts: [],
    });
    console.log(`[worker] report ${claimedId}: HTTP ${rep.status} (spawn_error)`);
    return 4;
  }
  if (hbTimer) clearInterval(hbTimer);
  const report = await apiJson(a.server, "POST", `/api/tasks/${claimedId}/report`, {
    worker_id: a.workerId,
    seat: a.seat,
    exit_code: result.exit_code,
    timed_out: result.timed_out,
    duration_ms: result.duration_ms,
    artifacts: result.artifacts,
  });
  console.log(
    `[worker] report ${claimedId}: HTTP ${report.status} state=${String(report.json?.state ?? "?")} exit=${result.exit_code} timed_out=${result.timed_out} dur=${result.duration_ms}ms`
  );
  return report.status === 200 ? 0 : 4;
}

// Entry CLI hanya bila file ini dijalankan langsung (bukan di-import index.ts).
if (import.meta.main) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
  } else if (!args.seat) {
    console.log(USAGE);
    process.exitCode = 2;
  } else {
    runCli(args).then((code) => {
      process.exitCode = code;
    });
  }
}

// Guard kompatibilitas: modul ini juga memastikan path workspace/artifacts ada saat CLI jalan.
if (import.meta.main && !existsSync(ARTIFACTS_ROOT)) {
  mkdirSync(ARTIFACTS_ROOT, { recursive: true });
}
