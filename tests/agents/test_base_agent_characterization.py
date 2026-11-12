"""P1/P2 tests for the base_agent typing redesign.

Design: docs/12-tasks/plans/2026-11-01-base-agent-typing-redesign.md
(Phase 5 M2+ backlog item 1; P1 landed @ 22fd81d, P2 this commit).

P2 regression tests (this file, rewritten from the P1 characterization):

* happy-path spawn: role→type mapping routes through the real ``spec=``
  construction path, the child is registry-tracked, and the executed
  ``Task`` fields are derived from ``SubagentSpawn`` (description /
  colony_id / parent_task_id).
* SUPERVISOR / WORKER roles are rejected loudly (``ValueError``) — they
  are top-level coordinators, not spawnable workers.
* ``SubagentRunResult`` contract shape (agent_id required; task_result
  and error default to None).
* API freeze: ``AgentRegistry.get`` must never exist (Option B REJECTED),
  ``create_agent``/``get_agent``/``register_type`` signatures pinned.
* role/type enum split pinned: only SUPERVISOR + WORKER lack a type
  counterpart (drift guard for ``_ROLE_TO_TYPE``).
* zero-caller guard: no module outside ``src/core/base_agent.py`` calls
  ``.spawn_subagent(`` (the seam stays owned by the core delegate).
"""

import asyncio
import inspect
import pathlib
import re
import unittest


class TestCreateSubagent(unittest.TestCase):
    """P2 regression: AgentRegistry.create_subagent (Option A)."""

    def setUp(self):
        from src.agents.registry import AGENT_TYPES
        from src.colony_types import AgentType

        class _EchoAgent(_StubBase()):
            async def on_task(self, task):
                return {"echo": task.description}

            async def on_message(self, message):
                return None

            def capabilities(self):
                return ["echo"]

        self._original = AGENT_TYPES[AgentType.EXECUTOR]
        AGENT_TYPES[AgentType.EXECUTOR] = _EchoAgent

    def tearDown(self):
        from src.agents.registry import AGENT_TYPES
        from src.colony_types import AgentType

        AGENT_TYPES[AgentType.EXECUTOR] = self._original

    def test_happy_path_spawns_runs_and_tracks(self):
        from src.agents.registry import AgentRegistry, SubagentRunResult
        from src.colony_types.agent import AgentRole, SubagentSpawn

        registry = AgentRegistry()
        spawn = SubagentSpawn(
            role=AgentRole.EXECUTOR,
            task="ping-stub",
            metadata={"colony_id": "col-1", "parent_task_id": "pt-9"},
        )
        result = asyncio.run(registry.create_subagent(spawn))

        self.assertIsInstance(result, SubagentRunResult)
        self.assertIsNone(result.error)
        self.assertIsNotNone(result.task_result)
        self.assertTrue(result.task_result.success)
        self.assertEqual(result.task_result.data, {"echo": "ping-stub"})
        # child is tracked by the registry (real create_agent path)
        self.assertIn(result.agent_id, registry._agents)

    def test_task_fields_derived_from_spawn(self):
        from src.agents.registry import AgentRegistry
        from src.colony_types import Task
        from src.colony_types.agent import AgentRole, SubagentSpawn

        captured: list = []

        class _CaptureAgent(_StubBase()):
            async def on_task(self, task):
                captured.append(task)
                return "ok"

            async def on_message(self, message):
                return None

            def capabilities(self):
                return ["capture"]

        from src.agents.registry import AGENT_TYPES
        from src.colony_types import AgentType

        AGENT_TYPES[AgentType.EXECUTOR] = _CaptureAgent
        try:
            registry = AgentRegistry()
            spawn = SubagentSpawn(
                role=AgentRole.EXECUTOR,
                task="derive-me",
                metadata={"colony_id": "col-7", "parent_task_id": "pt-42"},
            )
            result = asyncio.run(registry.create_subagent(spawn))
        finally:
            AGENT_TYPES[AgentType.EXECUTOR] = self._original

        self.assertEqual(len(captured), 1)
        task = captured[0]
        self.assertIsInstance(task, Task)
        self.assertEqual(task.description, "derive-me")
        self.assertEqual(task.colony_id, "col-7")
        self.assertEqual(task.parent_task_id, "pt-42")
        self.assertTrue(result.task_result.success)

    def test_supervisor_role_rejected_loudly(self):
        from src.agents.registry import AgentRegistry
        from src.colony_types.agent import AgentRole, SubagentSpawn

        registry = AgentRegistry()
        with self.assertRaises(ValueError) as ctx:
            asyncio.run(
                registry.create_subagent(
                    SubagentSpawn(role=AgentRole.SUPERVISOR, task="x")
                )
            )
        self.assertIn("not spawnable", str(ctx.exception))

    def test_worker_role_rejected_loudly(self):
        from src.agents.registry import AgentRegistry
        from src.colony_types.agent import AgentRole, SubagentSpawn

        registry = AgentRegistry()
        with self.assertRaises(ValueError) as ctx:
            asyncio.run(
                registry.create_subagent(SubagentSpawn(role=AgentRole.WORKER, task="x"))
            )
        self.assertIn("not spawnable", str(ctx.exception))

    def test_subagent_run_result_contract_shape(self):
        from src.agents.registry import SubagentRunResult

        result = SubagentRunResult(agent_id="a-1")
        self.assertEqual(result.agent_id, "a-1")
        self.assertIsNone(result.task_result)
        self.assertIsNone(result.error)


