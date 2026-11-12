# blackhornet runtime layer

> **Pivot context (PIVOT_RECORD.md DL-37):** blackhornet shifts identity from
> "autonomous hedge-fund sim" to a **runtime layer** (11 execution seats +
> mission pipeline) inside the DhaherOS control plane. The original Python
> source is gone (the corrupt `bh.git` and the missing `/home/z/blackhornet`
> directory are documented in PROGRESS.md / ASSET_AUDIT.md). This directory
> rebuilds blackhornet as a thin, reversible runtime layer — no `bh.git`
> revival, no remote fetch, no external network calls.

## What this layer is

A **runtime layer** = a named set of execution seats + a mission runner that
compose on top of the existing control plane (`/home/z/my-project/dhaheros/`).
The layer:

- Uses the **python3 adapter** added to `src/adapters.ts` (run-33 Track 1)
  so a control-plane task can be submitted with `"runtime":"python3"` and
  executed by `/usr/bin/python3` under the same sandboxed executor as `bun`
  and `node`.
- Does **not** create a new execution path. Every seat is a conceptual role
  that maps 1:1 to an existing capability from the org/capability whitelist
  (`task.create`, `task.read`, `task.cancel`, `knowledge.ingest`,
  `knowledge.search`, `knowledge.revoke`, `flow.run`, `org.manage`) — see
  `src/org.ts → CAPABILITIES`. No new capability is invented.
- Does **not** bypass any control-plane gate. A seat that wants to act still
  POSTs to `/api/tasks` with a `capability_context` and is subject to the same
  deny-by-default path policy (AT-05/AT-06), budget caps (AT-12), state
  machine (AT-15), and capability enforcement (AT-43.3 / AT-BH-05).

## Files

| File | Purpose |
|---|---|
| `seats.json` | Manifest of 11 execution seats. Each seat: `{id, name, runtime, capability, description}`. Capability is one of the 8 whitelisted names; runtime is `python3` (the new adapter). |
| `mission.py` | A Python mission runner. A mission = a list of `{action, input, expected?}` steps; actions are `echo`, `compute`, `search-notes`. Reads a spec from CLI arg (file path or inline JSON), stdin (with non-blocking guard), or a built-in demo. Writes a JSON summary to stdout. Stdlib-only (json/ast/select/os/sys). |
| `README.md` | This file. |

## The 11 seats

| id | name | capability | role |
|---|---|---|---|
| seat-researcher | researcher | knowledge.search | queries the knowledge index for mission context |
| seat-coder | coder | task.create | drafts and submits control-plane tasks |
| seat-analyst | analyst | task.read | reads task detail to interpret results |
| seat-reviewer | reviewer | task.read | reviews finished task artifacts/events |
| seat-planner | planner | task.create | composes task.create requests per mission step |
| seat-executor | executor | flow.run | drives multi-step flows (Fase 2 src/flow.ts) |
| seat-validator | validator | task.read | validates output against declared criteria |
| seat-librarian | librarian | knowledge.ingest | ingests new authorized knowledge sources |
| seat-sentinel | sentinel | task.cancel | cancels runaway tasks (timeout/budget) |
| seat-archivist | archivist | knowledge.revoke | revokes a knowledge source (purge) |
| seat-orchestrator | orchestrator | org.manage | coordinates seats; highest-privilege capability |

All 8 capabilities in the whitelist are reused. Seats that overlap on a
capability are intentional (e.g., `analyst` and `reviewer` both use
`task.read` — the difference is their role in a mission, not their
permissions).

## How it integrates with the control plane

```
                            ┌──────────────────────────────┐
   POST /api/tasks          │  src/index.ts (REST :3031)    │
   {runtime:"python3",     │   └ runtime whitelist check   │
   ─────────────────────▶   │     (src/adapters.ts)         │
    command:"python3 ...", │   └ capability_context check   │
    capability_context:    │     (src/org.ts)              │
    {org,subject,cap}}      │   └ path policy / budget      │
                            │     (src/paths.ts, db.ts)     │
                            │              │                 │
                            │              ▼                 │
                            │  src/executor.ts (Bun.spawn)  │
                            │   wrapper exports             │
                            │   DHOS_RUNTIME + _VERSION      │
                            └──────────────┬────────────────┘
                                           │  /usr/bin/setsid /bin/sh task_command.sh
                                           ▼
                          ┌────────────────────────────────┐
                          │  /usr/bin/python3 ...           │
                          │  (python3 adapter, run-33)      │
                          │                                │
                          │  blackhornet runtime layer:    │
                          │   • seats.json (11 seats)      │
                          │   • mission.py (mission runner)│
                          └────────────────────────────────┘
```

