// Fase 10 (task 58-b) — ENTITAS §9 plan: task_dependencies + decision_records + evaluation_runs.
// Lokal AT-ENT-01..03 (mapping ke plan §9 "Model data dan lifecycle"):
//   AT-ENT-01 — task_dependencies: task tunggu parent terminal (child planned sampai parent
//               succeeded/failed/cancelled); dependency cycle ditolak; self-dep ditolak;
//               parent tak dikenal ditolak. Semua deny ter-audit (event dependency_denied).
//   AT-ENT-02 — decision_records: log keputusan APPEND-ONLY (id, ts, actor, decision, rationale,
//               scope). Tanpa rationale → ditolak. Tidak ada rute mutasi (PUT/DELETE tidak ada —
//               percobaan → 404). Cross-scope read ditolak (pola org ACL AT-43: subject bukan
//               member org → 403 cross_scope_read_denied).
//   AT-ENT-03 — evaluation_runs: rekam hasil verify/eval (ts, suite, passed, failed, command);
//               validasi input; cross-scope read sama pola org ACL.
// Zero-egress; audit event untuk setiap create/deny; tanpa secret.
import { db, insertEvent, registerTerminalHook, getTask } from "./db";
import { runTask } from "./executor";
import { getOrg } from "./org";

const now = () => new Date().toISOString();

db.exec(`
CREATE TABLE IF NOT EXISTS task_dependencies (
  id TEXT PRIMARY KEY,
  parent_task_id TEXT NOT NULL,
  child_task_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(parent_task_id, child_task_id)
);
CREATE TABLE IF NOT EXISTS decision_records (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  actor TEXT NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global'
);
CREATE TABLE IF NOT EXISTS evaluation_runs (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  suite TEXT NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  command TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT 'global'
);
CREATE INDEX IF NOT EXISTS idx_dep_parent ON task_dependencies(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_dep_child ON task_dependencies(child_task_id);
`);

// ---- AT-ENT-01: task_dependencies ----

export interface Denial {
  status: number;
  reason: string;
  detail?: Record<string, unknown>;
}

export interface DependencyRow {
  id: string;
  parent_task_id: string;
  child_task_id: string;
  created_at: string;
}

