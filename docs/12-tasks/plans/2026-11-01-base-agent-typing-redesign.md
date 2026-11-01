# Design Note: BaseAgent typing redesign (Phase 5 M2+ backlog item 1)

- **Status:** Proposed (design drafted; implementation sweep pending, phased below)
- **Date:** 2026-11-01
- **Author:** Task 20 sub-run (autonomous initiative window)
- **Related:** [ADR-002 — type-system duality](../../11-adr/ADR-002-type-system-duality.md),
  [ROADMAP backlog](../../10-roadmap/ROADMAP.md) item 1, mypy baseline record
  (ECOSYSTEM_OPS §4: mypy 2.4.1 CI-exact, 1 error)
- **Verification basis:** mypy 2.4.1 reproduction and importlib resolution checks run
  2026-11-01 at main `ad6f6f5` (worktree clean, pytest 539 passed / 28 skipped gate green).

## 1. Problem statement

The mypy CI baseline is exactly **1 error in 302 source files**:

```
src/core/base_agent.py:483: error: "AgentRegistry" has no attribute "get"  [attr-defined]
```

The ROADMAP classifies this as *not* a quick-fix candidate: the error is the visible
tip of a seam that crosses **two coexisting BaseAgent species** (per ADR-002 this
duality is deliberate until post-v7). Any fix that only silences mypy would leave the
seam broken at runtime.

## 2. Root-cause anatomy: the subagent-spawn seam

`CoreBaseAgent.spawn_subagent(spawn: SubagentSpawn) -> str`
(`src/core/base_agent.py:471-506`) currently does:

```python
from src.agents.registry import AgentRegistry          # line 480
registry = AgentRegistry()
agent_cls = registry.get(spawn.role.value)             # line 483  ← the mypy error
sub_agent = agent_cls(config=AgentConfig(role=spawn.role, ...))
...
result = await sub_agent.run(spawn.task)
```

Five stacked incompatibilities, each independently verified on 2026-11-01:

| # | Defect | Evidence |
|---|--------|----------|
| 1 | `AgentRegistry` has **no `get()` method** — only `get_agent(agent_id)`, `create_agent(agent_type, spec, tools)`, `register_type()` | `src/agents/registry.py` (full method inventory); the call conflates it with `ToolRegistry.get(name)` at `src/core/tool_registry.py:212` |
| 2 | **Enum mismatch**: `SubagentSpawn.role: AgentRole` (10 members incl. `SUPERVISOR`, `src/colony_types/agent.py:20`) vs `AGENT_TYPES: Dict[AgentType, Type[Any]]` (9 members, no `SUPERVISOR`, `src/colony_types/models.py:33`) — a string lookup can never type-check against `AgentType` keys | both enums inspected |
| 3 | **Constructor mismatch**: `AGENT_TYPES` values are registry-species agents (subclasses of `src/agents/base.BaseAgent`) whose `__init__` takes `spec=AgentSpec(...)`, `event_bus=`, `tools=` — but the seam constructs with `config=AgentConfig(...)` (core-species kwargs) → `TypeError` if line 483 were ever passed | `src/agents/base.py:124`, `src/agents/manus/__init__` family |
| 4 | **Contract mismatch**: core species `run(task: str) -> str`; registry species `run(task: Task) -> TaskResult` (`src/agents/base.py:240-260`) — both the argument type and the return type are incompatible with `sub_agent.run(spawn.task)` returning `str` | signatures inspected |
| 5 | **Latent, not live**: `spawn_subagent` has **zero callers** in `src/` and `tests/` (rg sweep 2026-11-01; the similarly named `src/colony/runtime_gate.spawn_subagent_on_rust` is an independent Rust-gate seam) — the defect is dormant, which is why pytest is green | grep + test sweep |

Conclusion: the seam needs a *typed redesign* (owner, mapping, construction path,
result contract), not an ignore comment.

## 3. Sweep inventory (adjacent findings, for Phase P3)

1. **Nine shadowed dead modules.** `src/agents/{colony,manus,planner,coder,browser,voice,security,researcher,executor}.py` all exist *alongside* same-named packages; Python resolves `src.agents.<m>` to the package `__init__.py` in every case (verified with `importlib.import_module` for all 9 on 2026-11-01). The flat files are unreachable duplicates — deletion candidates after a direct-reference audit.
2. **Malformed ignore comment** at `src/agents/base.py:294`: `raise last_error  # type: ignoreisc]` — parsed as a bare ignore by accident; normalize (typed ignore or fix the `Optional[Exception]` raise properly).
3. **Weak registry typing**: `AGENT_TYPES: Dict[AgentType, Type[Any]]` should be `dict[AgentType, type[BaseAgent]]` (registry species) once the seam is owned by the registry.
4. **Untyped-function notes** in `src/integration/*` (`annotation-unchecked`): candidate for `--check-untyped-defs` adoption after P2; assess error count in a dedicated window.
5. ADR-002 remains the rule of record: the two species stay; this redesign **bridges** them, it does not merge them.

## 4. Constraints

- No consolidation of the two type systems (ADR-002; post-v7 scope).
- No public-API break outside the spawn seam — and since `spawn_subagent` has zero
  callers, its contract may be redesigned freely.
- Every implementation phase is gated: full pytest green (baseline 539/28 @ `ad6f6f5`),
  ruff CI-exact (`ruff check src/ --select E,F,W --ignore E501`), mypy target
  **0 errors** after P2, linear history (no force-push), ls-remote-verified push,
  tag `v7.0.0` untouched.