class TestAgentRegistryApiFreeze(unittest.TestCase):
    """Freezes AgentRegistry's public API across the redesign."""

    def test_registry_has_no_get_method(self):
        from src.agents.registry import AgentRegistry

        self.assertFalse(
            hasattr(AgentRegistry, "get"),
            "AgentRegistry.get must NOT exist: Option B (quick fix) is "
            "rejected per ROADMAP — spawn ownership belongs to "
            "create_subagent (design doc §5 Option A).",
        )

    def test_create_agent_signature_pinned(self):
        from src.agents.registry import AgentRegistry

        params = list(inspect.signature(AgentRegistry.create_agent).parameters)
        self.assertEqual(params, ["self", "agent_type", "spec", "tools"])

    def test_get_agent_signature_pinned(self):
        from src.agents.registry import AgentRegistry

        params = list(inspect.signature(AgentRegistry.get_agent).parameters)
        self.assertEqual(params, ["self", "agent_id"])

    def test_register_type_signature_pinned(self):
        from src.agents.registry import AgentRegistry

        params = list(inspect.signature(AgentRegistry.register_type).parameters)
        self.assertEqual(params, ["self", "agent_type", "agent_class"])

    def test_create_subagent_is_async_and_keyword_only_bus(self):
        from src.agents.registry import AgentRegistry

        self.assertTrue(inspect.iscoroutinefunction(AgentRegistry.create_subagent))
        params = inspect.signature(AgentRegistry.create_subagent).parameters
        self.assertEqual(
            list(params), ["self", "spawn", "event_bus"]
        )
        self.assertEqual(params["event_bus"].kind, inspect.Parameter.KEYWORD_ONLY)

    def test_supervisor_role_has_no_agent_type_counterpart(self):
        """Defect 2 pinned: AgentRole.SUPERVISOR exists, AGENT_TYPES has none."""
        from src.agents.registry import AGENT_TYPES
        from src.colony_types.agent import AgentRole

        role_names = {r.name for r in AgentRole}
        type_names = {t.name for t in AGENT_TYPES}
        self.assertIn("SUPERVISOR", role_names)
        self.assertNotIn("SUPERVISOR", type_names)
        self.assertTrue(type_names.issubset(role_names))
        self.assertEqual(
            role_names - type_names,
            {"SUPERVISOR", "WORKER"},
            "unexpected drift in the role/type split — update _ROLE_TO_TYPE "
            "and this drift guard together",
        )

    def test_role_to_type_mapping_is_total_over_agent_types(self):
        """Every spawnable type is reachable: _ROLE_TO_TYPE covers all 9."""
        from src.agents.registry import AGENT_TYPES, _ROLE_TO_TYPE
        from src.colony_types.agent import AgentRole

        self.assertEqual(len(_ROLE_TO_TYPE), len(AGENT_TYPES))
        self.assertEqual(
            {r.name for r in _ROLE_TO_TYPE}, {t.name for t in AGENT_TYPES}
        )
        self.assertNotIn(AgentRole.SUPERVISOR, _ROLE_TO_TYPE)
        self.assertNotIn(AgentRole.WORKER, _ROLE_TO_TYPE)


class TestSeamOwnership(unittest.TestCase):
    """Guards inherited from P1 (seam-usage confinement)."""

    def test_spawn_subagent_callers_confined_to_core_species(self):
        """Only the core-species delegates may call ``.spawn_subagent(``.

        P1 pinned "zero callers" while the seam was broken; since P2 the
        seam works, so the guard narrows instead: usage stays confined to
        ``src/core/base_agent.py`` (thin delegate) and
        ``src/agents/colony/agent.py`` (str-adapter ``delegate()``).
        """
        repo_src = (
            pathlib.Path(__file__).resolve().parents[2] / "src"
        )
        pattern = re.compile(r"\.spawn_subagent\(")
        allowed = {
            pathlib.Path("core") / "base_agent.py",
            pathlib.Path("agents") / "colony" / "agent.py",
        }
        hits = {
            p.relative_to(repo_src)
            for p in repo_src.rglob("*.py")
            if p.name != "base_agent.py"
            and pattern.search(p.read_text(encoding="utf-8"))
        }
        unexpected = hits - allowed
        self.assertEqual(
            unexpected,
            set(),
            "new .spawn_subagent caller appeared outside the core-species "
            f"delegates: {sorted(str(h) for h in unexpected)} — route it "
            "through AgentRegistry.create_subagent instead",
        )


def _StubBase():
    """Lazy base class for stub registry-species agents (test-local)."""
    from src.agents.base import BaseAgent

    return BaseAgent


if __name__ == "__main__":
    unittest.main()
