// DhaherOS — Fase 5 slice-2: Workflow & policy binding (gate Tahap 5 plan §13:
// "validasi konfigurasi, least privilege, pemisahan scope, deny lintas tenant/proyek" —
// kini juga untuk WORKFLOW, bukan hanya task tunggal).
// Prototipe minimal (iris aman & reversibel — keputusan multi-tenant penuh tetap OPEN).
//   - Template workflow: step bernama berurutan, tiap step MENYANDIKAN capability yang
//     dibutuhkan untuk menjalankannya (least privilege by construction).
//   - Validasi template ketat (deny-by-default, semua deny ter-audit event workflow_denied):
//     nama step duplikat ditolak; capability di luar whitelist tertutup ditolak;
//     ref org yang tidak ada ditolak.
//   - Policy binding org→scope: template milik satu org, hanya bisa di-run pada scope yang
//     ter-bind ke org tsb — deny lintas org/scope ter-audit (no_policy_binding).
//   - Pre-check capability per step SEBELUM eksekusi: satu saja step tak tergrant → 403 +
//     workflow_denied(step_capability_denied) — TIDAK ada task dibuat, TIDAK ada step jalan.
//   - Eksekusi via control plane (komposisi seperti Fase 2): flow.json dirender dari template,
//     runner flow.ts disalin ke workspace, flow dijalankan SEBAGAI TASK — timeout/cancel/
//     budget/recovery control plane otomatis berlaku.
import { existsSync, statSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { db, insertEvent, insertTask } from "./db";
import { runTask } from "./executor";
import { WS_ROOT } from "./paths";
import { CAPABILITIES, checkCapability, getOrg } from "./org";

db.exec(`
CREATE TABLE IF NOT EXISTS workflow_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  org_id TEXT NOT NULL,
  steps TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS policy_bindings (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(org_id, scope)
);
CREATE INDEX IF NOT EXISTS idx_bindings_org ON policy_bindings(org_id);
`);

const now = () => new Date().toISOString();

export interface WfStepSpec { name: string; capability: string; command: string }
export interface WorkflowDetail {
  id: string;
  name: string;
  org: string;
  steps: { name: string; capability: string; command: string }[];
  created_at: string;
}
export interface BindingDetail { org: string; scope: string; created_at: string }

function orgNameById(orgId: string): string {
  const r = db.query("SELECT name FROM orgs WHERE id = ?").get(orgId) as { name: string } | null;
  return r?.name ?? "";
}

function wfRowToDetail(row: { id: string; name: string; org_id: string; steps: string; created_at: string }): WorkflowDetail {
  return {
    id: row.id,
    name: row.name,
    org: orgNameById(row.org_id),
    steps: JSON.parse(row.steps) as { name: string; capability: string; command: string }[],
    created_at: row.created_at,
  };
}

// Validasi template ketat (AT-44): nama step duplikat → ditolak; capability tidak ada di
// whitelist tertutup → ditolak; ref org tak ada → ditolak. Semua deny ter-audit.
export function createWorkflowTemplate(spec: {
  name?: unknown;
  org?: unknown;
  steps?: unknown;
}): WorkflowDetail | { status: number; reason: string; detail?: Record<string, unknown> } {
  if (!spec || typeof spec.name !== "string" || !spec.name.trim()) {
    return { status: 400, reason: "workflow_name_wajib" };
  }
  const name = spec.name.trim();
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    return { status: 400, reason: "workflow_name_invalid_char", detail: { name } };
  }
  if (db.query("SELECT id FROM workflow_templates WHERE name = ?").get(name)) {
    return { status: 409, reason: "workflow_exists", detail: { name } };
  }
  if (typeof spec.org !== "string" || !spec.org.trim()) {
    return { status: 400, reason: "org_wajib" };
  }
  const o = getOrg(spec.org.trim());
  if (!o) {
    insertEvent(null, "workflow_denied", {
      reason: "unknown_org_ref",
      workflow: name,
      org: spec.org,
      note: "template ditolak: merujuk org yang tidak ada",
    });
    return { status: 400, reason: "unknown_org_ref", detail: { workflow: name, org: spec.org } };
  }
  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    return { status: 400, reason: "steps_wajib_nonempty", detail: { workflow: name } };
  }
  const seen = new Set<string>();
  const clean: { name: string; capability: string; command: string }[] = [];
  for (const s of spec.steps as WfStepSpec[]) {
    if (!s || typeof s.name !== "string" || !s.name.trim()) {
      return { status: 400, reason: "step_name_wajib", detail: { workflow: name } };
    }
    const sn = s.name.trim();
    if (seen.has(sn)) {
      insertEvent(null, "workflow_denied", {
        reason: "duplicate_step",
        workflow: name,
        step: sn,
        note: "template ditolak: nama step duplikat",
      });
      return { status: 400, reason: "duplicate_step", detail: { workflow: name, step: sn } };
    }
    if (typeof s.capability !== "string" || !(CAPABILITIES as readonly string[]).includes(s.capability)) {
      insertEvent(null, "workflow_denied", {
        reason: "unknown_capability",
        workflow: name,
        step: sn,
        capability: s?.capability,
        allowed: CAPABILITIES as unknown as string[],
      });
      return { status: 400, reason: "unknown_capability", detail: { workflow: name, step: sn, capability: s?.capability } };
    }
    if (typeof s.command !== "string" || !s.command.trim()) {
      return { status: 400, reason: "step_command_wajib", detail: { workflow: name, step: sn } };
    }
    seen.add(sn);
    clean.push({ name: sn, capability: s.capability, command: s.command });
  }
  const id = crypto.randomUUID();
  db.run(
    "INSERT INTO workflow_templates (id, name, org_id, steps, created_at) VALUES (?,?,?,?,?)",
    [id, name, o.id, JSON.stringify(clean), now()]
  );
  insertEvent(null, "workflow_created", {
    workflow_id: id,
    name,
    org: o.name,
    step_count: clean.length,
    capabilities: clean.map((s) => s.capability),
  });
  return getWorkflow(name) as WorkflowDetail;
}