## 5. Design options considered

### Option A — Registry-owned spawn factory (RECOMMENDED)

The registry already owns construction and typing of the registry species; give it
the spawn seam:

```python
# src/agents/registry.py
_ROLE_TO_TYPE: dict[AgentRole, AgentType] = {
    AgentRole.MANUS: AgentType.MANUS,
    AgentRole.PLANNER: AgentType.PLANNER,
    ...  # 9 shared members, 1:1; AgentRole.SUPERVISOR intentionally absent
}

class SubagentRunResult(BaseModel):
    agent_id: str
    task_result: TaskResult | None = None
    error: str | None = None

class AgentRegistry:
    def create_subagent(
        self, spawn: SubagentSpawn, *, event_bus: EventBus | None = None
    ) -> SubagentRunResult:
        agent_type = _ROLE_TO_TYPE.get(spawn.role)
        if agent_type is None:
            raise ValueError(f"role {spawn.role.value} is not spawnable")
        spec = AgentSpec(agent_type=agent_type, colony_id=spawn.metadata.get("colony_id"))
        agent = self.create_agent(agent_type, spec=spec)   # existing typed path
        task = Task(description=spawn.task, colony_id=spec.colony_id,
                    parent_task_id=spawn.metadata.get("parent_task_id"))
        result = await agent.run(task)
        return SubagentRunResult(agent_id=agent.agent_id, task_result=result)
```

`CoreBaseAgent.spawn_subagent` becomes a thin typed delegate: build the spawn
request, call `registry.create_subagent`, append to `self.subagent_ids`, return the
`SubagentRunResult`. Cycle-safety: `registry.py` imports only `colony_types` models
(no core import); the core side already imports `AgentRegistry` lazily.

- mypy outcome: the error disappears **by construction** (the `.get` call is gone);
  no new `type: ignore` needed anywhere.
- Enum mismatch becomes an explicit, documented mapping; `SUPERVISOR` is rejected
  loudly at call time with a rationale string.
- Construction and run go through the registry species' real contract
  (`spec=` kwargs, `Task` in / `TaskResult` out).
- Async note: `create_subagent` must be `async def` (it awaits `agent.run`); the
  core delegate awaits it — no fire-and-forget task spawning, matching the
  synchronous-inheritance pattern already used for bus/provider wiring.

### Option B — Quick fix (REJECTED per ROADMAP)

Add `AgentRegistry.get(role_str) -> type[BaseAgent]`. Mypy passes; the enum,
constructor and contract mismatches remain, and the runtime path stays broken.

### Option C — Unify the two BaseAgent species (REJECTED for now)

Violates ADR-002's post-v7 scoping; a big-bang class merge across ~41 importers is
exactly the scope-creep the v7 rules forbid. Revisit only in the post-v7
consolidation plan.

### Option D — `SubagentFactory` Protocol module

A `runtime_checkable` Protocol capturing "spawn-capable" would decouple core from
the concrete registry. Worth it only when a **second** spawn seam appears (e.g. the
Rust gate path); keep as a future extension of Option A.

## 6. Phased implementation plan (each phase a separate gated increment)

- **P1 — Characterization tests (no prod change).** Add a test proving today's
  `spawn_subagent` raises `AttributeError: ... no attribute 'get'` (documents the
  latent bug), plus an `AgentRegistry` API-freeze test (`get` absent,
  `create_agent`/`get_agent` signatures pinned). Gate: pytest green before any code
  change.
- **P2 — Implement Option A.** `_ROLE_TO_TYPE` + `SubagentRunResult` +
  `create_subagent` + core delegate rewire. New tests: happy-path spawn with a stub
  registry-species agent (assert `Task` fields derived from `SubagentSpawn`),
  `SUPERVISOR` rejection, result-contract shape. Gate: pytest 539+n green, ruff
  clean, `mypy src/` = **0 errors** (baseline moves 1 → 0; record in OPS).
- **P3 — Sweep, one item per window, each gated:** (a) delete the 9 shadowed flat
  modules after reference audit (rg for direct path references, changelog entry);
  (b) normalize `src/agents/base.py:294` ignore; (c) `AGENT_TYPES` →
  `dict[AgentType, type[BaseAgent]]`; (d) evaluate `--check-untyped-defs` for
  `src/` (error-count assessment first).
- Every phase: linear commit on `main`, no force-push, `ls-remote`-verified push to
  all remotes, tag untouched.

## 7. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Registry-species `run()` needs a `Task`; `SubagentSpawn.task` is `str` | P2 maps `task -> Task(description=..., colony_id=..., parent_task_id=...)` (fields verified in `colony_types/models.py`); covered by a dedicated test |
| `AgentRole.SUPERVISOR` has no `AgentType` counterpart | Explicit `_ROLE_TO_TYPE` omission + `ValueError` with rationale; documented in both docstrings |
| Deleting flat modules (P3a) surprises downstream forks | Reference audit first; deletion called out in `docs/13-changelog/` and the commit message |
| mypy baseline drift (OPS records "1 error") | P2 explicitly moves the recorded baseline to 0; OPS §4 updated in the same increment |
| Dead seam grows new callers while broken | P1 characterization test fails loudly if anyone starts using the current broken path before P2 lands |
