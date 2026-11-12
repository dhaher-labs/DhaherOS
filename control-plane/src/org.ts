// Fase 5 slice-1 — Organization & Capability engine (gate Tahap 5 plan §13:
// "validasi konfigurasi, least privilege, pemisahan scope, deny lintas tenant/proyek").
// Prototipe minimal untuk kebutuhan kontrol internal control plane (iris aman,
// reversibel — keputusan multi-tenant penuh tetap OPEN di plan).
//   - Registry capability = whitelist tertutup di kode (least privilege by construction).
//   - Konfigurasi org/role/member divalidasi ketat saat create (deny-by-default).
//   - Verifikasi kebijakan: checkCapability → allow/deny ter-audit (event capability_check
//     + capability_denied saat deny) — deny lintas tenant terbukti via member org lain.
import { db, insertEvent } from "./db";

export const CAPABILITIES = [
  "task.create",
  "task.read",
  "task.cancel",
  "knowledge.ingest",
  "knowledge.search",
  "knowledge.revoke",
  "flow.run",
  "org.manage",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

db.exec(`
CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS org_roles (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  capabilities TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(org_id, name)
);
CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(org_id, subject)
);
CREATE INDEX IF NOT EXISTS idx_roles_org ON org_roles(org_id);
CREATE INDEX IF NOT EXISTS idx_members_org ON org_members(org_id);
`);

const now = () => new Date().toISOString();

export interface Denial {
  status: number;
  reason: string;
  detail?: Record<string, unknown>;
}

export interface RoleSpec {
  name: string;
  capabilities: string[];
}
export interface MemberSpec {
  subject: string;
  role: string;
}
export interface OrgSpec {
  name: string;
  roles: RoleSpec[];
  members: MemberSpec[];
}

export interface OrgRoleDetail {
  id: string;
  name: string;
  capabilities: string[];
}
export interface OrgMemberDetail {
  id: string;
  subject: string;
  role: string;
}
export interface OrgDetail {
  id: string;
  name: string;
  status: string;
  roles: OrgRoleDetail[];
  members: OrgMemberDetail[];
}

// Validasi konfigurasi ketat (gate Tahap 5): nama wajib unik; role tidak boleh duplikat
// (UNIQUE org+name); capability harus di whitelist tertutup (wildcard '*' ditolak eksplisit);
// member harus merujuk role yang terdefinisi dalam org yang sama (ref tak ada → ditolak).
export function createOrg(spec: OrgSpec): OrgDetail | Denial {
  if (!spec || typeof spec.name !== "string" || !spec.name.trim()) {
    return { status: 400, reason: "org_name_wajib" };
  }
  if (!Array.isArray(spec.roles) || spec.roles.length === 0) {
    return { status: 400, reason: "roles_wajib_nonempty" };
  }
  if (!Array.isArray(spec.members) || spec.members.length === 0) {
    return { status: 400, reason: "members_wajib_nonempty" };
  }
  const name = spec.name.trim();
  if (db.query("SELECT id FROM orgs WHERE name = ?").get(name)) {
    return { status: 409, reason: "org_exists", detail: { name } };
  }
  // --- validasi roles ---
  const seen = new Set<string>();
  const roleCaps = new Map<string, string[]>();
  for (const r of spec.roles) {
    if (!r || typeof r.name !== "string" || !r.name.trim()) {
      return { status: 400, reason: "role_name_wajib" };
    }
    const rn = r.name.trim();
    if (seen.has(rn)) {
      insertEvent(null, "org_denied", {
        reason: "duplicate_role",
        org: name,
        role: rn,
        note: "konfigurasi ditolak: role duplikat dalam satu org",
      });
      return { status: 400, reason: "duplicate_role", detail: { org: name, role: rn } };
    }
    if (!Array.isArray(r.capabilities) || r.capabilities.length === 0) {
      return { status: 400, reason: "role_capabilities_wajib_nonempty", detail: { role: rn } };
    }
    for (const c of r.capabilities) {
      if (c === "*") {
        insertEvent(null, "org_denied", {
          reason: "wildcard_capability",
          org: name,
          role: rn,
          note: "konfigurasi ditolak: wildcard melanggar least privilege",
        });
        return { status: 400, reason: "wildcard_capability", detail: { org: name, role: rn } };
      }
      if (!(CAPABILITIES as readonly string[]).includes(c)) {
        insertEvent(null, "org_denied", {
          reason: "invalid_capability",
          org: name,
          role: rn,
          capability: c,
          allowed: CAPABILITIES as unknown as string[],
        });
        return { status: 400, reason: "invalid_capability", detail: { org: name, role: rn, capability: c } };
      }
    }
    seen.add(rn);
    roleCaps.set(rn, [...r.capabilities]);
  }
  // --- validasi members (ref harus ke role org yang sama) ---
  for (const m of spec.members) {
    if (!m || typeof m.subject !== "string" || !m.subject.trim()) {
      return { status: 400, reason: "member_subject_wajib" };
    }
    if (typeof m.role !== "string" || !roleCaps.has(m.role.trim())) {
      insertEvent(null, "org_denied", {
        reason: "unknown_role_ref",
        org: name,
        member: m?.subject,
        role: m?.role,
        note: "konfigurasi ditolak: member merujuk role yang tidak ada di org ini",
      });
      return { status: 400, reason: "unknown_role_ref", detail: { org: name, role: m?.role } };
    }
  }
  // --- commit ---
  const id = crypto.randomUUID();
  const ts = now();
  db.run("INSERT INTO orgs (id, name, status, created_at, updated_at) VALUES (?,?, 'active', ?, ?)", [id, name, ts, ts]);
  const roleId = new Map<string, string>();
  for (const rn of roleCaps.keys()) {
    const rid = crypto.randomUUID();
    roleId.set(rn, rid);
    db.run(
      "INSERT INTO org_roles (id, org_id, name, capabilities, created_at, updated_at) VALUES (?,?,?,?,?,?)",
      [rid, id, rn, JSON.stringify(roleCaps.get(rn)), ts, ts]
    );
  }
  for (const m of spec.members) {
    db.run(
      "INSERT INTO org_members (id, org_id, role_id, subject, created_at) VALUES (?,?,?,?,?)",
      [crypto.randomUUID(), id, roleId.get(m.role.trim())!, m.subject.trim(), ts]
    );
  }
  insertEvent(null, "org_created", {
    org_id: id,
    name,
    role_count: roleCaps.size,
    member_count: spec.members.length,
  });
  return getOrg(id) as OrgDetail;
}

export function orgDetailFromRows(
  org: { id: string; name: string; status: string }
): OrgDetail {
  const roles = (
    db
      .query("SELECT id, name, capabilities FROM org_roles WHERE org_id = ? ORDER BY name")
      .all(org.id) as { id: string; name: string; capabilities: string }[]
  ).map((r) => ({ id: r.id, name: r.name, capabilities: JSON.parse(r.capabilities) as string[] }));
  const members = (
    db
      .query(
        `SELECT m.id, m.subject, r.name AS role FROM org_members m
         JOIN org_roles r ON r.id = m.role_id WHERE m.org_id = ? ORDER BY m.subject`
      )
      .all(org.id) as { id: string; subject: string; role: string }[]
  ).map((m) => ({ id: m.id, subject: m.subject, role: m.role }));
  return { id: org.id, name: org.name, status: org.status, roles, members };
}

export function getOrg(idOrName: string): OrgDetail | null {
  const org = db
    .query("SELECT id, name, status FROM orgs WHERE id = ? OR name = ?")
    .get(idOrName, idOrName) as { id: string; name: string; status: string } | null;
  return org ? orgDetailFromRows(org) : null;
}

export function listOrgs(): OrgDetail[] {
  const rows = db.query("SELECT id, name, status FROM orgs ORDER BY created_at").all() as {
    id: string;
    name: string;
    status: string;
  }[];
  return rows.map(orgDetailFromRows);
}

export interface CapabilityCheckResult {
  allowed: boolean;
  org: string;
  subject: string;
  capability: string;
  role?: string;
  reason?: string;
}

// AT-43: verifikasi kebijakan capability — SEMUA check ter-audit (capability_check);
// deny tambah-ters audit eksplisit (capability_denied) agar ev_count mudah dibuktikan.
// Deny lintas tenant: member yang tidak terdaftar di org tsb → denied (no_member).
export function checkCapability(org: string, subject: string, capability: string): CapabilityCheckResult {
  const base = { org, subject, capability };
  if (typeof org !== "string" || !org.trim() || typeof subject !== "string" || !subject.trim() || typeof capability !== "string" || !capability.trim()) {
    const r: CapabilityCheckResult = { allowed: false, ...base, reason: "bad_request" };
    insertEvent(null, "capability_denied", { ...r });
    return r;
  }
  const o = db.query("SELECT id, name FROM orgs WHERE id = ? OR name = ?").get(org, org) as
    | { id: string; name: string }
    | null;
  if (!o) {
    const r: CapabilityCheckResult = { allowed: false, ...base, reason: "no_org" };
    insertEvent(null, "capability_denied", { ...r });
    return r;
  }
  const m = db
    .query(
      `SELECT r.name AS role, r.capabilities AS caps FROM org_members m
       JOIN org_roles r ON r.id = m.role_id WHERE m.org_id = ? AND m.subject = ?`
    )
    .get(o.id, subject) as { role: string; caps: string } | null;
  if (!m) {
    const r: CapabilityCheckResult = { allowed: false, ...base, reason: "no_member" };
    insertEvent(null, "capability_denied", { ...r });
    return r;
  }
  const caps = JSON.parse(m.caps) as string[];
  if (!caps.includes(capability)) {
    const r: CapabilityCheckResult = { allowed: false, ...base, role: m.role, reason: "capability_not_in_role" };
    insertEvent(null, "capability_denied", { ...r });
    return r;
  }
  const r: CapabilityCheckResult = { allowed: true, ...base, role: m.role };
  insertEvent(null, "capability_check", { ...r });
  return r;
}

// Integrasi control plane: task menyandikan org/role via capability_context opsional.
// Context tak valid → Denial 403 (task TIDAK dibuat) — dipanggil di POST /api/tasks.
export interface CapabilityContext {
  org: string;
  subject: string;
  capability: string;
}

export function validateCapabilityContext(ctx: CapabilityContext): Denial | null {
  if (
    !ctx ||
    typeof ctx.org !== "string" ||
    typeof ctx.subject !== "string" ||
    typeof ctx.capability !== "string"
  ) {
    return { status: 400, reason: "capability_context_invalid" };
  }
  const r = checkCapability(ctx.org.trim(), ctx.subject.trim(), ctx.capability.trim());
  if (r.allowed) return null;
  return {
    status: 403,
    reason: "missing_capability",
    detail: { org: r.org, subject: r.subject, capability: r.capability, why: r.reason },
  };
}