export function getWorkflow(idOrName: string): WorkflowDetail | null {
  const row = db
    .query("SELECT id, name, org_id, steps, created_at FROM workflow_templates WHERE id = ? OR name = ?")
    .get(idOrName, idOrName) as
    | { id: string; name: string; org_id: string; steps: string; created_at: string }
    | null;
  return row ? wfRowToDetail(row) : null;
}

export function listWorkflows(): WorkflowDetail[] {
  const rows = db
    .query("SELECT id, name, org_id, steps, created_at FROM workflow_templates ORDER BY created_at")
    .all() as { id: string; name: string; org_id: string; steps: string; created_at: string }[];
  return rows.map(wfRowToDetail);
}

// Policy binding org→scope (pemisahan scope Tahap 5): scope = nama direktori workspace
// di bawah WS_ROOT yang BOLEH dipakai org tsb.
export function bindPolicy(spec: { org?: unknown; scope?: unknown }):
  | BindingDetail
  | { status: number; reason: string; detail?: Record<string, unknown> } {
  if (!spec || typeof spec.org !== "string" || !spec.org.trim() || typeof spec.scope !== "string" || !spec.scope.trim()) {
    return { status: 400, reason: "org_dan_scope_wajib" };
  }
  const org = spec.org.trim();
  const scope = spec.scope.trim();
  if (!/^[A-Za-z0-9._-]+$/.test(scope)) {
    return { status: 400, reason: "scope_invalid_char", detail: { scope } };
  }
  const o = getOrg(org);
  if (!o) {
    insertEvent(null, "workflow_denied", {
      reason: "unknown_org_ref",
      org,
      scope,
      note: "binding ditolak: org tidak ada",
    });
    return { status: 400, reason: "unknown_org_ref", detail: { org, scope } };
  }
  if (db.query("SELECT id FROM policy_bindings WHERE org_id = ? AND scope = ?").get(o.id, scope)) {
    return { status: 409, reason: "policy_exists", detail: { org, scope } };
  }
  db.run("INSERT INTO policy_bindings (id, org_id, scope, created_at) VALUES (?,?,?,?)", [
    crypto.randomUUID(),
    o.id,
    scope,
    now(),
  ]);
  insertEvent(null, "policy_bound", { org: o.name, scope });
  return { org: o.name, scope, created_at: now() };
}

export function listBindings(): BindingDetail[] {
  return (
    db
      .query(
        `SELECT b.scope, b.created_at, o.name AS org FROM policy_bindings b
         JOIN orgs o ON o.id = b.org_id ORDER BY b.created_at`
      )
      .all() as { scope: string; created_at: string; org: string }[]
  ).map((r) => ({ org: r.org, scope: r.scope, created_at: r.created_at }));
}

export interface WorkflowRunResult {
  status: number;
  body: Record<string, unknown>;
}