// Deteksi cycle: naik dari parent melalui edge parent_task_id → apakah sampai child?
function createsCycle(childId: string, parentId: string): boolean {
  const seen = new Set<string>();
  const stack = [parentId];
  while (stack.length) {
    const cur = stack.pop() as string;
    if (cur === childId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const rows = db
      .query("SELECT parent_task_id FROM task_dependencies WHERE child_task_id = ?")
      .all(cur) as { parent_task_id: string }[];
    for (const r of rows) stack.push(r.parent_task_id);
  }
  return false;
}

function isTerminal(state: string): boolean {
  return state === "succeeded" || state === "failed" || state === "cancelled";
}

function denyDependency(reason: string, detail: Record<string, unknown>): Denial {
  insertEvent(null, "dependency_denied", { reason, ...detail });
  return { status: 400, reason, detail };
}

// Buat dependency child menunggu parent. Semua validasi deny-by-default.
export function createDependency(childTaskId: string, parentTaskId: string): DependencyRow | Denial {
  if (!childTaskId || !parentTaskId) {
    return denyDependency("child_and_parent_required", { child_task_id: childTaskId, parent_task_id: parentTaskId });
  }
  if (childTaskId === parentTaskId) {
    return denyDependency("self_dependency", { task_id: childTaskId });
  }
  const child = getTask(childTaskId);
  if (!child) return denyDependency("child_task_not_found", { child_task_id: childTaskId });
  const parent = getTask(parentTaskId);
  if (!parent) return denyDependency("parent_task_not_found", { parent_task_id: parentTaskId });
  // Child hanya bisa "menunggu" bila masih planned — sudah jalan/terminal → tidak bisa diberi gate.
  if (child.state !== "planned") {
    return denyDependency("child_not_planned", { child_task_id: childTaskId, state: child.state });
  }
  if (createsCycle(childTaskId, parentTaskId)) {
    return denyDependency("dependency_cycle", { child_task_id: childTaskId, parent_task_id: parentTaskId });
  }
  const dup = db
    .query("SELECT id FROM task_dependencies WHERE parent_task_id = ? AND child_task_id = ?")
    .get(parentTaskId, childTaskId);
  if (dup) return denyDependency("duplicate_dependency", { child_task_id: childTaskId, parent_task_id: parentTaskId });

  const id = crypto.randomUUID();
  db.run(
    "INSERT INTO task_dependencies (id, parent_task_id, child_task_id, created_at) VALUES (?,?,?,?)",
    [id, parentTaskId, childTaskId, now()]
  );
  insertEvent(childTaskId, "dependency_created", {
    dependency_id: id,
    parent_task_id: parentTaskId,
    parent_state: parent.state,
    note: "AT-ENT-01: child menunggu parent terminal (succeeded/failed/cancelled) sebelum dieksekusi",
  });
  // Parent sudah terminal saat dependency dibuat → child langsung boleh jalan (release segera).
  if (isTerminal(parent.state)) {
    insertEvent(childTaskId, "dependency_released", {
      dependency_id: id,
      parent_task_id: parentTaskId,
      parent_state: parent.state,
      note: "parent sudah terminal saat dependency dibuat — release segera",
    });
    void runTask(childTaskId);
  }
  return { id, parent_task_id: parentTaskId, child_task_id: childTaskId, created_at: now() };
}

// Hook terminal: parent mencapai succeeded/failed/cancelled → release semua child planned.
// Terdaftar via registerTerminalHook (db.ts) — dipanggil SETELAH transisi state sukses.
function releaseDependents(parentTaskId: string): void {
  const rows = db
    .query(
      `SELECT d.id AS dep_id, d.child_task_id AS child_id, t.state AS child_state
       FROM task_dependencies d JOIN tasks t ON t.id = d.child_task_id
       WHERE d.parent_task_id = ?`
    )
    .all(parentTaskId) as { dep_id: string; child_id: string; child_state: string }[];
  for (const r of rows) {
    if (r.child_state !== "planned") continue; // sudah jalan/dibatalkan — biarkan
    insertEvent(r.child_id, "dependency_released", {
      dependency_id: r.dep_id,
      parent_task_id: parentTaskId,
      note: "parent terminal — child dilepas dari planned",
    });
    void runTask(r.child_id);
  }
}
registerTerminalHook(releaseDependents);

export function listDependenciesForChild(childTaskId: string): unknown[] {
  return db
    .query(
      `SELECT d.id, d.parent_task_id, d.created_at, t.state AS parent_state
       FROM task_dependencies d JOIN tasks t ON t.id = d.parent_task_id
       WHERE d.child_task_id = ? ORDER BY d.created_at ASC`
    )
    .all(childTaskId);
}

export function listDependencies(): DependencyRow[] {
  return db
    .query("SELECT * FROM task_dependencies ORDER BY created_at ASC")
    .all() as DependencyRow[];
}

// ---- AT-ENT-02: decision_records (append-only) ----

export interface DecisionRow {
  id: string;
  ts: string;
  actor: string;
  decision: string;
  rationale: string;
  scope: string;
}

export function createDecision(
  actor: unknown,
  decision: unknown,
  rationale: unknown,
  scope: unknown
): DecisionRow | Denial {
  if (typeof actor !== "string" || !actor.trim()) {
    return { status: 400, reason: "actor_required" };
  }
  if (typeof decision !== "string" || !decision.trim()) {
    return { status: 400, reason: "decision_required" };
  }
  if (typeof rationale !== "string" || !rationale.trim()) {
    // AT-ENT-02: keputusan tanpa rationale ditolak — append-only log menuntut alasan eksplisit.
    insertEvent(null, "decision_denied", { reason: "rationale_required", actor });
    return { status: 400, reason: "rationale_required" };
  }
  const sc = typeof scope === "string" && scope.trim() ? scope.trim() : "global";
  const row: DecisionRow = {
    id: crypto.randomUUID(),
    ts: now(),
    actor: actor.trim(),
    decision: decision.trim(),
    rationale: rationale.trim(),
    scope: sc,
  };
  db.run(
    "INSERT INTO decision_records (id, ts, actor, decision, rationale, scope) VALUES (?,?,?,?,?,?)",
    [row.id, row.ts, row.actor, row.decision, row.rationale, row.scope]
  );
  insertEvent(null, "decision_recorded", {
    id: row.id,
    actor: row.actor,
    scope: row.scope,
    ts: row.ts,
    note: "append-only — tidak ada rute mutasi (PUT/DELETE tidak ada)",
  });
  return row;
}

// Cross-scope read guard (pola org ACL AT-43): bila org+subject diberikan, subject HARUS
// member org tsb → baris difilter ke scope org tsb. Bukan member → 403 cross_scope_read_denied.
// Tanpa org → daftar terbuka (ringkas; kompatibel pemakaian lokal tanpa ACL).
function crossScopeDenial(org: string, subject: string): Denial | null {
  const o = getOrg(org);
  if (!o) {
    insertEvent(null, "decision_read_denied", { reason: "org_not_found", org });
    return { status: 404, reason: "org_not_found" };
  }
  const isMember = (o.members ?? []).some((m) => m.subject === subject);
  if (!isMember) {
    insertEvent(null, "decision_read_denied", {
      reason: "cross_scope_read_denied",
      org,
      subject,
      note: "pola org ACL (AT-43): subject bukan member org — read lintas scope ditolak",
    });
    return { status: 403, reason: "cross_scope_read_denied", detail: { org, subject } };
  }
  return null;
}

export function listDecisions(opts: { org?: string; subject?: string }): DecisionRow[] | Denial {
  if (opts.org && opts.subject) {
    const d = crossScopeDenial(opts.org, opts.subject);
    if (d) return d;
    return db
      .query("SELECT * FROM decision_records WHERE scope = ? ORDER BY ts ASC")
      .all(opts.org) as DecisionRow[];
  }
  return db.query("SELECT * FROM decision_records ORDER BY ts ASC").all() as DecisionRow[];
}

export function getDecision(id: string): DecisionRow | null {
  return (db.query("SELECT * FROM decision_records WHERE id = ?").get(id) as DecisionRow) ?? null;
}

// ---- AT-ENT-03: evaluation_runs ----

export interface EvalRunRow {
  id: string;
  ts: string;
  suite: string;
  passed: number;
  failed: number;
  command: string;
  scope: string;
}

export function createEvalRun(body: Record<string, unknown>): EvalRunRow | Denial {
  const suite = typeof body.suite === "string" ? body.suite.trim() : "";
  const passed = body.passed;
  const failed = body.failed;
  const command = typeof body.command === "string" ? body.command : "";
  const scope = typeof body.scope === "string" && body.scope.trim() ? body.scope.trim() : "global";
  if (!suite) return { status: 400, reason: "suite_required" };
  if (!Number.isInteger(passed) || (passed as number) < 0) {
    return { status: 400, reason: "passed_harus_integer >= 0" };
  }
  if (!Number.isInteger(failed) || (failed as number) < 0) {
    return { status: 400, reason: "failed_harus_integer >= 0" };
  }
  const row: EvalRunRow = {
    id: crypto.randomUUID(),
    ts: now(),
    suite,
    passed: passed as number,
    failed: failed as number,
    command,
    scope,
  };
  db.run(
    "INSERT INTO evaluation_runs (id, ts, suite, passed, failed, command, scope) VALUES (?,?,?,?,?,?,?)",
    [row.id, row.ts, row.suite, row.passed, row.failed, row.command, row.scope]
  );
  insertEvent(null, "evaluation_run_recorded", {
    id: row.id,
    suite: row.suite,
    passed: row.passed,
    failed: row.failed,
    ts: row.ts,
  });
  return row;
}

export function listEvalRuns(opts: { org?: string; subject?: string }): EvalRunRow[] | Denial {
  if (opts.org && opts.subject) {
    const d = crossScopeDenial(opts.org, opts.subject);
    if (d) return d;
    return db
      .query("SELECT * FROM evaluation_runs WHERE scope = ? ORDER BY ts ASC")
      .all(opts.org) as EvalRunRow[];
  }
  return db.query("SELECT * FROM evaluation_runs ORDER BY ts ASC").all() as EvalRunRow[];
}