A "blackhornet task" is just a control-plane task with `runtime:"python3"`
and a command that points at a Python entrypoint (e.g. `python3 mission.py
<path-to-spec.json>`). Because the seat concept is enforced via
`capability_context` — not via a new code path — the same gates that protect
`bun`/`node` tasks protect blackhornet tasks:

- **adapter whitelist** (AT-41): `runtime:"python3"` is accepted, anything
  else is `400 + task_denied(invalid_runtime)`.
- **runtime version detected** (AT-41 / AT-BH-04): the adapter runs
  `/usr/bin/python3 --version` and records the result (`Python 3.x.y`) in
  `task_started.runtime_version` and `meta.json`.
- **deny-by-default path** (AT-05/AT-06): a mission command cannot touch
  paths outside the workspace; the test copies `mission.py` + spec into the
  workspace and runs `python3 mission.py spec.json` with relative paths.
- **capability enforcement** (AT-43.3 / AT-BH-05): a task claiming a seat
  with `capability:"org.manage"` is `403 + task_denied(missing_capability)`
  if the subject's role does not include `org.manage`.

## Running a mission

### As a control-plane task (preferred)

1. Copy `mission.py` and a mission-spec JSON into the workspace
   (`/home/z/my-project/dhaheros/workspaces/<ws>/`).
2. POST `/api/tasks`:

   ```json
   {
     "goal": "blackhornet mission: demo",
     "workspace": "/home/z/my-project/dhaheros/workspaces/ws-bh03",
     "command": "python3 mission.py mission-spec.json",
     "timeout_sec": 30,
     "runtime": "python3",
     "capability_context": {
       "org": "org-bh",
       "subject": "agent-mission",
       "capability": "task.create"
     }
   }
   ```

3. Read `artifacts/<task_id>/stdout.txt` for the JSON summary; check
   `meta.json` for `runtime:"python3"` and `runtime_version:"Python 3.x.y"`.

### Standalone (for development / debugging)

```sh
python3 runtimes/blackhornet/mission.py path/to/spec.json
python3 runtimes/blackhornet/mission.py '{"mission":"x","steps":[...]}'
echo '{...}' | python3 runtimes/blackhornet/mission.py
python3 runtimes/blackhornet/mission.py   # built-in demo
```

## Acceptance tests

`verify_at.sh` section "## Blackhornet runtime layer (AT-BH)":

- **AT-BH-01** — `runtime:"python3"` accepted; `python3 -c 'print(42)'` → 201,
  task succeeded, stdout contains `42`.
- **AT-BH-02** — `seats.json` valid: 11 seats, each has
  `{id,name,runtime,capability}`, all capabilities in the whitelist.
- **AT-BH-03** — `mission.py` runs as a control-plane task with a real spec;
  the JSON summary in `stdout.txt` parses and `ok:true`.
- **AT-BH-04** — python3 runtime version detected: `task_started.runtime_version`
  starts with `Python `.
- **AT-BH-05** — blackhornet seat capability enforced: a task claiming
  `capability:"org.manage"` for a subject whose role lacks it → `403` +
  `task_denied(missing_capability)` event, no task created.

## Safety / reversibility

- The only production-code change is adding `python3: "/usr/bin/python3"` to
  the `BINS` map in `src/adapters.ts`. Everything else is new files
  (`runtimes/blackhornet/*`) and new test section. Reverting the run-33 Track 1
  commit removes the python3 whitelist entry and deletes the runtime layer;
  the existing 40 ATs are unaffected (AT-41b is updated to use `ruby` as the
  invalid-runtime example, preserving the original test intent).
- No external/paid network calls. `mission.py` is stdlib-only and reads no
  remote resources.
- No `bh.git` revival; no `/home/z/blackhornet` access. The runtime layer is
  entirely self-contained under `/home/z/my-project/dhaheros/runtimes/blackhornet/`.