// AT-44: run workflow dengan pre-check capability per step SEBELUM eksekusi.
// Urutan pemeriksaan (semua deny ter-audit event workflow_denied):
//   1. template ada (unknown_template)
//   2. bentuk request (bad_request)
//   3. policy binding org template → scope (no_policy_binding — deny lintas org/scope)
//   4. workspace scope ada di bawah WS_ROOT (workspace_missing)
//   5. gate run: subject punya flow.run di org template (run_capability_denied)
//   6. pre-check SEMUA step (step_capability_denied) — sebelum task dibuat
// Allow → render flow.json + salin runner + buat TASK (komposisi Fase 2) → eksekusi async.
export function startWorkflowRun(idOrName: string, body: unknown): WorkflowRunResult {
  const row = db
    .query("SELECT id, name, org_id, steps FROM workflow_templates WHERE id = ? OR name = ?")
    .get(idOrName, idOrName) as { id: string; name: string; org_id: string; steps: string } | null;
  if (!row) {
    insertEvent(null, "workflow_denied", { reason: "unknown_template", template: idOrName });
    return { status: 404, body: { error: "workflow_not_found" } };
  }
  const org = orgNameById(row.org_id);
  const steps = JSON.parse(row.steps) as { name: string; capability: string; command: string }[];

  const b = (body ?? {}) as Record<string, unknown>;
  const scope = typeof b.scope === "string" ? b.scope.trim() : "";
  const ctx = b.capability_context as { org?: unknown; subject?: unknown } | undefined;
  const ctxOrg = ctx && typeof ctx.org === "string" ? ctx.org.trim() : "";
  const subject = ctx && typeof ctx.subject === "string" ? ctx.subject.trim() : "";
  if (!scope || !ctxOrg || !subject) {
    insertEvent(null, "workflow_denied", {
      reason: "bad_request",
      workflow: row.name,
      note: "scope dan capability_context{org,subject} wajib",
    });
    return { status: 400, body: { error: "scope dan capability_context{org,subject} wajib" } };
  }

  // (3) policy binding: template HANYA bisa di-run pada scope yang ter-bind ke org-nya.
  const binding = db
    .query("SELECT id FROM policy_bindings WHERE org_id = ? AND scope = ?")
    .get(row.org_id, scope);
  if (!binding) {
    insertEvent(null, "workflow_denied", {
      reason: "no_policy_binding",
      workflow: row.name,
      template_org: org,
      ctx_org: ctxOrg,
      scope,
      note: "deny lintas org/scope: template milik satu org, scope lain/binding tak ada → ditolak",
    });
    return { status: 403, body: { error: "no_policy_binding", workflow: row.name, scope } };
  }

  // (4) workspace scope: direktori nyata di bawah WS_ROOT (pemisahan scope fisik).
  const ws = path.resolve(WS_ROOT, scope);
  if (!ws.startsWith(WS_ROOT + "/") || !existsSync(ws) || !statSync(ws).isDirectory()) {
    insertEvent(null, "workflow_denied", {
      reason: "workspace_missing",
      workflow: row.name,
      scope,
      workspace: ws,
      allowed_root: WS_ROOT,
    });
    return { status: 400, body: { error: "workspace_missing", scope, workspace: ws } };
  }

  // (5) gate run — checkCapability ter-audit sendiri (capability_check / capability_denied).
  const gate = checkCapability(org, subject, "flow.run");
  if (!gate.allowed) {
    insertEvent(null, "workflow_denied", {
      reason: "run_capability_denied",
      workflow: row.name,
      org,
      subject,
      gate: "flow.run",
      why: gate.reason,
    });
    return { status: 403, body: { error: "missing_capability", gate: "flow.run", why: gate.reason } };
  }

  // (6) pre-check SEMUA step SEBELUM task dibuat — deny mana pun = tidak ada eksekusi sama sekali.
  for (const s of steps) {
    const r = checkCapability(org, subject, s.capability);
    if (!r.allowed) {
      insertEvent(null, "workflow_denied", {
        reason: "step_capability_denied",
        workflow: row.name,
        org,
        subject,
        step: s.name,
        capability: s.capability,
        why: r.reason,
        note: "pre-check semua step sebelum eksekusi — tidak ada task dibuat, tidak ada step jalan",
      });
      return {
        status: 403,
        body: { error: "missing_capability", step: s.name, capability: s.capability, why: r.reason },
      };
    }
  }

  // Allow → komposisi Fase 2: flow.json dirender dari template, runner disalin ke workspace,
  // flow dijalankan SEBAGAI TASK (timeout/cancel/budget/recovery control plane berlaku).
  const flowJsonName = `flow-${row.name}.json`;
  writeFileSync(
    path.join(ws, flowJsonName),
    JSON.stringify({
      name: row.name,
      timeout_sec: 60,
      steps: steps.map((s) => ({ name: s.name, command: s.command })),
    }),
    { mode: 0o600 }
  );
  copyFileSync(path.join(import.meta.dir, "flow.ts"), path.join(ws, "flow.ts"));

  const id = crypto.randomUUID();
  const command = `bun flow.ts ${flowJsonName} . out`;
  insertTask({
    id,
    goal: `workflow:${row.name}`,
    workspace: ws,
    command,
    criteria: null,
    timeout_sec: 120,
    idempotency_key: null,
    budget_sec: null,
    runtime: "bun",
  });
  insertEvent(id, "task_created", {
    goal: `workflow:${row.name}`,
    workspace: ws,
    command,
    criteria: null,
    timeout_sec: 120,
    budget_sec: null,
    idempotency_key: null,
    runtime: "bun",
    capability_context: { org, subject, capability: "flow.run" },
    workflow: row.name,
    scope,
  });
  insertEvent(null, "workflow_started", {
    workflow: row.name,
    workflow_id: row.id,
    org,
    subject,
    scope,
    steps: steps.map((s) => ({ name: s.name, capability: s.capability })),
    task_id: id,
  });
  void runTask(id);
  return {
    status: 201,
    body: {
      workflow: row.name,
      org,
      scope,
      steps_checked: steps.map((s) => ({ name: s.name, capability: s.capability })),
      task_id: id,
      command,
    },
  };
}
